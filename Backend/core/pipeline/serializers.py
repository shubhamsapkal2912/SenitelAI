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
            'use_case',                          # ✅ added
            'is_active', 'queue_name', 'created_at',
        ]
        read_only_fields = ['queue_name', 'created_at']
