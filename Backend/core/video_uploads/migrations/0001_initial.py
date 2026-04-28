from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("camera", "0003_alter_camera_rtsp_url"),
        ("mlmodel", "0003_remove_mlmodel_model_file"),
    ]

    operations = [
        migrations.CreateModel(
            name="VideoUpload",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file", models.FileField(upload_to="video_uploads/%Y/%m/%d/")),
                ("original_name", models.CharField(max_length=255)),
                ("use_case", models.CharField(blank=True, max_length=100)),
                ("status", models.CharField(choices=[("queued", "Queued"), ("processing", "Processing"), ("completed", "Completed"), ("failed", "Failed")], default="queued", max_length=20)),
                ("progress_percent", models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ("processed_frames", models.PositiveIntegerField(default=0)),
                ("total_frames", models.PositiveIntegerField(blank=True, null=True)),
                ("sample_fps", models.FloatField(default=1.0)),
                ("fps", models.FloatField(blank=True, null=True)),
                ("duration_seconds", models.FloatField(blank=True, null=True)),
                ("frame_width", models.PositiveIntegerField(blank=True, null=True)),
                ("frame_height", models.PositiveIntegerField(blank=True, null=True)),
                ("violations_count", models.PositiveIntegerField(default=0)),
                ("error_message", models.TextField(blank=True)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("camera", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="video_uploads", to="camera.camera")),
                ("ml_model", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="video_uploads", to="mlmodel.mlmodel")),
                ("uploaded_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="video_uploads", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
