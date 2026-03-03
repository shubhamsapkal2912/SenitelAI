from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ViolationViewSet,
    ViolationAnalyticsView,
    ViolationMonthlyTrendsView,
    ViolationDetectionsView,
)

router = DefaultRouter()
router.register(r'violations', ViolationViewSet, basename='violation')

urlpatterns = [
    # ⚠️ Specific paths MUST come before router.urls
    # to prevent <pk> from swallowing "analytics" / "monthly-trends"
    path('violations/analytics/',           ViolationAnalyticsView.as_view(),     name='violation-analytics'),
    path('violations/monthly-trends/',      ViolationMonthlyTrendsView.as_view(), name='violation-monthly-trends'),
    path('violations/<int:pk>/detections/', ViolationDetectionsView.as_view(),    name='violation-detections'),

    path('', include(router.urls)),
]
