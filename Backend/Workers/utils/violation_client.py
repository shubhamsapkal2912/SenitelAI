import os
import logging
import requests
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
BACKEND_URL = os.environ.get("DJANGO_API_URL", "http://localhost:8000") + "/api/violations/"

def send_violation(pipeline_id: int, camera_id: int, ml_model_id: int,
                   violation_type: str, frame_b64: str, detections: list):
    payload = {
        "pipeline":       pipeline_id,
        "camera":         camera_id,
        "ml_model":       ml_model_id,
        "violation_type": violation_type,
        "time":           datetime.now(timezone.utc).isoformat(),
        "frame_image":    frame_b64,
        "detections":     detections,
    }
    try:
        r = requests.post(BACKEND_URL, json=payload, timeout=5)
        logger.info(f"[Pipeline {pipeline_id}] Violation posted ({violation_type}): {r.status_code}")
        if r.status_code != 201:
            logger.error(f"[Pipeline {pipeline_id}] Error: {r.text}")
    except Exception as e:
        logger.error(f"[Pipeline {pipeline_id}] Violation API error: {e}")
