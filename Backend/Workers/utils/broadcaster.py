import logging
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)
channel_layer = get_channel_layer()

def broadcast_frame(camera_id: int, frame_b64: str):
    try:
        async_to_sync(channel_layer.group_send)(
            f"camera_{camera_id}",
            {"type": "camera.frame", "camera_id": camera_id, "frame": frame_b64},
        )
    except Exception as e:
        logger.warning(f"[WS] camera {camera_id}: {e}")
