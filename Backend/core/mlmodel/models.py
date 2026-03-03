from django.db import models

class MLModel(models.Model):
    name = models.CharField(max_length=255)
    threshold_parameter = models.FloatField()

    def __str__(self):
        return self.name