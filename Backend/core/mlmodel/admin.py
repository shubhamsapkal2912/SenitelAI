from django.contrib import admin
from .models import MLModel

@admin.register(MLModel)
class MLModelAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'threshold_parameter')
    search_fields = ('name',)