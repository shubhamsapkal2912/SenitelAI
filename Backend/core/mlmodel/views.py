from rest_framework import viewsets
from .models import MLModel
from .serializers import MLModelSerializer

class MLModelViewSet(viewsets.ModelViewSet):
    queryset = MLModel.objects.all()
    serializer_class = MLModelSerializer