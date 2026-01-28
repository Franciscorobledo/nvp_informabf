import json
import os
from pathlib import Path
from typing import Any, Dict

BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = Path(os.getenv("AUTH_STORAGE_DIR", BASE_DIR / "data"))
PLAN_PRICING_FILE = Path(os.getenv("PLAN_PRICING_FILE", STORAGE_DIR / "plan_pricing.json"))


def _ensure_storage() -> None:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def load_plan_pricing_overrides() -> Dict[str, Dict[str, Any]]:
    if not PLAN_PRICING_FILE.exists():
        return {}

    try:
        data = json.loads(PLAN_PRICING_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}

    if not isinstance(data, dict):
        return {}

    return data


def persist_plan_pricing_override(alias: str, price_monthly: float, currency: str) -> None:
    _ensure_storage()
    overrides = load_plan_pricing_overrides()
    overrides[alias] = {
        "price_monthly": price_monthly,
        "currency": currency,
    }
    PLAN_PRICING_FILE.write_text(json.dumps(overrides, indent=2), encoding="utf-8")
