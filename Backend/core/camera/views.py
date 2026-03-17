from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Camera
from .serializers import CameraSerializer
from .pagination import CameraPagination


class CameraListCreateAPIView(generics.ListCreateAPIView):
    queryset = Camera.objects.all()
    serializer_class = CameraSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = CameraPagination

    def create(self, request, *args, **kwargs):
        is_many = isinstance(request.data, list)

        serializer = self.get_serializer(data=request.data, many=is_many)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CameraDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Camera.objects.all()
    serializer_class = CameraSerializer
    permission_classes = [IsAuthenticated]

class AllCameraAPIView(generics.ListAPIView):
    serializer_class = CameraSerializer
    permission_classes = [IsAuthenticated]
    queryset = Camera.objects.all()

class ActiveCameraAPIView(generics.ListAPIView):
    serializer_class = CameraSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Camera.objects.filter(status="active")