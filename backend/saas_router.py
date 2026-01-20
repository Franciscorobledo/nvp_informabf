import base64
import hashlib
import hmac
import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any

import requests
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from zoneinfo import ZoneInfo

from auth import admin_required
from database import get_db
from models import Bot, Client, ConversationState, Reservation, Service, SlackEventLog
from utils.openai_keys import get_openai_api_key
from openai import OpenAI
from google.oauth2 import service_account
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

router = APIRouter()

SLACK_SIGNING_SECRET = os.getenv("SLACK_SIGNING_SECRET", "")
SLACK_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN", "")
GOOGLE_SERVICE_ACCOUNT_INFO = os.getenv("GOOGLE_SERVICE_ACCOUNT_INFO", "")


class ClientCreate(BaseModel):
    name: str
    contact_email: str | None = None
    timezone: str = "UTC"
    is_active: bool = True


class ClientUpdate(BaseModel):
    name: str | None = None
    contact_email: str | None = None
    timezone: str | None = None
    is_active: bool | None = None


class ClientOut(BaseModel):
    id: int
    name: str
    contact_email: str | None
    timezone: str
    is_active: bool
    created_at: datetime

    class Config:
        orm_mode = True


class BotCreate(BaseModel):
    client_id: int
    name: str
    system_prompt: str
    slack_channel_id: str
    slack_team_id: str | None = None
    slack_bot_user_id: str | None = None
    is_active: bool = True
    openai_model: str = "gpt-4o-mini"
    openai_temperature: float = Field(0.2, ge=0, le=1)
    google_calendar_id: str


class BotUpdate(BaseModel):
    name: str | None = None
    system_prompt: str | None = None
    slack_channel_id: str | None = None
    slack_team_id: str | None = None
    slack_bot_user_id: str | None = None
    is_active: bool | None = None
    openai_model: str | None = None
    openai_temperature: float | None = Field(default=None, ge=0, le=1)
    google_calendar_id: str | None = None


class BotOut(BaseModel):
    id: int
    client_id: int
    name: str
    system_prompt: str
    slack_channel_id: str
    slack_team_id: str | None
    slack_bot_user_id: str | None
    is_active: bool
    openai_model: str
    openai_temperature: float
    google_calendar_id: str
    created_at: datetime

    class Config:
        orm_mode = True


class ServiceCreate(BaseModel):
    bot_id: int
    name: str
    duration_minutes: int = Field(..., ge=5, le=480)
    is_active: bool = True


class ServiceUpdate(BaseModel):
    name: str | None = None
    duration_minutes: int | None = Field(default=None, ge=5, le=480)
    is_active: bool | None = None


class ServiceOut(BaseModel):
    id: int
    bot_id: int
    name: str
    duration_minutes: int
    is_active: bool
    created_at: datetime

    class Config:
        orm_mode = True


class ReservationOut(BaseModel):
    id: int
    client_id: int
    bot_id: int
    service_id: int | None
    slack_user_id: str
    slack_channel_id: str
    customer_name: str | None
    status: str
    start_time: datetime
    end_time: datetime
    google_event_id: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class OpenAIExtraction(BaseModel):
    intent: str | None = None
    servicio: str | None = None
    fecha: str | None = None
    hora: str | None = None
    preferencia_horaria: str | None = None


def _get_google_credentials():
    if not GOOGLE_SERVICE_ACCOUNT_INFO:
        raise ValueError("GOOGLE_SERVICE_ACCOUNT_INFO no configurado")

    payload = GOOGLE_SERVICE_ACCOUNT_INFO
    try:
        if payload.strip().startswith("{"):
            info = json.loads(payload)
        else:
            info = json.loads(base64.b64decode(payload).decode("utf-8"))
    except Exception as exc:
        raise ValueError("No se pudo leer el service account JSON") from exc

    return service_account.Credentials.from_service_account_info(
        info,
        scopes=["https://www.googleapis.com/auth/calendar"],
    )


def _get_calendar_service():
    credentials = _get_google_credentials()
    return build("calendar", "v3", credentials=credentials)


def _check_slot_available(calendar_id: str, start: datetime, end: datetime) -> bool:
    service = _get_calendar_service()
    body = {
        "timeMin": start.isoformat(),
        "timeMax": end.isoformat(),
        "items": [{"id": calendar_id}],
    }
    result = service.freebusy().query(body=body).execute()
    busy = result.get("calendars", {}).get(calendar_id, {}).get("busy", [])
    return len(busy) == 0


def _create_calendar_event(calendar_id: str, start: datetime, end: datetime, summary: str, description: str):
    service = _get_calendar_service()
    event = {
        "summary": summary,
        "description": description,
        "start": {"dateTime": start.isoformat()},
        "end": {"dateTime": end.isoformat()},
    }
    created = service.events().insert(calendarId=calendar_id, body=event).execute()
    return created.get("id")


