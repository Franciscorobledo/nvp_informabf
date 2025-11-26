import threading
from typing import Any, Dict, Optional


class DataMovieStore:
    """Almacén en memoria para películas de datos generadas.

    Comentario: Módulo premium Película de datos (IA mejorada).
    """

    def __init__(self):
        self._store: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def save_movie(self, analysis_id: str, payload: Dict[str, Any]) -> None:
        with self._lock:
            self._store[analysis_id] = payload

    def get_movie(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            stored = self._store.get(analysis_id)
            return dict(stored) if stored else None

    def list_ids(self) -> list[str]:
        with self._lock:
            return list(self._store.keys())
