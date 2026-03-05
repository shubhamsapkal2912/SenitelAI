import pika
import json
import os
import logging

logger = logging.getLogger(__name__)

RABBITMQ_URL    = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
CONTROL_EXCHANGE = "pipeline_control"   # fanout exchange name


def publish_pipeline_command(action: str, pipeline):
    try:
        conn = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
        ch   = conn.channel()

        # ✅ Declare a fanout exchange — all bound queues get every message
        ch.exchange_declare(
            exchange=CONTROL_EXCHANGE,
            exchange_type="fanout",
            durable=True,
        )

        payload = {
            "action":              action,
            "pipeline_id":         pipeline.pk,
            "camera_id":           pipeline.camera.pk,
            "ml_model_id":         pipeline.ml_model.pk,          # ✅ add this
            "rtsp_url":            pipeline.camera.rtsp_url,
            "model_file":          pipeline.ml_model.model_file.path,
            "threshold_parameter": pipeline.ml_model.threshold_parameter,
            "queue_name":          pipeline.queue_name,
            "throttle_ms":         1000,
        }

        ch.basic_publish(
            exchange=CONTROL_EXCHANGE,   # ✅ publish to exchange, not queue
            routing_key="",              # fanout ignores routing_key
            body=json.dumps(payload),
            properties=pika.BasicProperties(delivery_mode=2),
        )
        conn.close()
        logger.info(f"[RabbitMQ] '{action}' broadcast for pipeline {pipeline.pk}")

    except Exception as e:
        logger.error(f"[RabbitMQ] Failed to broadcast command: {e}")
        raise
