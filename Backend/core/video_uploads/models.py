from django.conf import settings
from django.db import models


class VideoUpload(models.Model):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        PROCESSING = "processing", "Processing"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    file = models.FileField(upload_to="video_uploads/%Y/%m/%d/")
    original_name = models.CharField(max_length=255)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="video_uploads",
    )
    camera = models.ForeignKey(
        "camera.Camera",
        on_delete=models.PROTECT,
        related_name="video_uploads",
    )
    ml_model = models.ForeignKey(
        "mlmodel.MLModel",
        on_delete=models.PROTECT,
        related_name="video_uploads",
    )
    use_case = models.CharField(max_length=100, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.QUEUED,
    )
    progress_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    processed_frames = models.PositiveIntegerField(default=0)
    total_frames = models.PositiveIntegerField(null=True, blank=True)
    sample_fps = models.FloatField(default=1.0)
    fps = models.FloatField(null=True, blank=True)
    duration_seconds = models.FloatField(null=True, blank=True)
    frame_width = models.PositiveIntegerField(null=True, blank=True)
    frame_height = models.PositiveIntegerField(null=True, blank=True)
    violations_count = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.original_name} [{self.status}]"

