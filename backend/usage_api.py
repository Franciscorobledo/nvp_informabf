import calendar
from collections import defaultdict
from datetime import date, datetime
from typing import Any, Dict, Iterable, List

from fastapi import APIRouter, Depends

from auth import admin_required
from utils.openai_keys import get_openai_api_key
from utils.openai_monitor import get_usage_history

router = APIRouter(
    prefix="/usage", tags=["Consumo OpenAI"], dependencies=[Depends(admin_required)]
)


def _parse_event_date(event: Dict[str, Any]) -> date | None:
    timestamp = event.get("timestamp")
    if not timestamp:
        return None

    try:
        safe_timestamp = timestamp.replace("Z", "+00:00")
        return datetime.fromisoformat(safe_timestamp).date()
    except Exception:
        return None


def _extract_metrics(event: Dict[str, Any]) -> Dict[str, float]:
    prompt_tokens = int(event.get("prompt_tokens") or 0)
    completion_tokens = int(event.get("completion_tokens") or 0)
    total_tokens = int(event.get("total_tokens") or (prompt_tokens + completion_tokens))
    cost = float(event.get("cost_usd") or 0)

    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
        "cost_usd": cost,
    }


def _aggregate_events(events: Iterable[Dict[str, Any]]) -> Dict[str, float]:
    totals = {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
        "cost_usd": 0.0,
        "count": 0,
    }
    for event in events:
        metrics = _extract_metrics(event)
        totals["prompt_tokens"] += metrics["prompt_tokens"]
        totals["completion_tokens"] += metrics["completion_tokens"]
        totals["total_tokens"] += metrics["total_tokens"]
        totals["cost_usd"] = round(totals["cost_usd"] + metrics["cost_usd"], 6)
        totals["count"] += 1

    return totals


def _group_by_key(
    events: List[Dict[str, Any]], key_fn
) -> Dict[str, Dict[str, float]]:
    grouped: dict[str, list[Dict[str, Any]]] = defaultdict(list)
    for event in events:
        key = key_fn(event)
        grouped[key].append(event)

    return {group: _aggregate_events(values) for group, values in grouped.items()}


@router.get("/total-mes")
async def get_monthly_usage():
    """Devuelve el consumo total del mes en curso."""

    usage = get_usage_history()
    today = date.today()
    monthly_events = [
        e
        for e in usage.get("events", [])
        if (event_date := _parse_event_date(e))
        and event_date.year == today.year
        and event_date.month == today.month
    ]

    totals = _aggregate_events(monthly_events)

    return {
        "month": today.strftime("%Y-%m"),
        "total_prompt_tokens": totals["prompt_tokens"],
        "total_completion_tokens": totals["completion_tokens"],
        "total_tokens": totals["total_tokens"],
        "total_cost_usd": totals["cost_usd"],
        "events_count": totals["count"],
    }


@router.get("/diario")
async def get_daily_usage():
    """Devuelve el consumo diario agrupado por fecha."""

    usage = get_usage_history()
    events = usage.get("events", [])
    grouped = _group_by_key(
        events,
        lambda e: (_parse_event_date(e) or date.min).isoformat(),
    )

    daily = [
        {
            "date": day,
            "prompt_tokens": metrics["prompt_tokens"],
            "completion_tokens": metrics["completion_tokens"],
            "total_tokens": metrics["total_tokens"],
            "cost_usd": metrics["cost_usd"],
            "events_count": metrics["count"],
        }
        for day, metrics in sorted(grouped.items())
    ]

    return {"daily_usage": daily}


@router.get("/por-usuario")
async def get_usage_by_user():
    """Agrupa el consumo por usuario que generó la llamada."""

    usage = get_usage_history()
    events = usage.get("events", [])
    grouped = _group_by_key(events, lambda e: (e.get("user") or "desconocido"))

    return {"users": grouped}


@router.get("/por-fuente")
async def get_usage_by_source():
    """Agrupa el consumo por archivo o proceso asociado."""

    usage = get_usage_history()
    events = usage.get("events", [])

    def _source(event: Dict[str, Any]) -> str:
        if event.get("source"):
            return str(event.get("source"))
        if files := event.get("files"):
            return ", ".join(files)
        return "desconocido"

    grouped = _group_by_key(events, _source)
    return {"sources": grouped}


@router.get("/total")
async def get_global_usage():
    """Devuelve el total global acumulado del sistema."""

    usage = get_usage_history()
    totals = _aggregate_events(usage.get("events", []))

    return {
        "total_prompt_tokens": usage.get("total_prompt_tokens", totals["prompt_tokens"]),
        "total_completion_tokens": usage.get("total_completion_tokens", totals["completion_tokens"]),
        "total_tokens": totals["total_tokens"],
        "total_cost_usd": usage.get("total_cost_usd", totals["cost_usd"]),
        "events_count": totals["count"],
    }


@router.get("/proyeccion")
async def get_monthly_projection():
    """Calcula la proyección mensual basándose en el promedio diario del mes actual."""

    today = date.today()
    month_total = await get_monthly_usage()

    days_in_month = calendar.monthrange(today.year, today.month)[1]
    days_elapsed = today.day
    average_daily_cost = (
        month_total["total_cost_usd"] / days_elapsed if days_elapsed else 0
    )
    projected_cost = round(average_daily_cost * days_in_month, 6)
    average_daily_tokens = (
        month_total["total_tokens"] / days_elapsed if days_elapsed else 0
    )

    return {
        "month": month_total["month"],
        "average_daily_cost_usd": round(average_daily_cost, 6),
        "average_daily_tokens": round(average_daily_tokens, 2),
        "projected_monthly_cost_usd": projected_cost,
        "projected_monthly_tokens": round(average_daily_tokens * days_in_month, 2),
        "days_elapsed": days_elapsed,
        "days_in_month": days_in_month,
    }


@router.get("/token")
async def get_token_status():
    """Verifica si existe un token de OpenAI configurado."""

    api_key_present = bool(get_openai_api_key())
    return {
        "active": api_key_present,
        "message": "Token configurado" if api_key_present else "Token no configurado",
    }
