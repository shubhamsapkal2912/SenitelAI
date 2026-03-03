from rest_framework import viewsets
from .models import Pipeline
from .serializers import PipelineSerializer

class PipelineViewSet(viewsets.ModelViewSet):
    queryset = Pipeline.objects.all()
    serializer_class = PipelineSerializer