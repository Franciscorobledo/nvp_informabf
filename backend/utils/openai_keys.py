import json
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
DOTENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=DOTENV_PATH, override=False)

STORAGE_DIR = Path(os.getenv("AUTH_STORAGE_DIR", BASE_DIR / "data"))
OPENAI_KEY_FILE = Path(os.getenv("OPENAI_KEY_FILE", STORAGE_DIR / "openai_key.json"))


def _ensure_storage() -> None:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def persist_openai_api_key(api_key: str) -> None:
    """Guarda el token de OpenAI en disco y actualiza el entorno del proceso."""
    cleaned_key = api_key.strip()
    if not cleaned_key:
        raise ValueError("El token de OpenAI no puede estar vacío.")

    _ensure_storage()
    data = {"api_key": cleaned_key}
    OPENAI_KEY_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
    os.environ["OPENAI_API_KEY"] = cleaned_key


def _load_persisted_key() -> Optional[str]:
    if not OPENAI_KEY_FILE.exists():
        return None

    try:
        data = json.loads(OPENAI_KEY_FILE.read_text(encoding="utf-8"))
        return data.get("api_key")
    except Exception:
        return None


def get_openai_api_key() -> Optional[str]:
    """Obtiene el token de OpenAI priorizando el entorno y luego el archivo persistido."""
    env_key = os.getenv("OPENAI_API_KEY")
    if env_key:
        return env_key

    return _load_persisted_key()
