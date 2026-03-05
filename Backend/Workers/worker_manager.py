import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'core'))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

import logging
from engine.manager import WorkerManager          # ✅ renamed

logging.basicConfig(level=logging.INFO)

if __name__ == "__main__":
    WorkerManager().listen()
