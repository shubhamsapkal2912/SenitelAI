from django.db import models

class MLModel(models.Model):
    name                = models.CharField(max_length=255)
    model_file          = models.FileField(upload_to='ml_models/')  # stores yolov8n.pt etc.
    threshold_parameter = models.FloatField(default=0.5)

    def __str__(self):
        return self.name
