from django.contrib import admin

from .models import VideoUpload


@admin.register(VideoUpload)
class VideoUploadAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "original_name",
        "camera",
        "ml_model",
        "status",
        "violations_count",
        "created_at",
    )
    list_filter = ("status", "camera", "ml_model", "created_at")
    search_fields = ("original_name", "camera__name", "ml_model__name")
    readonly_fields = (
        "progress_percent",
        "processed_frames",
        "total_frames",
        "violations_count",
        "started_at",
        "finished_at",
        "created_at",
        "updated_at",
    )

