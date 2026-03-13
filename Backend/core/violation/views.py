from datetime import datetime
from calendar import monthrange
from django.db.models import Count
from django.db.models.functions import TruncDay
from django.utils import timezone
from rest_framework import status
from rest_framework.views       import APIView
from rest_framework.response    import Response
from rest_framework             import viewsets
from rest_framework.generics    import get_object_or_404
from rest_framework.pagination  import PageNumberPagination

from .models      import Violation
from .serializers import ViolationSerializer


# ── Custom Paginator ───────────────────────────────────────────────────────────
class ViolationPagination(PageNumberPagination):
    page_size             = 5
    page_size_query_param = 'page_size'
    max_page_size         = 100


# ── Base CRUD ──────────────────────────────────────────────────────────────────
class ViolationViewSet(viewsets.ModelViewSet):
    queryset         = Violation.objects.all().order_by('-time')
    serializer_class = ViolationSerializer
    pagination_class = ViolationPagination


# ── Analytics ──────────────────────────────────────────────────────────────────
class ViolationAnalyticsView(APIView):
    """GET /violations/analytics/"""

    def get(self, request):
        total_violations = Violation.objects.count()

        model_wise = (
            Violation.objects
            .values('ml_model__id', 'ml_model__name')
            .annotate(total=Count('id'))
            .order_by('-total')
        )

        # ── Label Analytics ──
        all_detections = (
            Violation.objects
            .exclude(detections=[])
            .values_list('detections', flat=True)
        )

        label_counts = {}

        for detection_list in all_detections:
            for det in detection_list:
                label = det.get('label', 'unknown')
                label_counts[label] = label_counts.get(label, 0) + 1

        top_labels = sorted(
            [{'label': k, 'count': v} for k, v in label_counts.items()],
            key=lambda x: x['count'],
            reverse=True
        )

        # ── Top Vehicles ──
        top_vehicles = (
            Violation.objects
            .exclude(plate_number__isnull=True)
            .exclude(plate_number="")
            .values('plate_number')
            .annotate(total=Count('id'))
            .order_by('-total')[:10]
        )

        return Response({
            'total_violations':         total_violations,
            'ml_model_wise_violations': list(model_wise),
            'top_detected_labels':      top_labels,
            'top_vehicles':             list(top_vehicles),
        })


# ── Monthly Trends ─────────────────────────────────────────────────────────────
class ViolationMonthlyTrendsView(APIView):
    """
    GET /violations/monthly-trends/<month_year>/
    Example: /violations/monthly-trends/February_2026/
    """

    def get(self, request, month_year):

        try:
            # Convert "February_2026" -> datetime
            month_date = datetime.strptime(month_year, "%B_%Y")

            start_of_month = month_date.replace(day=1).date()

            # Get last day of month
            last_day = monthrange(month_date.year, month_date.month)[1]
            end_of_month = month_date.replace(day=last_day).date()

        except ValueError:
            return Response(
                {"error": "Invalid format. Use Month_Year e.g. February_2026"},
                status=status.HTTP_400_BAD_REQUEST
            )

        daily_trends = (
            Violation.objects
            .filter(time__date__gte=start_of_month, time__date__lte=end_of_month)
            .annotate(day=TruncDay('time'))
            .values('day')
            .annotate(total=Count('id'))
            .order_by('day')
        )

        trends = [
            {
                'date': item['day'].strftime('%Y-%m-%d'),
                'day': item['day'].day,
                'total': item['total'],
            }
            for item in daily_trends
        ]

        return Response({
            'monthly_trends': trends,
            'current_month': start_of_month.strftime('%B %Y'),
        })


# ── Per-violation Detections ───────────────────────────────────────────────────
class ViolationDetectionsView(APIView):
    """GET /violations/<pk>/detections/"""

    def get(self, request, pk=None):

        violation = get_object_or_404(Violation, pk=pk)

        return Response({
            'violation_id':  violation.id,
            'time':          violation.time,
            'plate_number':  violation.plate_number,
            'detections':    violation.detections,
            'total_objects': len(violation.detections),
        })