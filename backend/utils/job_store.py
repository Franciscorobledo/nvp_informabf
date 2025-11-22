import threading
from typing import Any, Dict, Optional


class JobStore:
    """Almacén en memoria para estados de trabajos de análisis.

    Este enfoque liviano es suficiente para un despliegue MVP en Render y
    evita dependencias externas como Redis. No persiste entre reinicios.
    """

    def __init__(self):
        self._jobs: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def create_job(self, job_id: str, initial_state: Optional[Dict[str, Any]] = None) -> None:
        with self._lock:
            self._jobs[job_id] = initial_state or {}

    def update_job(self, job_id: str, **kwargs) -> None:
        with self._lock:
            if job_id not in self._jobs:
                return
            self._jobs[job_id].update(kwargs)

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            job = self._jobs.get(job_id)
            return dict(job) if job else None

