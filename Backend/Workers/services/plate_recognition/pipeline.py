import os
import cv2
import logging

from .detector import PlateDetector
from .ocr import PlateOCR

logger = logging.getLogger(__name__)


class PlateRecognitionPipeline:

    def __init__(self):

        # resolve model path safely
        base_dir = os.path.dirname(__file__)
        model_path = os.path.join(base_dir, "models", "plate_detector.pt")

        logger.info("[PlatePipeline] Initializing plate detector...")
        self.detector = PlateDetector(model_path)

        logger.info("[PlatePipeline] Initializing OCR...")
        self.ocr = PlateOCR()

    def extract(self, frame):

        logger.info("[PlatePipeline] Running plate detection...")

        plate_crop = self.detector.detect(frame)

        if plate_crop is None:
            logger.info("[PlatePipeline] No plate detected")
            return None

        # Save the raw plate crop for debugging
        raw_debug_path = "/tmp/plate_crop.jpg"
        cv2.imwrite(raw_debug_path, plate_crop)
        logger.info(f"[PlatePipeline] Saved raw plate crop: {raw_debug_path}")

        # Ensure crop is large enough for OCR
        h, w = plate_crop.shape[:2]

        if w < 80 or h < 25:
            logger.info(
                f"[PlatePipeline] Plate crop too small for OCR ({w}x{h})"
            )
            return None

        logger.info("[PlatePipeline] Plate detected, preprocessing image...")

        # Convert to grayscale
        gray = cv2.cvtColor(plate_crop, cv2.COLOR_BGR2GRAY)

        # Upscale for better OCR accuracy
        gray = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)

        # Noise reduction
        gray = cv2.GaussianBlur(gray, (5, 5), 0)

        # Thresholding
        _, thresh = cv2.threshold(
            gray,
            0,
            255,
            cv2.THRESH_BINARY + cv2.THRESH_OTSU
        )

        # Save processed image used for OCR
        debug_path = "/tmp/plate_debug.jpg"
        cv2.imwrite(debug_path, thresh)

        logger.info(f"[PlatePipeline] Saved OCR input image: {debug_path}")

        logger.info("[PlatePipeline] Running OCR...")

        plate_number = self.ocr.extract(thresh)

        logger.info(f"[PlatePipeline] OCR result: {plate_number}")

        return plate_number