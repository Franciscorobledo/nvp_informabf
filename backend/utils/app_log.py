import logging
from typing import Any, Optional

from database import SessionLocal
from models import AppLog


def resolve_user_identifier(user: Any) -> Optional[str]:
    if user is None:
        return None

    for attr in ("username", "email", "full_name"):
        value = getattr(user, attr, None)
        if value:
            return str(value)

    user_id = getattr(user, "id", None)
    if user_id is not None:
        return str(user_id)

    return None


def persist_app_log(
    *,
    level: str,
    message: str,
    details: Optional[str] = None,
    path: Optional[str] = None,
    user: Optional[str] = None,
    source: str = "backend",
):
    try:
        with SessionLocal() as db:
            db.add(
                AppLog(
                    source=source,
                    level=(level or "INFO").upper(),
                    message=(message or "").strip()[:500],
                    details=(details or "")[:4000] if details else None,
                    path=path,
                    user=user,
                )
            )
            db.commit()
    except Exception as log_exc:  # noqa: BLE001
        logging.error("No se pudo registrar el log de backend: %s", log_exc)
