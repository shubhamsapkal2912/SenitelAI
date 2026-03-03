from django.db import models

class Pipeline(models.Model):

    STATUS_CHOICES = (
        (True, "Active"),
        (False, "Inactive"),
    )

    ml_model = models.ForeignKey(
        'mlmodel.MLModel',
        on_delete=models.CASCADE,
        related_name='pipelines'
    )
    camera = models.ForeignKey(
        'camera.Camera',
        on_delete=models.CASCADE,
        related_name='pipelines'
    )

    status = models.BooleanField(
        choices=STATUS_CHOICES,
        default=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Pipeline - {self.ml_model.name} - {self.camera}"