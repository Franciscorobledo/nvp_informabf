import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

# Archivo persistente para consolidar el uso de OpenAI
USAGE_FILE = Path(__file__).resolve().parent.parent / "openai_usage.json"

# Costos por defecto (USD por 1K tokens) para gpt-4o-mini
DEFAULT_INPUT_COST = float(os.getenv("OPENAI_INPUT_COST_PER_1K", "0.000150"))
DEFAULT_OUTPUT_COST = float(os.getenv("OPENAI_OUTPUT_COST_PER_1K", "0.000600"))

# Presupuesto de referencia para alertar al administrador
BUDGET_USD = float(os.getenv("OPENAI_BUDGET_USD", "20"))


def _load_usage() -> Dict[str, Any]:
    if not USAGE_FILE.exists():
        return {
            "total_prompt_tokens": 0,
            "total_completion_tokens": 0,
            "total_cost_usd": 0.0,
            "last_call": None,
            "last_model": None,
        }

    try:
        with USAGE_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    except Exception as exc:
        logging.error(f"No se pudo leer el historial de uso de OpenAI: {exc}")
        return {
            "total_prompt_tokens": 0,
            "total_completion_tokens": 0,
            "total_cost_usd": 0.0,
            "last_call": None,
            "last_model": None,
        }


def _save_usage(data: Dict[str, Any]) -> None:
    try:
        with USAGE_FILE.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as exc:
        logging.error(f"No se pudo guardar el historial de uso de OpenAI: {exc}")


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
    usage["last_call"] = datetime.utcnow().isoformat()
    usage["last_model"] = model

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
    return {
        "budget_usd": BUDGET_USD,
        "remaining_budget_usd": round(remaining_budget, 6),
        "total_prompt_tokens": usage.get("total_prompt_tokens", 0),
        "total_completion_tokens": usage.get("total_completion_tokens", 0),
        "total_cost_usd": usage.get("total_cost_usd", 0.0),
        "last_call": usage.get("last_call"),
        "last_model": usage.get("last_model"),
    }
