from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MLModelViewSet

router = DefaultRouter()
router.register(r'mlmodels', MLModelViewSet, basename='mlmodel')

urlpatterns = [
    path('', include(router.urls)),
]