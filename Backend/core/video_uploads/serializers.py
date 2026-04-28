from rest_framework import serializers

from .models import VideoUpload


class VideoUploadSerializer(serializers.ModelSerializer):
    camera_name = serializers.CharField(source="camera.name", read_only=True)
    model_name = serializers.CharField(source="ml_model.name", read_only=True)
    violation_results_url = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = VideoUpload
        fields = [
            "id",
            "file",
            "file_url",
            "original_name",
            "camera",
            "camera_name",
            "ml_model",
            "model_name",
            "use_case",
            "status",
            "progress_percent",
            "processed_frames",
            "total_frames",
            "sample_fps",
            "fps",
            "duration_seconds",
            "frame_width",
            "frame_height",
            "violations_count",
            "error_message",
            "started_at",
            "finished_at",
            "created_at",
            "updated_at",
            "violation_results_url",
        ]
        read_only_fields = [
            "original_name",
            "use_case",
            "status",
            "progress_percent",
            "processed_frames",
            "total_frames",
            "fps",
            "duration_seconds",
            "frame_width",
            "frame_height",
            "violations_count",
            "error_message",
            "started_at",
            "finished_at",
            "created_at",
            "updated_at",
            "violation_results_url",
            "file_url",
        ]

    def validate_file(self, value):
        allowed_extensions = (".mp4", ".avi", ".mov", ".mkv", ".mpeg", ".mpg")
        lower_name = value.name.lower()
        if not lower_name.endswith(allowed_extensions):
            raise serializers.ValidationError("Upload a supported video file.")
        return value

    def create(self, validated_data):
        validated_data["original_name"] = validated_data["file"].name
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data["uploaded_by"] = request.user
        return super().create(validated_data)

    def get_violation_results_url(self, obj):
        request = self.context.get("request")
        if not request:
            return f"/api/video-uploads/{obj.pk}/violations/"
        return request.build_absolute_uri(f"/api/video-uploads/{obj.pk}/violations/")

    def get_file_url(self, obj):
        request = self.context.get("request")
        if not obj.file:
            return None
        if request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url

