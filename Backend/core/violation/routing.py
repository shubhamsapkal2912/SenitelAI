from django.urls import re_path
from .consumers import CameraFeedConsumer

websocket_urlpatterns = [
    re_path(r"ws/camera/(?P<camera_id>\d+)/$", CameraFeedConsumer.as_asgi()),
]
