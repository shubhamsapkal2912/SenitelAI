from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    ViolationViewSet,
    ViolationAnalyticsView,
    ViolationMonthlyTrendsView,
    ViolationDetectionsView,
    ViolationCountStatsView,
    ViolationExcelExportView,
    ViolationPeriodReportView,
    ViolationModelAnalyticsView,   
    ViolationCameraWiseView,       
    ViolationLocationWiseView,    
)

router = DefaultRouter()
router.register(r"violations", ViolationViewSet, basename="violation")

urlpatterns = [
    # ── Analytics summary (supports ?month=March_2026) ──────────────────────
    path(
        "violations/analytics/",
        ViolationAnalyticsView.as_view(),
        name="violation-analytics",
    ),

   
    # GET /violations/analytics/model/<model_id>/?month=March_2026
    path(
        "violations/analytics/model/<int:model_id>/",
        ViolationModelAnalyticsView.as_view(),
        name="violation-model-analytics",
    ),

   
    # GET /violations/analytics/camera-wise/?cameras=1,2,3&month=March_2026
    path(
        "violations/analytics/camera-wise/",
        ViolationCameraWiseView.as_view(),
        name="violation-camera-wise",
    ),

   
    # GET /violations/analytics/location-wise/?month=March_2026&top=10
    path(
        "violations/analytics/location-wise/",
        ViolationLocationWiseView.as_view(),
        name="violation-location-wise",
    ),

    # ── Monthly trends ────────────────────────────────────────────────────────
    path(
        "violations/monthly-trends/<str:month_year>/",
        ViolationMonthlyTrendsView.as_view(),
        name="violation-monthly-trends",
    ),

    # ── Count stats ───────────────────────────────────────────────────────────
    path(
        "violations/count-stats/",
        ViolationCountStatsView.as_view(),
        name="violation-count-stats",
    ),

    # ── Excel export ──────────────────────────────────────────────────────────
    path(
        "violations/export/excel/",
        ViolationExcelExportView.as_view(),
        name="violation-export-excel",
    ),

    # ── Period report ─────────────────────────────────────────────────────────
    path(
        "violations/period-report/",
        ViolationPeriodReportView.as_view(),
        name="violation-period-report",
    ),

    # ── Per-violation detections ──────────────────────────────────────────────
    path(
        "violations/<int:pk>/detections/",
        ViolationDetectionsView.as_view(),
        name="violation-detections",
    ),

    # ── Router (always last) ──────────────────────────────────────────────────
    path("", include(router.urls)),
]
