import os
import sys
import django


sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'core'))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()


import pika
import json
import base64
import subprocess
import threading
import time
import logging
import numpy as np
import cv2
import requests
from datetime import datetime, timezone
from ultralytics import YOLO
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


RABBITMQ_URL     = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
BACKEND_URL      = os.environ.get("DJANGO_API_URL", "http://localhost:8000") + "/api/violations/"
COOLDOWN_SECONDS = 10
FRAME_SKIP       = 3


channel_layer = get_channel_layer()


# ── Violation Rules ─────────────────────────────────────────
# Add or remove rules here without touching any other logic.
# Each rule needs ALL labels in `required_labels` to be present
# in a single frame to trigger a violation.

VIOLATION_RULES = [
    {
        "violation_type": "no_helmet",
        "required_labels": {"person", "motorcycle"},
    },
    {
        "violation_type": "heavy_vehicle_violation",
        "required_labels": {"bus"},
    },
    {
        "violation_type": "heavy_vehicle_violation",
        "required_labels": {"truck"},
    },
]


# ── Shared helpers ──────────────────────────────────────────


def decode_h264_annexb(b64_str: str):
    raw = base64.b64decode(b64_str)
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-f", "h264", "-i", "pipe:0",
        "-frames:v", "1",
        "-f", "image2", "-vcodec", "mjpeg", "-q:v", "2",
        "pipe:1",
    ]
    try:
        result = subprocess.run(cmd, input=raw, capture_output=True, timeout=5)
        if result.returncode == 0 and result.stdout:
            arr = np.frombuffer(result.stdout, np.uint8)
            return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except Exception as e:
        logger.error(f"[Decode] {e}")
    return None


