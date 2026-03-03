import json
from channels.generic.websocket import AsyncWebsocketConsumer


class CameraFeedConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.camera_id  = self.scope['url_route']['kwargs']['camera_id']
        self.group_name = f"camera_{self.camera_id}"

        # Join camera group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()
        print(f"[WS] Client connected to camera {self.camera_id}")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )
        print(f"[WS] Client disconnected from camera {self.camera_id}")

    # ── Receive broadcast from channel layer ──────────────
    async def camera_frame(self, event):
        """Called by group_send with type='camera.frame'"""
        await self.send(text_data=json.dumps({
            "type":      "frame",
            "camera_id": event["camera_id"],
            "frame":     event["frame"],      # base64 JPEG string
        }))
