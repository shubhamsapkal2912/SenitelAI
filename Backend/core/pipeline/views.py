from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Pipeline
from .serializers import PipelineSerializer
from .services import publish_pipeline_command


class PipelineViewSet(viewsets.ModelViewSet):
    queryset         = Pipeline.objects.select_related('camera', 'ml_model').all()
    serializer_class = PipelineSerializer

    @action(detail=True, methods=['post'], url_path='start')
    def start(self, request, pk=None):
        pipeline = self.get_object()

        if pipeline.is_active:
            return Response(
                {'detail': 'Pipeline is already active.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            pipeline.is_active = True           # ✅ flip to True immediately
            pipeline.save()
            publish_pipeline_command('start', pipeline)
            return Response(PipelineSerializer(pipeline).data)
        except Exception as e:
            pipeline.is_active = False
            pipeline.save()
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='stop')
    def stop(self, request, pk=None):
        pipeline = self.get_object()

        if not pipeline.is_active:
            return Response(
                {'detail': 'Pipeline is already inactive.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            pipeline.is_active = False          # ✅ flip to False immediately
            pipeline.save()
            publish_pipeline_command('stop', pipeline)
            return Response(PipelineSerializer(pipeline).data)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_path='active')
    def active(self, request):
        qs = self.queryset.filter(is_active=True)       # ✅ simple boolean filter
        return Response(PipelineSerializer(qs, many=True).data)
