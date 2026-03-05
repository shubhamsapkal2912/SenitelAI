import os
import json
import logging
import importlib
import requests
import pika

from engine.worker import PipelineWorker

logger = logging.getLogger(__name__)

RABBITMQ_URL    = os.environ.get("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
MODELS_BASE_DIR = os.environ.get("MODELS_BASE_DIR", "usecases")


def _resolve_model_path(use_case: str) -> str:
    """
    use_case = "helmet"
    looks for first .pt file inside usecases/helmet/models/
    """
    models_dir = os.path.join(MODELS_BASE_DIR, use_case, "models")

    if not os.path.isdir(models_dir):
        raise FileNotFoundError(f"[Manager] Models directory not found: {models_dir}")

    # ✅ pick the first .pt file found in the models/ folder
    pt_files = [f for f in os.listdir(models_dir) if f.endswith(".pt")]

    if not pt_files:
        raise FileNotFoundError(f"[Manager] No .pt file found in: {models_dir}")

    full_path = os.path.join(models_dir, pt_files[0])
    logger.info(f"[Manager] Resolved model: {full_path}")
    return full_path



def _load_rules(use_case: str) -> list:
    """
    use_case = "helmet"
    imports  = usecases.helmet.rules → VIOLATION_RULES
    """
    try:
        module = importlib.import_module(f"usecases.{use_case}.rules")
        rules  = module.VIOLATION_RULES
        logger.info(f"[Manager] Loaded {len(rules)} rule(s) for '{use_case}'")
        return rules
    except Exception as e:
        logger.warning(f"[Manager] Could not load rules for '{use_case}': {e}. Using empty rules.")
        return []


class WorkerManager:
    def __init__(self):
        self.workers: dict[int, PipelineWorker] = {}

    def _start(self, cmd: dict):
        pid      = cmd["pipeline_id"]
        use_case = cmd["use_case"]

        if pid in self.workers:
            logger.warning(f"[Manager] Pipeline {pid} already running")
            return

        try:
            model_file = _resolve_model_path(use_case)     # usecases/helmet.pt
        except FileNotFoundError as e:
            logger.error(str(e))
            return

        violation_rules = _load_rules(use_case)             # usecases/helmet/rules.py

        worker = PipelineWorker(
            pipeline_id     = pid,
            camera_id       = cmd["camera_id"],
            ml_model_id     = cmd["ml_model_id"],
            queue_name      = cmd["queue_name"],
            model_file      = model_file,
            threshold       = cmd["threshold_parameter"],
            violation_rules = violation_rules,
        )
        self.workers[pid] = worker
        self._update_status(pid, True)
        worker.start()

    def _stop(self, cmd: dict):
        pid    = cmd["pipeline_id"]
        worker = self.workers.pop(pid, None)
        if worker:
            worker.stop()
            self._update_status(pid, False)

    def _update_status(self, pipeline_id: int, is_active: bool):
        try:
            requests.patch(
                f"{os.environ.get('DJANGO_API_URL', 'http://localhost:8000')}"
                f"/api/pipelines/{pipeline_id}/",
                json={"is_active": is_active},
                timeout=3,
            )
        except Exception as e:
            logger.warning(f"[Manager] Status update failed for pipeline {pipeline_id}: {e}")

    def listen(self):
        conn = pika.BlockingConnection(pika.URLParameters(RABBITMQ_URL))
        ch   = conn.channel()

        ch.exchange_declare(exchange="pipeline_control", exchange_type="fanout", durable=True)
        ch.queue_declare(queue="pipeline_control.workers", durable=True)
        ch.queue_bind(exchange="pipeline_control", queue="pipeline_control.workers")

        def on_command(ch, method, properties, body):
            cmd = json.loads(body)
            if cmd.get("action") == "start":
                self._start(cmd)
            elif cmd.get("action") == "stop":
                self._stop(cmd)
            ch.basic_ack(delivery_tag=method.delivery_tag)

        ch.basic_consume(
            queue="pipeline_control.workers",
            on_message_callback=on_command,
            auto_ack=False,
        )
        logger.info("[Manager] Ready. Waiting for pipeline commands...")
        ch.start_consuming()
