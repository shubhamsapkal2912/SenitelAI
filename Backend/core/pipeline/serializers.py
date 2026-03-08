from rest_framework import serializers
from .models import Pipeline

class PipelineSerializer(serializers.ModelSerializer):
    camera_name = serializers.CharField(source='camera.name', read_only=True)
    model_name  = serializers.CharField(source='ml_model.name', read_only=True)

    class Meta:
        model  = Pipeline
        fields = [
            'id', 'camera', 'camera_name',
            'ml_model', 'model_name',
            'use_case',
            'is_active', 'queue_name', 'created_at',
        ]
        read_only_fields = ['queue_name', 'created_at']

    def validate(self, data):
        camera = data.get('camera')
        ml_model = data.get('ml_model')

        qs = Pipeline.objects.filter(camera=camera, ml_model=ml_model)

        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise serializers.ValidationError(
                "Pipeline already exists for this camera and ML model."
            )

        return data
