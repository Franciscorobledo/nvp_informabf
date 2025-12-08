"""Caché simple en memoria para acelerar el cálculo de métricas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

# Guardar métricas evita recalcular KPIs innecesariamente y mejora la velocidad
# percibida cuando los usuarios consultan repetidamente el mismo panel.
_METRICS_CACHE: Dict[str, Dict[str, Dict[str, Any]]] = {}


def get_cached_metrics(
    user_id: str,
    metric_type: str,
    *,
    context_updated_at: Optional[datetime],
    filters: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """Devuelve el payload cacheado si el contexto y los filtros coinciden."""

    user_cache = _METRICS_CACHE.get(user_id, {})
    entry = user_cache.get(metric_type)

    if not entry:
        return None

    if entry.get("context_updated_at") != context_updated_at:
        return None

    if entry.get("filters") != filters:
        return None

    return entry.get("payload")


def set_cached_metrics(
    user_id: str,
    metric_type: str,
    *,
    context_updated_at: Optional[datetime],
    filters: Dict[str, Any],
    payload: Dict[str, Any],
) -> None:
    """Guarda métricas en memoria junto con la fecha de actualización y filtros."""

    _METRICS_CACHE.setdefault(user_id, {})[metric_type] = {
        "payload": payload,
        "context_updated_at": context_updated_at,
        "filters": filters,
        "cached_at": datetime.utcnow(),
    }


def invalidate_user_cache(user_id: str) -> None:
    """Borra el caché del usuario cuando cambia su fuente de datos."""

    _METRICS_CACHE.pop(user_id, None)
