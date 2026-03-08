from django.urls import path
from .views import (
    CameraListCreateAPIView,
    CameraDetailAPIView,
    ActiveCameraAPIView
)

urlpatterns = [
    path("cameras/", CameraListCreateAPIView.as_view(), name="camera-list"),
    path("cameras/<int:pk>/", CameraDetailAPIView.as_view(), name="camera-detail"),
    path("cameras/active/", ActiveCameraAPIView.as_view(), name="active-cameras"),
]