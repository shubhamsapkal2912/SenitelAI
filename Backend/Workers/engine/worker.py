import json
import time
import threading
import logging
import pika

from ultralytics import YOLO

from utils.decoder import decode_h264_annexb
from utils.encoder import encode_annotated_frame
from utils.broadcaster import broadcast_frame
from utils.violation_client import send_violation

from services.plate_recognition.pipeline import PlateRecognitionPipeline

logger = logging.getLogger(__name__)

RABBITMQ_URL     = __import__('os').environ.get(
    "RABBITMQ_URL",
    "amqp://guest:guest@localhost:5672/"
)

COOLDOWN_SECONDS = 10
FRAME_SKIP       = 3


class PipelineWorker:

    def __init__(
        self,
        pipeline_id: int,
        camera_id: int,
        ml_model_id: int,
        queue_name: str,
        model_file: str,
        threshold: float,
        violation_rules: list,
    ):

        self.pipeline_id     = pipeline_id
        self.camera_id       = camera_id
        self.ml_model_id     = ml_model_id
        self.queue_name      = queue_name
        self.model_file      = model_file
        self.threshold       = threshold
        self.violation_rules = violation_rules

        self.stop_event = threading.Event()
        self.thread     = threading.Thread(target=self._run, daemon=True)

        self.last_violation_time = 0.0
        self.frame_counter       = 0

        # shared plate recognition service
        self.plate_pipeline = PlateRecognitionPipeline()

    def start(self):
        self.thread.start()

        logger.info(
            f"[Worker] Pipeline {self.pipeline_id} started | "
            f"model={self.model_file} threshold={self.threshold}"
        )

    def stop(self):
        self.stop_event.set()

    def _run(self):

        model = YOLO(self.model_file)

        conn = pika.BlockingConnection(
            pika.URLParameters(RABBITMQ_URL)
        )

        ch = conn.channel()

        ch.queue_declare(
            queue=self.queue_name,
            durable=True
        )

        ch.basic_qos(prefetch_count=1)

        def callback(ch, method, properties, body):

            if self.stop_event.is_set():
                ch.basic_nack(
                    delivery_tag=method.delivery_tag,
                    requeue=True
                )
                ch.stop_consuming()
                return

            try:
                self._process(ch, method, body, model)

            except Exception as e:
                logger.error(
                    f"[Pipeline {self.pipeline_id}] Error: {e}"
                )
                ch.basic_ack(
                    delivery_tag=method.delivery_tag
                )

        ch.basic_consume(
            queue=self.queue_name,
            on_message_callback=callback,
            auto_ack=False
        )

        ch.start_consuming()
        conn.close()

    def _process(self, ch, method, body, model):

        message = json.loads(body)

        frame = decode_h264_annexb(message["frame"])

        if frame is None:
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        results = model(frame)

        detections = self._extract_detections(results, model)

        annotated_frame = results[0].plot()

        annotated_b64 = encode_annotated_frame(
            annotated_frame
        )

        # broadcast frames
        self.frame_counter += 1

        if self.frame_counter % FRAME_SKIP == 0:
            broadcast_frame(
                self.camera_id,
                annotated_b64
            )

        detected_labels = {
            d["label"] for d in detections
        }

        now = time.time()

        if now - self.last_violation_time < COOLDOWN_SECONDS:
            ch.basic_ack(
                delivery_tag=method.delivery_tag
            )
            return

        for rule in self.violation_rules:

            if rule["required_labels"].issubset(
                detected_labels
            ):
                logger.info(
                f"[Pipeline {self.pipeline_id}] Running plate detection..."
                )

        # run plate detection + OCR
                plate_number = self.plate_pipeline.extract(frame)

                logger.info(
                f"[Pipeline {self.pipeline_id}] Plate detected: {plate_number}"
                )
                # plate recognition happens ONLY on violation
                plate_number = self.plate_pipeline.extract(
                    frame
                )

                send_violation(
                    self.pipeline_id,
                    self.camera_id,
                    self.ml_model_id,
                    rule["violation_type"],
                    annotated_b64,
                    detections,
                    plate_number,
                )

                self.last_violation_time = now
                break

        ch.basic_ack(
            delivery_tag=method.delivery_tag
        )

    def _extract_detections(self, results, model):

        detections = []

        for box in results[0].boxes:

            conf = float(box.conf[0])

            if conf < self.threshold:
                continue

            cls = int(box.cls[0])

            x1, y1, x2, y2 = map(
                int,
                box.xyxy[0].tolist()
            )

            detections.append({
                "label": model.names[cls],
                "class_id": cls,
                "confidence": round(conf, 3),
                "bbox": {
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                    "width":  x2 - x1,
                    "height": y2 - y1,
                    "cx": (x1 + x2) // 2,
                    "cy": (y1 + y2) // 2,
                },
            })

        return detections