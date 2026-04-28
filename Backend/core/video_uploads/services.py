import base64
import importlib.util
import logging
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone

from .models import VideoUpload

logger = logging.getLogger(__name__)

MAX_WORKERS = max(1, int(os.environ.get("VIDEO_UPLOAD_WORKERS", "2")))
COOLDOWN_MS = int(os.environ.get("VIDEO_UPLOAD_COOLDOWN_MS", "10000"))
PROCESSING_EXECUTOR = ThreadPoolExecutor(max_workers=MAX_WORKERS)

CORE_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = CORE_DIR.parent
WORKERS_DIR = BACKEND_DIR / "Workers"
USECASES_DIR = WORKERS_DIR / "usecases"


def enqueue_video_processing(video_upload_id: int):
    transaction.on_commit(
        lambda: PROCESSING_EXECUTOR.submit(process_video_upload, video_upload_id)
    )


def process_video_upload(video_upload_id: int):
    upload = (
        VideoUpload.objects
        .select_related("camera", "ml_model")
        .filter(pk=video_upload_id)
        .first()
    )
    if not upload:
        return

    try:
        import cv2
        from ultralytics import YOLO
    except Exception as exc:
        _mark_failed(upload, f"Missing video processing dependencies: {exc}")
        return

    try:
        _ensure_workers_import_path()
        from services.plate_recognition.pipeline import PlateRecognitionPipeline
        from violation.models import Violation
        from pipeline.models import Pipeline

        upload.status = VideoUpload.Status.PROCESSING
        upload.error_message = ""
        upload.progress_percent = Decimal("0.00")
        upload.processed_frames = 0
        upload.total_frames = None
        upload.violations_count = 0
        upload.started_at = timezone.now()
        upload.finished_at = None
        upload.use_case = _resolve_use_case(upload)
        upload.violations.all().delete()
        upload.save(
            update_fields=[
                "status",
                "error_message",
                "progress_percent",
                "processed_frames",
                "total_frames",
                "violations_count",
                "started_at",
                "finished_at",
                "use_case",
                "updated_at",
            ]
        )

        model_path = _resolve_model_path(upload.use_case)
        rules = _load_rules(upload.use_case)
        video_path = upload.file.path

        capture = cv2.VideoCapture(video_path)
        if not capture.isOpened():
            raise RuntimeError("Unable to open uploaded video file.")

        fps = capture.get(cv2.CAP_PROP_FPS) or 0.0
        total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        frame_width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        frame_height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        duration_seconds = (total_frames / fps) if fps and total_frames else None

        upload.fps = fps or None
        upload.total_frames = total_frames or None
        upload.frame_width = frame_width or None
        upload.frame_height = frame_height or None
        upload.duration_seconds = duration_seconds
        upload.save(
            update_fields=[
                "fps",
                "total_frames",
                "frame_width",
                "frame_height",
                "duration_seconds",
                "updated_at",
            ]
        )

        model = YOLO(str(model_path))
        plate_pipeline = PlateRecognitionPipeline()
        linked_pipeline = (
            Pipeline.objects
            .filter(camera=upload.camera, ml_model=upload.ml_model)
            .order_by("id")
            .first()
        )

        sample_every_n = _resolve_sample_interval(fps, upload.sample_fps)
        frame_index = -1
        sampled_frames = 0
        violation_count = 0
        last_violation_ms = -COOLDOWN_MS

        while True:
            ok, frame = capture.read()
            if not ok:
                break

            frame_index += 1
            if frame_index % sample_every_n != 0:
                continue

            sampled_frames += 1
            video_timestamp_ms = _resolve_timestamp_ms(frame_index, fps)

            results = model(frame)
            detections = _extract_detections(results, model, upload.ml_model.threshold_parameter)
            detected_labels = {item["label"] for item in detections}

            if video_timestamp_ms - last_violation_ms >= COOLDOWN_MS:
                for rule in rules:
                    if rule["required_labels"].issubset(detected_labels):
                        annotated_b64 = _encode_annotated_frame(results[0].plot())
                        plate_number = plate_pipeline.extract(frame)

                        violation = Violation(
                            pipeline=linked_pipeline,
                            camera=upload.camera,
                            ml_model=upload.ml_model,
                            video_upload=upload,
                            source_type=Violation.SourceType.UPLOAD,
                            frame_index=frame_index,
                            source_timestamp_ms=video_timestamp_ms,
                            violation_type=rule["violation_type"],
                            time=timezone.now(),
                            detections=detections,
                            plate_number=plate_number,
                        )
                        image_bytes = base64.b64decode(annotated_b64)
                        violation.frame_image.save(
                            f"{uuid4()}.jpg",
                            ContentFile(image_bytes),
                            save=False,
                        )
                        violation.save()

                        violation_count += 1
                        last_violation_ms = video_timestamp_ms
                        break

            progress = _calculate_progress(frame_index, total_frames)
            upload.processed_frames = sampled_frames
            upload.progress_percent = progress
            upload.violations_count = violation_count
            upload.save(
                update_fields=[
                    "processed_frames",
                    "progress_percent",
                    "violations_count",
                    "updated_at",
                ]
            )

        capture.release()

        upload.status = VideoUpload.Status.COMPLETED
        upload.progress_percent = Decimal("100.00")
        upload.violations_count = violation_count
        upload.finished_at = timezone.now()
        upload.save(
            update_fields=[
                "status",
                "progress_percent",
                "violations_count",
                "finished_at",
                "updated_at",
            ]
        )
    except Exception as exc:
        logger.exception("Video processing failed for upload %s", video_upload_id)
        _mark_failed(upload, str(exc))