def encode_annotated_frame(annotated_frame) -> str:
    bgr = annotated_frame[..., ::-1]
    _, buf = cv2.imencode('.jpg', bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return base64.b64encode(buf).decode('utf-8')


def broadcast_frame(camera_id: int, frame_b64: str):
    try:
        async_to_sync(channel_layer.group_send)(
            f"camera_{camera_id}",
            {"type": "camera.frame", "camera_id": camera_id, "frame": frame_b64},
        )
    except Exception as e:
        logger.warning(f"[WS] camera {camera_id}: {e}")


# ── One worker thread per pipeline ─────────────────────────


class PipelineWorker:
    def __init__(self, pipeline_id: int, camera_id: int, ml_model_id: int,
                 queue_name: str, model_file: str, threshold: float):
        self.pipeline_id  = pipeline_id
        self.camera_id    = camera_id
        self.ml_model_id  = ml_model_id
        self.queue_name   = queue_name
        self.model_file   = model_file
        self.threshold    = threshold
        self.stop_event   = threading.Event()
        self.thread       = threading.Thread(target=self._run, daemon=True)
        self.last_violation_time = 0.0
        self.frame_counter       = 0


    def start(self):
        self.thread.start()
        logger.info(f"[Worker] Pipeline {self.pipeline_id} started | "
                    f"model={self.model_file} threshold={self.threshold}")


    def stop(self):
        self.stop_event.set()


    def _run(self):
        model = YOLO(self.model_file)

        conn = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
        ch   = conn.channel()
        ch.queue_declare(queue=self.queue_name, durable=True)
        ch.basic_qos(prefetch_count=1)

        def callback(ch, method, properties, body):
            if self.stop_event.is_set():
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
                ch.stop_consuming()
                return
            try:
                self._process(ch, method, body, model)
            except Exception as e:
                logger.error(f"[Pipeline {self.pipeline_id}] Error: {e}")
                ch.basic_ack(delivery_tag=method.delivery_tag)

        ch.basic_consume(queue=self.queue_name, on_message_callback=callback, auto_ack=False)
        ch.start_consuming()
        conn.close()


    def _process(self, ch, method, body, model):
        message = json.loads(body)

        frame = decode_h264_annexb(message["frame"])
        if frame is None:
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        results    = model(frame)
        detections = self._extract_detections(results, model)

        # Annotate and broadcast frame
        annotated_b64 = encode_annotated_frame(results[0].plot())
        self.frame_counter += 1
        if self.frame_counter % FRAME_SKIP == 0:
            broadcast_frame(self.camera_id, annotated_b64)

        # Build a set of all detected labels for fast rule matching
        detected_labels = {d["label"] for d in detections}

        # Cooldown check — skip violation processing if within cooldown window
        now = time.time()
        if now - self.last_violation_time < COOLDOWN_SECONDS:
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        # Evaluate each violation rule
        for rule in VIOLATION_RULES:
            if rule["required_labels"].issubset(detected_labels):
                self._send_violation(annotated_b64, detections, rule["violation_type"])
                self.last_violation_time = now
                break  # One violation per cooldown window; remove `break` to fire all matching rules

        ch.basic_ack(delivery_tag=method.delivery_tag)


    def _extract_detections(self, results, model) -> list:
        detections = []
        for box in results[0].boxes:
            conf = float(box.conf[0])
            if conf < self.threshold:
                continue
            cls  = int(box.cls[0])
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            detections.append({
                "label":      model.names[cls],
                "class_id":   cls,
                "confidence": round(conf, 3),
                "bbox": {
                    "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                    "width":  x2 - x1, "height": y2 - y1,
                    "cx": (x1 + x2) // 2, "cy": (y1 + y2) // 2,
                },
            })
        return detections


    def _send_violation(self, frame_b64: str, detections: list, violation_type: str):
        payload = {
            "pipeline":       self.pipeline_id,
            "camera":         self.camera_id,
            "ml_model":       self.ml_model_id,
            "violation_type": violation_type,          # ✅ dynamic — not hardcoded
            "time":           datetime.now(timezone.utc).isoformat(),
            "frame_image":    frame_b64,
            "detections":     detections,
        }
        try:
            r = requests.post(BACKEND_URL, json=payload, timeout=5)
            logger.info(f"[Pipeline {self.pipeline_id}] Violation posted ({violation_type}): {r.status_code}")
            if r.status_code != 201:
                logger.error(f"[Pipeline {self.pipeline_id}] Error: {r.text}")
        except Exception as e:
            logger.error(f"[Pipeline {self.pipeline_id}] Violation API error: {e}")


# ── Manager: listens on pipeline_control ───────────────────


class WorkerManager:
    def __init__(self):
        self.workers: dict[int, PipelineWorker] = {}


    def _start(self, cmd: dict):
        pid = cmd["pipeline_id"]
        if pid in self.workers:
            logger.warning(f"[Manager] Pipeline {pid} worker already running")
            return
        worker = PipelineWorker(
            pipeline_id=pid,
            camera_id=cmd["camera_id"],
            ml_model_id=cmd["ml_model_id"],
            queue_name=cmd["queue_name"],
            model_file=cmd["model_file"],
            threshold=cmd["threshold_parameter"],
        )
        self.workers[pid] = worker
        self._update_status(pid, True) 
        worker.start()


    def _stop(self, cmd: dict):
        pid    = cmd["pipeline_id"]
        worker = self.workers.pop(pid, None)
        if worker:
            worker.stop()
            self._update_status(pid, False)


    def _update_status(self, pipeline_id: int, is_active: bool):
        try:
            requests.patch(
                f"{os.environ.get('DJANGO_API_URL', 'http://localhost:8000')}"
                f"/api/pipelines/{pipeline_id}/",
                json={"is_active": is_active}, 
                timeout=3,
            )
        except Exception as e:
            logger.warning(f"[Manager] Status update failed for pipeline {pipeline_id}: {e}")


    def listen(self):
        conn = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
        ch   = conn.channel()

        ch.exchange_declare(
            exchange="pipeline_control",
            exchange_type="fanout",
            durable=True,
        )

        ch.queue_declare(
            queue="pipeline_control.workers",
            durable=True,
        )

        ch.queue_bind(
            exchange="pipeline_control",
            queue="pipeline_control.workers",
        )

        def on_command(ch, method, properties, body):
            cmd = json.loads(body)
            if cmd.get("action") == "start":
                self._start(cmd)
            elif cmd.get("action") == "stop":
                self._stop(cmd)
            ch.basic_ack(delivery_tag=method.delivery_tag)

        ch.basic_consume(
            queue="pipeline_control.workers",
            on_message_callback=on_command,
            auto_ack=False,
        )
        logger.info("[Manager] Ready. Waiting for pipeline commands...")
        ch.start_consuming()


if __name__ == "__main__":
    WorkerManager().listen()
