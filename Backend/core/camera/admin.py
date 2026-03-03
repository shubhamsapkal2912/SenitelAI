from django.contrib import admin
from .models import Camera


@admin.register(Camera)
class CameraAdmin(admin.ModelAdmin):
    list_display = ("name", "location", "status", "created_at")
    search_fields = ("name", "location")
    list_filter = ("status",)
