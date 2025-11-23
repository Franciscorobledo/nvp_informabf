import threading
import uuid
from typing import Any, Dict, Optional


class CompareJobStore:
    """Almacén en memoria para el estado de comparativas.

    No persiste entre reinicios, pero ofrece sincronización básica para evitar
    condiciones de carrera al actualizar el progreso de los trabajos.
    """

    def __init__(self):
        self._jobs: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def create_job(self, initial_state: Optional[Dict[str, Any]] = None) -> str:
        job_id = str(uuid.uuid4())
        with self._lock:
            self._jobs[job_id] = {"job_id": job_id, **(initial_state or {})}
        return job_id

    def update_job(self, job_id: str, **kwargs) -> None:
        with self._lock:
            if job_id not in self._jobs:
                return
            self._jobs[job_id].update(kwargs)

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            job = self._jobs.get(job_id)
            return dict(job) if job else None
