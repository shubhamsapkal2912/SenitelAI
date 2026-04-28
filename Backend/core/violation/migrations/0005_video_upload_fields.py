from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("video_uploads", "0001_initial"),
        ("violation", "0004_violation_plate_number"),
    ]

    operations = [
        migrations.AlterField(
            model_name="violation",
            name="pipeline",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="violations", to="pipeline.pipeline"),
        ),
        migrations.AddField(
            model_name="violation",
            name="frame_index",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="violation",
            name="source_timestamp_ms",
            field=models.PositiveBigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="violation",
            name="source_type",
            field=models.CharField(choices=[("camera", "Camera"), ("upload", "Upload")], default="camera", max_length=10),
        ),
        migrations.AddField(
            model_name="violation",
            name="video_upload",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="violations", to="video_uploads.videoupload"),
        ),
    ]
