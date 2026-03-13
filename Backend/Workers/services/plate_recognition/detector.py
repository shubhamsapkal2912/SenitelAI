from ultralytics import YOLO

class PlateDetector:
    def __init__(self, model_path="models/plate_detector.pt"):
        from ultralytics import YOLO
        self.model = YOLO(model_path)

    def detect(self, frame):

        results = self.model(frame)

        if len(results[0].boxes) == 0:
            return None

        box = results[0].boxes[0]

        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())

        return frame[y1:y2, x1:x2]