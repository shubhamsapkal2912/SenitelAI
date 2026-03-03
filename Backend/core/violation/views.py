from django.db.models import Count
from django.db.models.functions import TruncDay
from django.utils import timezone

from rest_framework.views       import APIView
from rest_framework.response    import Response
from rest_framework             import viewsets
from rest_framework.generics    import get_object_or_404
from rest_framework.pagination  import PageNumberPagination

from .models      import Violation
from .serializers import ViolationSerializer


# ── Custom Paginator ───────────────────────────────────────────────────────────
class ViolationPagination(PageNumberPagination):
    page_size             = 5                    # default 5 per page
    page_size_query_param = 'page_size'          # allow ?page_size=10 override
    max_page_size         = 100


# ── Base CRUD ──────────────────────────────────────────────────────────────────
class ViolationViewSet(viewsets.ModelViewSet):
    queryset         = Violation.objects.all().order_by('-time')
    serializer_class = ViolationSerializer
    pagination_class = ViolationPagination       # ✅ attached here


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
            reverse=True,
        )

        return Response({
            'total_violations':         total_violations,
            'ml_model_wise_violations': list(model_wise),
            'top_detected_labels':      top_labels,
        })


# ── Monthly Trends ─────────────────────────────────────────────────────────────
class ViolationMonthlyTrendsView(APIView):
    """GET /violations/monthly-trends/"""

    def get(self, request):
        today          = timezone.now().date()
        start_of_month = today.replace(day=1)

        daily_trends = (
            Violation.objects
            .filter(time__date__gte=start_of_month)
            .annotate(day=TruncDay('time'))
            .values('day')
            .annotate(total=Count('id'))
            .order_by('day')
        )

        trends = [
            {
                'date':  item['day'].strftime('%Y-%m-%d'),
                'day':   item['day'].day,
                'total': item['total'],
            }
            for item in daily_trends
        ]

        return Response({
            'monthly_trends': trends,
            'current_month':  start_of_month.strftime('%B %Y'),
        })


# ── Per-violation Detections ───────────────────────────────────────────────────
class ViolationDetectionsView(APIView):
    """GET /violations/<pk>/detections/"""

    def get(self, request, pk=None):
        violation = get_object_or_404(Violation, pk=pk)
        return Response({
            'violation_id':  violation.id,
            'time':          violation.time,
            'detections':    violation.detections,
            'total_objects': len(violation.detections),
        })
