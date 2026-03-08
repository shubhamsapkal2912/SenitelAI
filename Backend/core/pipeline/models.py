from django.db import models

class Pipeline(models.Model):
    ml_model   = models.ForeignKey('mlmodel.MLModel', on_delete=models.CASCADE, related_name='pipelines')
    camera     = models.ForeignKey('camera.Camera', on_delete=models.CASCADE, related_name='pipelines')
    use_case   = models.CharField(max_length=100, default="helmet")
    is_active  = models.BooleanField(default=False)
    queue_name = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['camera', 'ml_model'],
                name='unique_camera_mlmodel_pipeline'
            )
        ]

    def save(self, *args, **kwargs):
        if not self.pk:
            super().save(*args, **kwargs)
            Pipeline.objects.filter(pk=self.pk).update(
                queue_name=f"frames.pipeline.{self.pk}"
            )
            self.queue_name = f"frames.pipeline.{self.pk}"
        else:
            super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.use_case} — {self.camera} [{'active' if self.is_active else 'inactive'}]"