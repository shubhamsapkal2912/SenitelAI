import base64
import subprocess
import numpy as np
import cv2
import logging

logger = logging.getLogger(__name__)

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
