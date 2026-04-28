from django.db import models


class Violation(models.Model):
    class SourceType(models.TextChoices):
        CAMERA = "camera", "Camera"
        UPLOAD = "upload", "Upload"

    pipeline = models.ForeignKey(
        'pipeline.Pipeline',
        on_delete=models.CASCADE,
        related_name='violations',
        null=True,
        blank=True,
    )
    camera   = models.ForeignKey('camera.Camera', on_delete=models.CASCADE)
    ml_model = models.ForeignKey('mlmodel.MLModel', on_delete=models.CASCADE)
    video_upload = models.ForeignKey(
        'video_uploads.VideoUpload',
        on_delete=models.CASCADE,
        related_name='violations',
        null=True,
        blank=True
    )

    source_type = models.CharField(
        max_length=10,
        choices=SourceType.choices,
        default=SourceType.CAMERA
    )
    frame_index = models.PositiveIntegerField(null=True, blank=True)
    source_timestamp_ms = models.PositiveBigIntegerField(null=True, blank=True)

    violation_type = models.CharField(max_length=100)
    time           = models.DateTimeField()
    created_at     = models.DateTimeField(auto_now_add=True)

    frame_image = models.ImageField(
        upload_to='violations/%Y/%m/%d/',
        null=True,
        blank=True
    )

    
    plate_number = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        db_index=True
    )

    # YOLO detections
    detections = models.JSONField(default=list, blank=True)

    def __str__(self):
        source = self.video_upload_id or self.camera_id
        return f"{self.violation_type} - {source}"
