from rest_framework import serializers
from drf_extra_fields.fields import Base64ImageField
from .models import Violation


class BBoxSerializer(serializers.Serializer):
    x1     = serializers.IntegerField()
    y1     = serializers.IntegerField()
    x2     = serializers.IntegerField()
    y2     = serializers.IntegerField()
    width  = serializers.IntegerField()
    height = serializers.IntegerField()
    cx     = serializers.IntegerField()
    cy     = serializers.IntegerField()


class DetectionSerializer(serializers.Serializer):
    label        = serializers.CharField()
    class_id     = serializers.IntegerField()
    confidence   = serializers.FloatField()
    bbox         = BBoxSerializer()
    


class ViolationSerializer(serializers.ModelSerializer):
    frame_image = Base64ImageField(required=False, allow_null=True)

    # optional plate number extracted by worker
    plate_number = serializers.CharField(required=False, allow_null=True)

    # YOLO detections
    detections = DetectionSerializer(
        many=True,
        required=False,
        default=list
    )

    class Meta:
        model  = Violation
        fields = "__all__"

    def validate(self, data):
        pipeline = data.get("pipeline")

        if pipeline and not pipeline.is_active:
            raise serializers.ValidationError(
                "Violation cannot be created because the pipeline is not active."
            )

        return data