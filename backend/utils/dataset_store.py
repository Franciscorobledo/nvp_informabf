import threading
from typing import Any, Dict, Optional


class DatasetStore:
    """Almacena en memoria el contexto de datasets para el chat."""

    def __init__(self):
        self._datasets: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def save_dataset(self, dataset_id: str, payload: Dict[str, Any]) -> None:
        if not dataset_id:
            return
        with self._lock:
            self._datasets[dataset_id] = payload

    def get_dataset(self, dataset_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            dataset = self._datasets.get(dataset_id)
            return dict(dataset) if dataset else None

