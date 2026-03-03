from django.contrib import admin
from .models import Pipeline

@admin.register(Pipeline)
class PipelineAdmin(admin.ModelAdmin):
    list_display = ('id', 'ml_model', 'camera', 'status', 'created_at')
    list_filter = ('status', 'ml_model', 'camera')