def _mark_failed(upload: VideoUpload, error_message: str):
    upload.status = VideoUpload.Status.FAILED
    upload.error_message = error_message[:2000]
    upload.finished_at = timezone.now()
    upload.save(update_fields=["status", "error_message", "finished_at", "updated_at"])


def _ensure_workers_import_path():
    workers_path = str(WORKERS_DIR)
    if workers_path not in sys.path:
        sys.path.insert(0, workers_path)


def _resolve_use_case(upload: VideoUpload) -> str:
    from pipeline.models import Pipeline

    pipeline = (
        Pipeline.objects
        .filter(camera=upload.camera, ml_model=upload.ml_model)
        .order_by("id")
        .first()
    )
    if pipeline:
        return pipeline.use_case

    available = [
        path.name for path in USECASES_DIR.iterdir()
        if path.is_dir()
    ] if USECASES_DIR.exists() else []

    model_name = _normalize_use_case(upload.ml_model.name)
    for item in available:
        if item == model_name or item in model_name or model_name in item:
            return item

    if "helmet" in available:
        return "helmet"

    if available:
        return available[0]

    raise RuntimeError("No configured inference use cases were found.")


def _normalize_use_case(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def _resolve_model_path(use_case: str) -> Path:
    models_dir = USECASES_DIR / use_case / "models"
    if not models_dir.exists():
        raise FileNotFoundError(f"Models directory not found for use case '{use_case}'.")

    pt_files = sorted(models_dir.glob("*.pt"))
    if not pt_files:
        raise FileNotFoundError(f"No model file found for use case '{use_case}'.")

    return pt_files[0]


def _load_rules(use_case: str) -> list:
    rules_path = USECASES_DIR / use_case / "rules.py"
    if not rules_path.exists():
        return []

    spec = importlib.util.spec_from_file_location(f"{use_case}_rules", rules_path)
    if not spec or not spec.loader:
        return []
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return getattr(module, "VIOLATION_RULES", [])


def _resolve_sample_interval(video_fps: float, sample_fps: float) -> int:
    if not video_fps or video_fps <= 0:
        return 1
    if not sample_fps or sample_fps <= 0:
        return 1
    return max(1, int(round(video_fps / sample_fps)))


def _resolve_timestamp_ms(frame_index: int, fps: float) -> int:
    if fps and fps > 0:
        return int((frame_index / fps) * 1000)
    return frame_index * 1000


def _calculate_progress(frame_index: int, total_frames: int | None) -> Decimal:
    if not total_frames:
        return Decimal("0.00")
    ratio = min(100.0, ((frame_index + 1) / total_frames) * 100.0)
    return Decimal(f"{ratio:.2f}")


def _extract_detections(results, model, threshold: float) -> list:
    detections = []

    for box in results[0].boxes:
        conf = float(box.conf[0])
        if conf < threshold:
            continue

        cls = int(box.cls[0])
        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
        detections.append(
            {
                "label": model.names[cls],
                "class_id": cls,
                "confidence": round(conf, 3),
                "bbox": {
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                    "width": x2 - x1,
                    "height": y2 - y1,
                    "cx": (x1 + x2) // 2,
                    "cy": (y1 + y2) // 2,
                },
            }
        )

    return detections


def _encode_annotated_frame(annotated_frame) -> str:
    import cv2

    bgr = annotated_frame[..., ::-1]
    ok, buf = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
    if not ok:
        raise RuntimeError("Failed to encode annotated frame.")
    return base64.b64encode(buf).decode("utf-8")
