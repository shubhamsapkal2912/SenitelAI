from django.db import models


class Violation(models.Model):

    pipeline = models.ForeignKey(
        'pipeline.Pipeline',
        on_delete=models.CASCADE,
        related_name='violations'
    )
    camera   = models.ForeignKey('camera.Camera', on_delete=models.CASCADE)
    ml_model = models.ForeignKey('mlmodel.MLModel', on_delete=models.CASCADE)

    violation_type = models.CharField(max_length=100)
    time           = models.DateTimeField()
    created_at     = models.DateTimeField(auto_now_add=True)

    frame_image = models.ImageField(
        upload_to='violations/%Y/%m/%d/',
        null=True,
        blank=True
    )

    # ✅ NEW FIELD
    plate_number = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        db_index=True
    )

    # YOLO detections
    detections = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"{self.violation_type} - {self.camera}"