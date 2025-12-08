import json
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
DOTENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=DOTENV_PATH, override=False)

STORAGE_DIR = Path(os.getenv("AUTH_STORAGE_DIR", BASE_DIR / "data"))
MP_TOKEN_FILE = Path(os.getenv("MP_TOKEN_FILE", STORAGE_DIR / "mercadopago_token.json"))


def _ensure_storage() -> None:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def persist_mp_access_token(access_token: str) -> None:
    cleaned = access_token.strip()
    if not cleaned:
        raise ValueError("El token de Mercado Pago no puede estar vacío.")

    _ensure_storage()
    MP_TOKEN_FILE.write_text(json.dumps({"access_token": cleaned}, indent=2), encoding="utf-8")
    os.environ["MP_ACCESS_TOKEN"] = cleaned


def _load_persisted_token() -> Optional[str]:
    if not MP_TOKEN_FILE.exists():
        return None

    try:
        data = json.loads(MP_TOKEN_FILE.read_text(encoding="utf-8"))
        return data.get("access_token")
    except Exception:
        return None


def get_mp_access_token() -> Optional[str]:
    env_token = os.getenv("MP_ACCESS_TOKEN")
    if env_token:
        return env_token

    return _load_persisted_token()
