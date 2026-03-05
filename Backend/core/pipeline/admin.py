from django.contrib import admin
from .models import Pipeline

@admin.register(Pipeline)
class PipelineAdmin(admin.ModelAdmin):
    list_display = ('id', 'ml_model', 'camera', 'is_active', 'created_at')
    list_filter = ('is_active', 'ml_model', 'camera')