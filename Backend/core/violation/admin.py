from django.contrib import admin
from .models import Violation

@admin.register(Violation)
class ViolationAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'violation_type',
        'camera',
        'ml_model',
        'time'
    )
    list_filter = ('violation_type', 'camera', 'ml_model')