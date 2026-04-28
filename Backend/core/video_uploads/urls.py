from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import VideoUploadViewSet

router = DefaultRouter()
router.register(r"video-uploads", VideoUploadViewSet, basename="video-upload")

urlpatterns = [
    path("", include(router.urls)),
]

