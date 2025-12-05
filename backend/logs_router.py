import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import admin_required
from database import get_db
from models import AppLog

router = APIRouter(prefix="/admin/logs", tags=["Logs"])


class LogCreate(BaseModel):
    source: str = Field("frontend", examples=["frontend", "backend"])
    level: str = Field("INFO", examples=["INFO", "WARNING", "ERROR"])
    message: str
    details: Optional[str] = None
    path: Optional[str] = None
    user: Optional[str] = None

    def normalized_level(self) -> str:
        allowed = {"INFO", "WARNING", "ERROR"}
        level = (self.level or "INFO").upper()
        if level not in allowed:
            return "INFO"
        return level

    def normalized_source(self) -> str:
        allowed = {"frontend", "backend"}
        source = (self.source or "frontend").lower()
        if source not in allowed:
            return "frontend"
        return source


class LogEntry(BaseModel):
    id: int
    created_at: datetime
    source: str
    level: str
    message: str
    path: Optional[str] = None
    user: Optional[str] = None
    details: Optional[str] = None

    class Config:
        orm_mode = True


class LogListResponse(BaseModel):
    status: str
    logs: list[LogEntry]


@router.post("", response_model=dict)
def create_log(payload: LogCreate, db: Session = Depends(get_db)):
    """Recibe un log desde el frontend u otros componentes."""

    try:
        log_entry = AppLog(
            source=payload.normalized_source(),
            level=payload.normalized_level(),
            message=payload.message[:500],
            details=(payload.details or "")[:4000] if payload.details else None,
            path=payload.path,
            user=payload.user,
        )
        db.add(log_entry)
        db.commit()
        return {"status": "ok"}
    except Exception as exc:  # noqa: BLE001
        logging.exception("No se pudo registrar el log: %s", exc)
        raise HTTPException(status_code=500, detail="No se pudo guardar el log")


@router.get("", response_model=LogListResponse, dependencies=[Depends(admin_required)])
def list_logs(
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    level: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
):
    query = db.query(AppLog)

    if level:
        query = query.filter(AppLog.level == level.upper())
    if source:
        query = query.filter(AppLog.source == source.lower())

    logs = (
        query.order_by(AppLog.created_at.desc())
        .limit(limit)
        .all()
    )

    return LogListResponse(status="ok", logs=logs)
