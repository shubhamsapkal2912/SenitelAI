from rest_framework import serializers
from .models import Camera


class CameraSerializer(serializers.ModelSerializer):

    class Meta:
        model = Camera
        fields = "__all__"

    def validate_rtsp_url(self, value):
        if not value.startswith("rtsp://"):
            raise serializers.ValidationError(
                "RTSP URL must start with rtsp://"
            )
        return value
