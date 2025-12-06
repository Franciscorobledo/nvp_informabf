import json
import logging
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Optional

import requests

from database import SessionLocal
from models import ApiUsage, User
from utils.openai_keys import get_openai_api_key

# Archivo persistente para consolidar el uso de OpenAI
USAGE_FILE = Path(__file__).resolve().parent.parent / "openai_usage.json"

# Costos por defecto (USD por 1K tokens) para gpt-4o-mini
DEFAULT_INPUT_COST = float(os.getenv("OPENAI_INPUT_COST_PER_1K", "0.000150"))
DEFAULT_OUTPUT_COST = float(os.getenv("OPENAI_OUTPUT_COST_PER_1K", "0.000600"))

# Presupuesto de referencia para alertar al administrador
BUDGET_USD = float(os.getenv("OPENAI_BUDGET_USD", "20"))
OPENAI_BILLING_BASE_URL = os.getenv(
    "OPENAI_BILLING_BASE_URL", "https://api.openai.com/v1/dashboard/billing"
)


def _billing_base_urls() -> list[str]:
    """Builds a list of billing base URLs trying the new and legacy endpoints."""

    base_urls = []

    if OPENAI_BILLING_BASE_URL:
        base_urls.append(OPENAI_BILLING_BASE_URL.rstrip("/"))

    legacy_base = "https://api.openai.com/dashboard/billing"
    if legacy_base not in base_urls:
        base_urls.append(legacy_base)

    return base_urls


def _safe_get(url: str, headers: Dict[str, str], params: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    response = requests.get(url, headers=headers, params=params, timeout=10)
    response.raise_for_status()
    return response.json()


def _friendly_billing_error(exc: Exception) -> str:
    """Traduce errores comunes de billing a mensajes claros."""

    if isinstance(exc, requests.HTTPError) and exc.response is not None:
        status = exc.response.status_code
        if status in (401, 403, 404):
            return (
                "La API de facturación no está disponible con cuentas personales. "
                "Usa una organización con permisos de facturación o una API key empresarial."
            )
    return str(exc)


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
    key = api_key or get_openai_api_key()
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

    usage_payload: Dict[str, Any] = {
        "status": "error",
        "message": "Sin datos de consumo real disponibles",
    }
    last_usage_error: Exception | None = None
    for base_url in _billing_base_urls():
        usage_url = f"{base_url}/usage"
        try:
            usage_data = _safe_get(
                usage_url,
                headers=headers,
                params={
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                },
            )

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

            usage_payload = {
                "status": "ok",
                "message": "Consumo real obtenido desde OpenAI",
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "total_usage_usd": total_usage_usd,
                "daily_costs": daily,
            }
            break
        except Exception as exc:
            logging.warning(
                "No se pudo obtener el uso real de OpenAI en %s: %s", usage_url, exc
            )
            last_usage_error = exc
    else:
        if last_usage_error:
            usage_payload = {
                "status": "warning",
                "message": f"No se pudo obtener el uso real: {_friendly_billing_error(last_usage_error)}",
            }

    credits_data: Dict[str, Any] = {}
    last_credit_error: Exception | None = None
    for base_url in _billing_base_urls():
        grants_url = f"{base_url}/credit_grants"
        try:
            grants_json = _safe_get(grants_url, headers=headers)
            credits_data = {
                "granted_usd": grants_json.get("total_granted"),
                "used_usd": grants_json.get("total_used"),
                "available_usd": grants_json.get("total_available"),
            }
            break
        except Exception as exc:
            logging.warning(
                "No se pudieron obtener los créditos de OpenAI en %s: %s", grants_url, exc
            )
            last_credit_error = exc
    else:
        if last_credit_error:
            credits_data = {
                "status": "error",
                "message": f"No se pudieron obtener los créditos: {_friendly_billing_error(last_credit_error)}",
            }

    # Si los créditos se obtienen correctamente, priorizamos mostrar el saldo disponible
    # aunque la consulta de uso falle, para permitir alertar cuando el saldo se acerque a 0.
    merged_status = usage_payload.get("status")
    merged_message = usage_payload.get("message")
    if credits_data and credits_data.get("available_usd") is not None:
        if merged_status != "ok":
            merged_status = "warning"
            merged_message = (
                "Consumo parcial: saldo disponible obtenido, consumo real no disponible"
            )

    return {
        **usage_payload,
        "status": merged_status,
        "message": merged_message,
        "credits": credits_data,
    }


def record_openai_usage(
    model: str,
    prompt_tokens: int | None,
    completion_tokens: int | None,
    input_cost_per_1k: float | None = None,
    output_cost_per_1k: float | None = None,
    user: str | None = None,
    source: str | None = None,
    files: list[str] | None = None,
    action: str | None = None,
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
    total_tokens = prompt_tokens + completion_tokens

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
        "total_tokens": total_tokens,
        "cost_usd": total_cost,
        "cumulative_cost_usd": usage["total_cost_usd"],
        "user": user or "desconocido",
        "source": source or "desconocido",
        "files": files or [],
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

    _persist_usage_event(
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        total_cost=total_cost,
        user=user,
        source=source,
        files=files,
        action=action,
    )

    return get_usage_snapshot()


def _persist_usage_event(
    *,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    total_cost: float,
    user: str | None,
    source: str | None,
    files: list[str] | None,
    action: str | None,
) -> None:
    try:
        with SessionLocal() as db:
            db_user: User | None = None
            if user:
                db_user = db.query(User).filter(User.username == user).first()

            usage_entry = ApiUsage(
                user=db_user,
                user_id=db_user.id if db_user else None,
                username=db_user.username if db_user else user or "desconocido",
                model=model,
                action=action or source or "general",
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                cost_usd=total_cost,
                source=source,
                files=files or [],
            )
            db.add(usage_entry)
            db.commit()
    except Exception as exc:  # noqa: BLE001
        logging.warning("No se pudo registrar uso en base de datos: %s", exc)


def get_usage_history() -> Dict[str, Any]:
    """Devuelve el historial completo de uso en disco."""

    usage = _load_usage()
    usage.setdefault("events", [])

    return {
        "total_prompt_tokens": usage.get("total_prompt_tokens", 0),
        "total_completion_tokens": usage.get("total_completion_tokens", 0),
        "total_cost_usd": usage.get("total_cost_usd", 0.0),
        "events": usage.get("events", []),
    }


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
