import json
import logging
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Optional

import requests

# Archivo persistente para consolidar el uso de OpenAI
USAGE_FILE = Path(__file__).resolve().parent.parent / "openai_usage.json"

# Costos por defecto (USD por 1K tokens) para gpt-4o-mini
DEFAULT_INPUT_COST = float(os.getenv("OPENAI_INPUT_COST_PER_1K", "0.000150"))
DEFAULT_OUTPUT_COST = float(os.getenv("OPENAI_OUTPUT_COST_PER_1K", "0.000600"))

# Presupuesto de referencia para alertar al administrador
BUDGET_USD = float(os.getenv("OPENAI_BUDGET_USD", "20"))
OPENAI_BILLING_BASE_URL = os.getenv(
    "OPENAI_BILLING_BASE_URL", "https://api.openai.com/dashboard/billing"
)


def _base_usage_template() -> Dict[str, Any]:
    return {
        "total_prompt_tokens": 0,
        "total_completion_tokens": 0,
        "total_cost_usd": 0.0,
        "last_call": None,
        "last_model": None,
        "events": [],
    }


def _load_usage() -> Dict[str, Any]:
    if not USAGE_FILE.exists():
        return _base_usage_template()

    try:
        with USAGE_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
        # Garantiza que siempre exista la clave de eventos para el historial
        data.setdefault("events", [])
        return data
    except Exception as exc:
        logging.error(f"No se pudo leer el historial de uso de OpenAI: {exc}")
        return _base_usage_template()


def _save_usage(data: Dict[str, Any]) -> None:
    try:
        with USAGE_FILE.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as exc:
        logging.error(f"No se pudo guardar el historial de uso de OpenAI: {exc}")


def _get_api_key(api_key: Optional[str] = None) -> str:
    key = api_key or os.getenv("OPENAI_API_KEY")
    if not key:
        raise ValueError(
            "OPENAI_API_KEY no está configurada. Asegúrate de definirla para consultar el uso real."
        )
    return key


def get_billing_usage(days: int = 30, api_key: Optional[str] = None) -> Dict[str, Any]:
    """Obtiene el consumo real desde el endpoint de billing de OpenAI."""

    try:
        key = _get_api_key(api_key)
    except ValueError as exc:
        return {"status": "error", "message": str(exc)}

    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=days)

    headers = {"Authorization": f"Bearer {key}"}
    usage_url = f"{OPENAI_BILLING_BASE_URL}/usage"
    grants_url = f"{OPENAI_BILLING_BASE_URL}/credit_grants"

    try:
        usage_response = requests.get(
            usage_url,
            headers=headers,
            params={
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
            timeout=10,
        )
        usage_response.raise_for_status()
        usage_data = usage_response.json()

        total_usage_cents = usage_data.get("total_usage") or 0
        total_usage_usd = round(float(total_usage_cents) / 100, 6)

        daily_costs = usage_data.get("daily_costs", [])
        daily = []
        for item in daily_costs or []:
            cost = 0
            line_items = item.get("line_items")
            if isinstance(line_items, list) and line_items:
                cost = round(float(line_items[0].get("cost", 0)) / 100, 6)

            daily.append(
                {
                    "date": item.get("timestamp"),
                    "cost_usd": cost,
                }
            )

    except Exception as exc:
        logging.warning("No se pudo obtener el uso real de OpenAI: %s", exc)
        return {
            "status": "error",
            "message": f"No se pudo obtener el uso real: {exc}",
        }

    credits_data: Dict[str, Any] = {}
    try:
        grants_response = requests.get(grants_url, headers=headers, timeout=10)
        grants_response.raise_for_status()
        grants_json = grants_response.json()
        credits_data = {
            "granted_usd": grants_json.get("total_granted"),
            "used_usd": grants_json.get("total_used"),
            "available_usd": grants_json.get("total_available"),
        }
    except Exception as exc:
        logging.warning("No se pudieron obtener los créditos de OpenAI: %s", exc)
        credits_data = {
            "status": "error",
            "message": f"No se pudieron obtener los créditos: {exc}",
        }

    return {
        "status": "ok",
        "message": "Consumo real obtenido desde OpenAI",
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total_usage_usd": total_usage_usd,
        "daily_costs": daily,
        "credits": credits_data,
    }


def record_openai_usage(
    model: str,
    prompt_tokens: int | None,
    completion_tokens: int | None,
    input_cost_per_1k: float | None = None,
    output_cost_per_1k: float | None = None,
) -> Dict[str, Any]:
    """Actualiza el historial de uso de OpenAI y devuelve un snapshot."""
    usage = _load_usage()

    prompt_tokens = prompt_tokens or 0
    completion_tokens = completion_tokens or 0
    input_cost = input_cost_per_1k or DEFAULT_INPUT_COST
    output_cost = output_cost_per_1k or DEFAULT_OUTPUT_COST

    prompt_cost = (prompt_tokens / 1000) * input_cost
    completion_cost = (completion_tokens / 1000) * output_cost
    total_cost = round(prompt_cost + completion_cost, 6)

    usage["total_prompt_tokens"] = usage.get("total_prompt_tokens", 0) + prompt_tokens
    usage["total_completion_tokens"] = usage.get("total_completion_tokens", 0) + completion_tokens
    usage["total_cost_usd"] = round(usage.get("total_cost_usd", 0.0) + total_cost, 6)
    timestamp = datetime.utcnow().isoformat()
    usage["last_call"] = timestamp
    usage["last_model"] = model

    event = {
        "timestamp": timestamp,
        "model": model,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "cost_usd": total_cost,
        "cumulative_cost_usd": usage["total_cost_usd"],
    }

    # Mantiene un historial corto para mostrar en el panel de administración
    events = usage.get("events", [])
    events.append(event)
    usage["events"] = events[-50:]

    _save_usage(usage)
    logging.info(
        "📈 Uso de OpenAI registrado: prompt=%s, completion=%s, costo acumulado=%.6f USD",
        prompt_tokens,
        completion_tokens,
        usage["total_cost_usd"],
    )

    return get_usage_snapshot()


def get_usage_snapshot() -> Dict[str, Any]:
    usage = _load_usage()
    remaining_budget = max(BUDGET_USD - usage.get("total_cost_usd", 0.0), 0)
    events = usage.get("events", [])
    return {
        "budget_usd": BUDGET_USD,
        "remaining_budget_usd": round(remaining_budget, 6),
        "total_prompt_tokens": usage.get("total_prompt_tokens", 0),
        "total_completion_tokens": usage.get("total_completion_tokens", 0),
        "total_cost_usd": usage.get("total_cost_usd", 0.0),
        "last_call": usage.get("last_call"),
        "last_model": usage.get("last_model"),
        # Solo enviamos los últimos 25 eventos para evitar respuestas demasiado grandes
        "events": events[-25:],
    }