def _get_openai_client() -> OpenAI:
    api_key = get_openai_api_key()
    if not api_key:
        raise ValueError("OpenAI API key no configurada")
    return OpenAI(api_key=api_key)


def _extract_intent(bot: Bot, text: str) -> OpenAIExtraction:
    system_prompt = f"""
Eres un clasificador de intención para un bot de agenda.
Devuelve únicamente JSON con las claves: intent, servicio, fecha, hora, preferencia_horaria.
No agregues texto adicional.
Formato de fecha: YYYY-MM-DD.
Formato de hora: HH:MM (24h).
Reglas del bot: {bot.system_prompt}
"""
    client = _get_openai_client()
    response = client.chat.completions.create(
        model=bot.openai_model,
        temperature=bot.openai_temperature,
        messages=[
            {"role": "system", "content": system_prompt.strip()},
            {"role": "user", "content": text},
        ],
    )
    content = response.choices[0].message.content or "{}"
    try:
        payload = json.loads(content)
    except json.JSONDecodeError:
        payload = {}
    return OpenAIExtraction(**payload)


def _verify_slack_signature(request: Request, raw_body: bytes) -> None:
    if not SLACK_SIGNING_SECRET:
        logger.warning("SLACK_SIGNING_SECRET no configurado; validación omitida")
        return

    timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
    signature = request.headers.get("X-Slack-Signature", "")
    if not timestamp or not signature:
        raise HTTPException(status_code=400, detail="Faltan headers de Slack")

    try:
        ts = int(timestamp)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Timestamp inválido") from exc

    if abs(datetime.utcnow().timestamp() - ts) > 60 * 5:
        raise HTTPException(status_code=400, detail="Timestamp fuera de rango")

    base_string = f"v0:{timestamp}:{raw_body.decode('utf-8')}".encode("utf-8")
    computed = "v0=" + hmac.new(
        SLACK_SIGNING_SECRET.encode("utf-8"),
        base_string,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(computed, signature):
        raise HTTPException(status_code=403, detail="Firma inválida")


def _send_slack_message(channel: str, text: str, thread_ts: str | None = None) -> None:
    if not SLACK_BOT_TOKEN:
        logger.error("SLACK_BOT_TOKEN no configurado")
        return

    payload = {"channel": channel, "text": text}
    if thread_ts:
        payload["thread_ts"] = thread_ts

    response = requests.post(
        "https://slack.com/api/chat.postMessage",
        headers={
            "Authorization": f"Bearer {SLACK_BOT_TOKEN}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=10,
    )
    if not response.ok or not response.json().get("ok"):
        logger.error("Error enviando mensaje a Slack: %s", response.text)


def _resolve_service(bot: Bot, service_name: str) -> Service | None:
    service_name = service_name.lower().strip()
    for service in bot.services:
        if service.is_active and service.name.lower() == service_name:
            return service
    return None


def _get_timezone(bot: Bot) -> ZoneInfo:
    if bot.client and bot.client.timezone:
        return ZoneInfo(bot.client.timezone)
    return ZoneInfo("UTC")


def _parse_datetime(date_str: str, time_str: str, tz: ZoneInfo) -> datetime | None:
    try:
        return datetime.fromisoformat(f"{date_str}T{time_str}:00").replace(tzinfo=tz)
    except ValueError:
        return None


@router.get("/health")
def health(db: Session = Depends(get_db)):
    return {
        "status": "ok",
        "time": datetime.utcnow().isoformat(),
        "clients": db.query(Client).count(),
        "bots": db.query(Bot).count(),
        "reservations": db.query(Reservation).count(),
    }


@router.post("/clientes", response_model=ClientOut, dependencies=[Depends(admin_required)])
def create_client(payload: ClientCreate, db: Session = Depends(get_db)):
    client = Client(
        name=payload.name,
        contact_email=payload.contact_email,
        timezone=payload.timezone,
        is_active=payload.is_active,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.get("/clientes", response_model=list[ClientOut], dependencies=[Depends(admin_required)])
def list_clients(db: Session = Depends(get_db)):
    return db.query(Client).order_by(Client.name).all()


@router.get("/clientes/{client_id}", response_model=ClientOut, dependencies=[Depends(admin_required)])
def get_client(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return client


@router.put("/clientes/{client_id}", response_model=ClientOut, dependencies=[Depends(admin_required)])
def update_client(client_id: int, payload: ClientUpdate, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    for field, value in payload.dict(exclude_unset=True).items():
        setattr(client, field, value)
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.delete("/clientes/{client_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(admin_required)])
def delete_client(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    db.delete(client)
    db.commit()


@router.post("/bots", response_model=BotOut, dependencies=[Depends(admin_required)])
def create_bot(payload: BotCreate, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == payload.client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    bot = Bot(
        client_id=payload.client_id,
        name=payload.name,
        system_prompt=payload.system_prompt,
        slack_channel_id=payload.slack_channel_id,
        slack_team_id=payload.slack_team_id,
        slack_bot_user_id=payload.slack_bot_user_id,
        is_active=payload.is_active,
        openai_model=payload.openai_model,
        openai_temperature=payload.openai_temperature,
        google_calendar_id=payload.google_calendar_id,
    )
    db.add(bot)
    db.commit()
    db.refresh(bot)
    return bot


@router.get("/bots", response_model=list[BotOut], dependencies=[Depends(admin_required)])
def list_bots(db: Session = Depends(get_db)):
    return db.query(Bot).order_by(Bot.name).all()


@router.get("/bots/{bot_id}", response_model=BotOut, dependencies=[Depends(admin_required)])
def get_bot(bot_id: int, db: Session = Depends(get_db)):
    bot = db.query(Bot).filter(Bot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot no encontrado")
    return bot


@router.put("/bots/{bot_id}", response_model=BotOut, dependencies=[Depends(admin_required)])
def update_bot(bot_id: int, payload: BotUpdate, db: Session = Depends(get_db)):
    bot = db.query(Bot).filter(Bot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot no encontrado")

    for field, value in payload.dict(exclude_unset=True).items():
        setattr(bot, field, value)
    db.add(bot)
    db.commit()
    db.refresh(bot)
    return bot


@router.delete("/bots/{bot_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(admin_required)])
def delete_bot(bot_id: int, db: Session = Depends(get_db)):
    bot = db.query(Bot).filter(Bot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot no encontrado")
    db.delete(bot)
    db.commit()


@router.post("/servicios", response_model=ServiceOut, dependencies=[Depends(admin_required)])
def create_service(payload: ServiceCreate, db: Session = Depends(get_db)):
    bot = db.query(Bot).filter(Bot.id == payload.bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot no encontrado")
    service = Service(
        bot_id=payload.bot_id,
        name=payload.name,
        duration_minutes=payload.duration_minutes,
        is_active=payload.is_active,
    )
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@router.get("/servicios", response_model=list[ServiceOut], dependencies=[Depends(admin_required)])
def list_services(db: Session = Depends(get_db)):
    return db.query(Service).order_by(Service.name).all()


@router.put("/servicios/{service_id}", response_model=ServiceOut, dependencies=[Depends(admin_required)])
def update_service(service_id: int, payload: ServiceUpdate, db: Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    for field, value in payload.dict(exclude_unset=True).items():
        setattr(service, field, value)
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@router.delete("/servicios/{service_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(admin_required)])
def delete_service(service_id: int, db: Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    db.delete(service)
    db.commit()


@router.get("/reservas", response_model=list[ReservationOut], dependencies=[Depends(admin_required)])
def list_reservations(client_id: int | None = None, bot_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(Reservation)
    if client_id:
        query = query.filter(Reservation.client_id == client_id)
    if bot_id:
        query = query.filter(Reservation.bot_id == bot_id)
    return query.order_by(Reservation.start_time.desc()).all()


@router.post("/slack/events")
async def slack_events(request: Request, db: Session = Depends(get_db)):
    raw_body = await request.body()
    _verify_slack_signature(request, raw_body)

    payload = await request.json()
    event_type = payload.get("type")

    if event_type == "url_verification":
        return {"challenge": payload.get("challenge")}

    event = payload.get("event", {})
    if not event:
        return {"status": "ignored"}

    if event.get("subtype") == "bot_message" or event.get("bot_id"):
        return {"status": "ignored"}

    channel = event.get("channel")
    user = event.get("user")
    text = event.get("text", "")
    event_id = payload.get("event_id")

    bot = db.query(Bot).filter(Bot.slack_channel_id == channel, Bot.is_active.is_(True)).first()
    db.add(SlackEventLog(bot_id=bot.id if bot else None, event_id=event_id, event_type=event.get("type"), payload=payload))
    db.commit()

    if not bot:
        return {"status": "ignored"}

    if bot.slack_bot_user_id and user == bot.slack_bot_user_id:
        return {"status": "ignored"}

    state = (
        db.query(ConversationState)
        .filter(ConversationState.bot_id == bot.id, ConversationState.slack_user_id == user)
        .first()
    )
    if not state:
        state = ConversationState(
            bot_id=bot.id,
            slack_user_id=user,
            state="idle",
            collected_data={},
        )
        db.add(state)
        db.commit()
        db.refresh(state)

    tz = _get_timezone(bot)
    collected = state.collected_data or {}

    if state.state == "confirming":
        lowered = text.lower()
        if any(word in lowered for word in ["si", "sí", "confirmo", "ok", "dale"]):
            service_name = collected.get("servicio")
            service = _resolve_service(bot, service_name) if service_name else None
            if not service:
                state.state = "idle"
                state.collected_data = {}
                db.add(state)
                db.commit()
                _send_slack_message(channel, "No encontré el servicio. ¿Qué servicio deseas agendar?", event.get("ts"))
                return {"status": "ok"}

            start = datetime.fromisoformat(collected["start"])
            end = datetime.fromisoformat(collected["end"])
            event_id = _create_calendar_event(
                bot.google_calendar_id,
                start,
                end,
                summary=f"{service.name} - Slack",
                description=f"Cliente Slack {user}",
            )
            reservation = Reservation(
                client_id=bot.client_id,
                bot_id=bot.id,
                service_id=service.id,
                slack_user_id=user,
                slack_channel_id=channel,
                customer_name=None,
                status="confirmed",
                start_time=start,
                end_time=end,
                google_event_id=event_id,
            )
            db.add(reservation)
            state.state = "idle"
            state.collected_data = {}
            state.updated_at = datetime.utcnow()
            db.commit()

            _send_slack_message(channel, "✅ Tu cita quedó confirmada. ¡Gracias!", event.get("ts"))
            return {"status": "ok"}
        if any(word in lowered for word in ["no", "cancelar", "cancela"]):
            state.state = "idle"
            state.collected_data = {}
            db.add(state)
            db.commit()
            _send_slack_message(channel, "Entendido, cancelamos el proceso. ¿Deseas agendar otra cita?", event.get("ts"))
            return {"status": "ok"}

    try:
        extraction = _extract_intent(bot, text)
    except Exception as exc:
        logger.exception("Error OpenAI: %s", exc)
        _send_slack_message(channel, "Lo siento, tuve un problema interpretando tu solicitud. Intenta de nuevo.", event.get("ts"))
        return {"status": "error"}

    if extraction.servicio:
        collected["servicio"] = extraction.servicio
    if extraction.fecha:
        collected["fecha"] = extraction.fecha
    if extraction.hora:
        collected["hora"] = extraction.hora

    state.collected_data = collected
    state.updated_at = datetime.utcnow()

    if extraction.intent != "agendar_cita" and state.state == "idle":
        _send_slack_message(channel, "Puedo ayudarte a agendar una cita. ¿Qué servicio deseas?", event.get("ts"))
        state.state = "collecting_service"
        db.add(state)
        db.commit()
        return {"status": "ok"}

    service = _resolve_service(bot, collected.get("servicio", "")) if collected.get("servicio") else None
    if not service:
        services = ", ".join([s.name for s in bot.services if s.is_active]) or "sin servicios configurados"
        state.state = "collecting_service"
        db.add(state)
        db.commit()
        _send_slack_message(
            channel,
            f"¿Qué servicio deseas agendar? Servicios disponibles: {services}.",
            event.get("ts"),
        )
        return {"status": "ok"}

    if not collected.get("fecha"):
        state.state = "collecting_date"
        db.add(state)
        db.commit()
        _send_slack_message(channel, "¿Para qué fecha deseas la cita? (YYYY-MM-DD)", event.get("ts"))
        return {"status": "ok"}

    if not collected.get("hora"):
        state.state = "collecting_time"
        db.add(state)
        db.commit()
        _send_slack_message(channel, "¿A qué hora prefieres? (HH:MM)", event.get("ts"))
        return {"status": "ok"}

    start_dt = _parse_datetime(collected["fecha"], collected["hora"], tz)
    if not start_dt:
        state.state = "collecting_time"
        db.add(state)
        db.commit()
        _send_slack_message(channel, "La hora no es válida. Indica la hora en formato HH:MM.", event.get("ts"))
        return {"status": "ok"}

    end_dt = start_dt + timedelta(minutes=service.duration_minutes)

    if not _check_slot_available(bot.google_calendar_id, start_dt, end_dt):
        state.state = "collecting_time"
        db.add(state)
        db.commit()
        _send_slack_message(channel, "Ese horario no está disponible. ¿Deseas otro horario?", event.get("ts"))
        return {"status": "ok"}

    state.state = "confirming"
    state.collected_data = {
        "servicio": service.name,
        "start": start_dt.isoformat(),
        "end": end_dt.isoformat(),
    }
    db.add(state)
    db.commit()

    _send_slack_message(
        channel,
        f"¿Confirmas la cita de {service.name} el {start_dt.strftime('%Y-%m-%d %H:%M')}?",
        event.get("ts"),
    )
    return {"status": "ok"}
