from django.urls import path
from .views import (
    AllCameraAPIView,
    CameraListCreateAPIView,
    CameraDetailAPIView,
    ActiveCameraAPIView,
    TotalCameraStatusAPIView
)

urlpatterns = [
    path("cameras/", CameraListCreateAPIView.as_view(), name="camera-list"),
    path("cameras/<int:pk>/", CameraDetailAPIView.as_view(), name="camera-detail"),
    path("cameras/active/", ActiveCameraAPIView.as_view(), name="active-cameras"),
    path("cameras/all/", AllCameraAPIView.as_view(), name="all-cameras"),
    path("cameras/status/", TotalCameraStatusAPIView.as_view(), name="camera-status"),
]