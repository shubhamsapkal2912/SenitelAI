import os
import sys
import django

# ✅ Workers/ is at Backend/Workers/
# Django project (manage.py) is at Backend/core/
# So we add Backend/core/ to sys.path so Python can find the 'core' package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'core'))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()


import pika
import json
import base64
import subprocess
import numpy as np
import cv2
import requests
import time
from datetime import datetime, timezone
from ultralytics import YOLO

from channels.layers  import get_channel_layer
from asgiref.sync     import async_to_sync

RABBITMQ_HOST    = "localhost"
QUEUE_NAME       = "frames"
BACKEND_URL      = "http://localhost:8000/api/violations/"
ML_MODEL_ID      = 2
CONF_THRESHOLD   = 0.5
COOLDOWN_SECONDS = 10
FRAME_SKIP       = 3        # broadcast every Nth frame to reduce load

print("Loading YOLO model...")
model        = YOLO("yolov8n.pt")
channel_layer = get_channel_layer()
print("Model loaded.")

last_violation_time = {}
frame_counter       = {}    # per-camera frame counter for skip logic


# ── Broadcast frame to Django Channels ────────────────────
def broadcast_frame(camera_id: int, frame_b64: str):
    """Push base64 JPEG frame to all Angular clients watching this camera."""
    try:
        async_to_sync(channel_layer.group_send)(
            f"camera_{camera_id}",
            {
                "type":      "camera.frame",   # maps to camera_frame() in consumer
                "camera_id": camera_id,
                "frame":     frame_b64,
            }
        )
    except Exception as e:
        print(f"[WS Broadcast Error] camera {camera_id}: {e}")


# ── Encode raw BGR frame as base64 JPEG ───────────────────
def encode_frame(frame):
    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
    return base64.b64encode(buffer).decode('utf-8')


def decode_h264_annexb(b64_str):
    raw = base64.b64decode(b64_str)
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-f", "h264", "-i", "pipe:0",
        "-frames:v", "1",
        "-f", "image2", "-vcodec", "mjpeg", "-q:v", "2",
        "pipe:1"
    ]
    try:
        result = subprocess.run(cmd, input=raw, capture_output=True, timeout=5)
        if result.returncode == 0 and result.stdout:
            arr   = np.frombuffer(result.stdout, np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            return frame
        else:
            print("ffmpeg stderr:", result.stderr.decode()[:200])
    except Exception as e:
        print(f"Decode error: {e}")
    return None


def encode_annotated_frame(annotated_frame):
    bgr_frame = annotated_frame[..., ::-1]
    _, buffer = cv2.imencode('.jpg', bgr_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return base64.b64encode(buffer).decode('utf-8')


def extract_detections(results):
    detections = []
    for box in results[0].boxes:
        cls  = int(box.cls[0])
        conf = float(box.conf[0])
        if conf < CONF_THRESHOLD:
            continue
        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
        label = model.names[cls]
        detections.append({
            "label":      label,
            "class_id":   cls,
            "confidence": round(conf, 3),
            "bbox": {
                "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                "width":  x2 - x1, "height": y2 - y1,
                "cx": (x1 + x2) // 2, "cy": (y1 + y2) // 2,
            }
        })
    return detections


def send_violation(pipeline_id, camera_id, frame_b64=None, detections=None):
    payload = {
        "pipeline":       pipeline_id,
        "camera":         camera_id,
        "ml_model":       ML_MODEL_ID,
        "violation_type": "no_helmet",
        "time":           datetime.now(timezone.utc).isoformat(),
        "frame_image":    frame_b64,
        "detections":     detections or [],
    }
    try:
        r = requests.post(BACKEND_URL, json=payload)
        print("Violation API Response:", r.status_code)
        if r.status_code != 201:
            print("Response body:", r.text)
    except Exception as e:
        print("Error sending violation:", e)


def callback(ch, method, properties, body):
    try:
        message     = json.loads(body)
        pipeline_id = message.get("pipeline_id", 1)
        camera_id   = message.get("camera_id", 1)

        # ── Decode frame ───────────────────────────────────
        frame = decode_h264_annexb(message["frame"])
        if frame is None:
            print("Failed to decode frame, skipping")
            ch.basic_ack(delivery_tag=method.delivery_tag)
            return

        # ── Run YOLO ───────────────────────────────────────
        results    = model(frame)
        detections = extract_detections(results)

        person_detected     = False
        motorcycle_detected = False

        for det in detections:
            if det["class_id"] == 0: person_detected     = True
            if det["class_id"] == 2: motorcycle_detected = True

        # ── Get annotated frame ────────────────────────────
        annotated_frame = results[0].plot()
        frame_b64       = encode_annotated_frame(annotated_frame)

        # ── Broadcast every Nth frame to Angular via WS ───
        frame_counter[camera_id] = frame_counter.get(camera_id, 0) + 1
        if frame_counter[camera_id] % FRAME_SKIP == 0:
            broadcast_frame(camera_id, frame_b64)           # ✅ live stream

        # ── Violation logic ────────────────────────────────
        if person_detected and motorcycle_detected:
            now = time.time()
            if now - last_violation_time.get(camera_id, 0) < COOLDOWN_SECONDS:
                print(f"  Cooldown active for camera {camera_id}, skipping")
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return

            print("Helmet violation detected — sending with annotated frame")
            send_violation(pipeline_id, camera_id, frame_b64, detections)
            last_violation_time[camera_id] = now

        ch.basic_ack(delivery_tag=method.delivery_tag)

    except Exception as e:
        print(f"Error processing message: {e}")
        ch.basic_ack(delivery_tag=method.delivery_tag)


print("Connecting to RabbitMQ...")
connection = pika.BlockingConnection(pika.ConnectionParameters(host=RABBITMQ_HOST))
channel    = connection.channel()
channel.basic_qos(prefetch_count=1)
channel.queue_declare(queue=QUEUE_NAME, durable=True)
channel.basic_consume(queue=QUEUE_NAME, on_message_callback=callback, auto_ack=False)
print("Inference Worker Started...")
channel.start_consuming()
