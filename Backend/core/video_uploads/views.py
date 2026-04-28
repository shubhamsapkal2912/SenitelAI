from decimal import Decimal
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from violation.serializers import ViolationSerializer
from violation.views import ViolationPagination

from .models import VideoUpload
from .serializers import VideoUploadSerializer
from .services import enqueue_video_processing


class VideoUploadViewSet(viewsets.ModelViewSet):
    queryset = VideoUpload.objects.select_related("camera", "ml_model").all()
    serializer_class = VideoUploadSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    http_method_names = ["get", "post", "head", "options"]
    pagination_class = ViolationPagination

    def get_queryset(self):
        queryset = self.queryset
        search = self.request.query_params.get("search", "").strip()
        status_filter = self.request.query_params.get("status", "").strip()

        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if search:
            queryset = queryset.filter(
                Q(original_name__icontains=search)
                | Q(camera__name__icontains=search)
                | Q(ml_model__name__icontains=search)
                | Q(use_case__icontains=search)
                | Q(status__icontains=search)
            )

        return queryset

    def perform_create(self, serializer):
        upload = serializer.save()
        enqueue_video_processing(upload.pk)

    @action(detail=True, methods=["post"], url_path="retry")
    def retry(self, request, pk=None):
        upload = self.get_object()
        upload.status = VideoUpload.Status.QUEUED
        upload.error_message = ""
        upload.progress_percent = Decimal("0.00")
        upload.processed_frames = 0
        upload.total_frames = None
        upload.violations_count = 0
        upload.started_at = None
        upload.finished_at = None
        upload.save(
            update_fields=[
                "status",
                "error_message",
                "progress_percent",
                "processed_frames",
                "total_frames",
                "violations_count",
                "started_at",
                "finished_at",
                "updated_at",
            ]
        )
        enqueue_video_processing(upload.pk)
        return Response(self.get_serializer(upload).data, status=status.HTTP_202_ACCEPTED)

    @action(detail=True, methods=["get"], url_path="violations")
    def violations(self, request, pk=None):
        upload = self.get_object()
        queryset = upload.violations.select_related("camera", "ml_model").order_by("-time")
        paginator = ViolationPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = ViolationSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)
