from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import requests
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, HttpUrl
from sqlalchemy.orm import Session

from auth import admin_required, get_current_user
from database import get_db
from models import MLApp, MLUserConnection, MercadoLibreCredential, User
from utils.crypto_utils import decrypt_value, encrypt_value
from analysis import analyze_file
import pandas as pd
from utils.data_engine import standardize_dataframe
from utils.app_log import persist_app_log, resolve_user_identifier


router = APIRouter(prefix="/mercadolibre", tags=["MercadoLibre"])
ml_admin_router = APIRouter(prefix="/admin/ml", tags=["MercadoLibre Admin"], dependencies=[Depends(admin_required)])
meli_router = APIRouter(prefix="/meli", tags=["MercadoLibre OAuth"])

SITE_DOMAINS = {
    "MLA": "com.ar",
    "MLB": "com.br",
    "MLM": "com.mx",
    "MLC": "cl",
    "MCO": "com.co",
    "MPE": "com.pe",
    "MLU": "com.uy",
    "MLV": "ve",
    "MCR": "cr",
    "MBO": "com.bo",
}

USE_MELI_STUB = (
    os.getenv("USE_MELI_STUB", "true" if os.getenv("PYTEST_CURRENT_TEST") else "false")
    .lower()
    in {"1", "true", "yes"}
)

DEMO_CREDENTIAL = {
    "account_name": "Cuenta demo MercadoLibre",
    "country_code": "MLA",
    "redirect_uri": "https://developers.mercadolibre.com.ar/test",
    "webhook_url": None,
    "seller_id": "TEST_SELLER_123",
    "nickname": "Tienda Demo",
    "has_tokens": True,
}

DEMO_SELLER = {
    "id": "TEST_SELLER_123",
    "nickname": "Tienda Demo",
    "permalink": "https://perfil.mercadolibre.com.ar/TEST_SELLER_123",
    "site_id": "MLA",
    "seller_reputation": {"level_id": "5_green", "power_seller_status": "gold"},
}

DEMO_ACTIVE_LISTINGS = {
    "item_ids": ["MLA_DEMO_001", "MLA_DEMO_002", "MLA_DEMO_003"],
    "details": [
        {
            "id": "MLA_DEMO_001",
            "title": "Auriculares Bluetooth",
            "price": 19999.0,
            "sold_quantity": 148,
            "available_quantity": 25,
            "permalink": "https://articulo.mercadolibre.com.ar/MLA_DEMO_001",
            "status": "active",
            "category_id": "MLA3697",
        },
        {
            "id": "MLA_DEMO_002",
            "title": "Silla ergonómica de oficina",
            "price": 85999.0,
            "sold_quantity": 62,
            "available_quantity": 10,
            "permalink": "https://articulo.mercadolibre.com.ar/MLA_DEMO_002",
            "status": "active",
            "category_id": "MLA4367",
        },
        {
            "id": "MLA_DEMO_003",
            "title": "Mouse inalámbrico recargable",
            "price": 14999.0,
            "sold_quantity": 230,
            "available_quantity": 55,
            "permalink": "https://articulo.mercadolibre.com.ar/MLA_DEMO_003",
            "status": "active",
            "category_id": "MLA1648",
        },
    ],
}

DEMO_PAUSED_LISTINGS = {
    "item_ids": ["MLA_DEMO_004"],
    "details": [
        {
            "id": "MLA_DEMO_004",
            "title": "Teclado mecánico RGB",
            "price": 39999.0,
            "sold_quantity": 38,
            "available_quantity": 0,
            "permalink": "https://articulo.mercadolibre.com.ar/MLA_DEMO_004",
            "status": "paused",
            "category_id": "MLA1649",
        }
    ],
}

DEMO_ORDERS = {
    "results": [
        {
            "id": 90010001,
            "status": "paid",
            "date_created": "2024-08-01T12:00:00.000-03:00",
            "currency_id": "ARS",
            "total_amount": 19999.0,
            "paid_amount": 19999.0,
            "buyer": {"id": 444001, "nickname": "comprador_demo"},
            "shipping": {"mode": "me2"},
            "site_id": "MLA",
            "order_items": [
                {
                    "quantity": 1,
                    "unit_price": 19999.0,
                    "full_unit_price": 19999.0,
                    "item": {"id": "MLA_DEMO_001", "title": "Auriculares Bluetooth"},
                }
            ],
        },
        {
            "id": 90010002,
            "status": "paid",
            "date_created": "2024-08-03T15:20:00.000-03:00",
            "currency_id": "ARS",
            "total_amount": 100998.0,
            "paid_amount": 100998.0,
            "buyer": {"id": 444002, "nickname": "empresa_demo"},
            "shipping": {"mode": "me1"},
            "site_id": "MLA",
            "order_items": [
                {
                    "quantity": 1,
                    "unit_price": 85999.0,
                    "full_unit_price": 85999.0,
                    "item": {"id": "MLA_DEMO_002", "title": "Silla ergonómica de oficina"},
                },
                {
                    "quantity": 1,
                    "unit_price": 14999.0,
                    "full_unit_price": 14999.0,
                    "item": {"id": "MLA_DEMO_003", "title": "Mouse inalámbrico recargable"},
                },
            ],
        },
        {
            "id": 90010003,
            "status": "shipped",
            "date_created": "2024-08-05T09:10:00.000-03:00",
            "currency_id": "ARS",
            "total_amount": 39999.0,
            "paid_amount": 39999.0,
            "buyer": {"id": 444003, "nickname": "gamer_demo"},
            "shipping": {"mode": "me2"},
            "site_id": "MLA",
            "order_items": [
                {
                    "quantity": 1,
                    "unit_price": 39999.0,
                    "full_unit_price": 39999.0,
                    "item": {"id": "MLA_DEMO_004", "title": "Teclado mecánico RGB"},
                }
            ],
        },
    ],
    "paging": {"total": 3, "limit": 50, "offset": 0},
}


class CredentialPayload(BaseModel):
    account_name: str = "Principal"
    client_id: str
    client_secret: str
    redirect_uri: HttpUrl
    country_code: str
    webhook_url: Optional[HttpUrl] = None


class CredentialOut(BaseModel):
    id: int
    account_name: str
    country_code: str
    redirect_uri: str
    webhook_url: Optional[str]
    seller_id: Optional[str]
    nickname: Optional[str]
    has_tokens: bool
    updated_at: Optional[datetime]

    class Config:
        orm_mode = True


class MLAppPayload(BaseModel):
    alias: str
    site_id: str
    client_id: str
    client_secret: Optional[str] = None
    redirect_uri: HttpUrl
    webhook_url: Optional[HttpUrl] = None


class MLAppOut(BaseModel):
    id: int
    alias: str
    site_id: str
    client_id: str
    redirect_uri: str
    webhook_url: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class MLConnectionOut(BaseModel):
    id: int
    app_alias: str
    seller_id: Optional[str]
    nickname: Optional[str]
    updated_at: Optional[datetime]
    expires_at: Optional[datetime]

    class Config:
        orm_mode = True


def _get_country_domain(country_code: str) -> str:
    return SITE_DOMAINS.get(country_code.upper(), "com")


def _demo_credential_out() -> CredentialOut:
    return CredentialOut(
        id=0,
        account_name=DEMO_CREDENTIAL["account_name"],
        country_code=DEMO_CREDENTIAL["country_code"],
        redirect_uri=DEMO_CREDENTIAL["redirect_uri"],
        webhook_url=None,
        seller_id=DEMO_CREDENTIAL["seller_id"],
        nickname=DEMO_CREDENTIAL["nickname"],
        has_tokens=True,
        updated_at=datetime.utcnow(),
    )


def _normalize_alias(alias: str) -> str:
    return alias.strip().lower()


def _mask_secret(secret: Optional[str]) -> str:
    if not secret:
        return ""
    return "•" * min(len(secret), 8)


def _app_to_out(app: MLApp) -> MLAppOut:
    return MLAppOut(
        id=app.id,
        alias=app.alias,
        site_id=app.site_id,
        client_id=app.client_id,
        redirect_uri=app.redirect_uri,
        webhook_url=app.webhook_url,
        created_at=app.created_at,
        updated_at=app.updated_at,
    )


def _get_app_or_404(db: Session, *, app_id: Optional[int] = None, alias: Optional[str] = None) -> MLApp:
    query = db.query(MLApp)
    if app_id:
        query = query.filter(MLApp.id == app_id)
    if alias:
        query = query.filter(MLApp.alias == _normalize_alias(alias))
    app = query.first()
    if not app:
        raise HTTPException(status_code=404, detail="Aplicación de Mercado Libre no encontrada")
    return app


def _build_state(app_id: int, user_id: int) -> str:
    return f"{app_id}:{user_id}:{uuid.uuid4()}"


def _perform_token_request(app: MLApp, payload: dict[str, Any]) -> dict[str, Any]:
    if USE_MELI_STUB:
        return {
            "access_token": f"TEST_TOKEN_{uuid.uuid4().hex[:8]}",
            "refresh_token": f"TEST_REFRESH_{uuid.uuid4().hex[:8]}",
            "expires_in": 3600,
            "user_id": "TEST_SELLER_ID",
            "nickname": "Seller Demo",
        }

    res = requests.post("https://api.mercadolibre.com/oauth/token", data=payload, timeout=20)
    if not res.ok:
        logging.error("MercadoLibre token request failed: %s", res.text)
        raise HTTPException(status_code=400, detail="No se pudo obtener token de Mercado Libre")
    return res.json()


def _authorization_url_for_app(app: MLApp, state: str) -> str:
    domain = _get_country_domain(app.site_id)
    base_url = f"https://auth.mercadolibre.{domain}/authorization"
    params = {
        "response_type": "code",
        "client_id": app.client_id,
        "redirect_uri": app.redirect_uri,
        "state": state,
    }
    return f"{base_url}?{urlencode(params)}"


def _store_user_tokens(db: Session, user: User, app: MLApp, payload: dict[str, Any]) -> MLUserConnection:
    access_token = payload.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Mercado Libre no devolvió access_token")

    expires_in = payload.get("expires_in") or 0
    refresh_token = payload.get("refresh_token")
    seller_id = payload.get("user_id")
    nickname = payload.get("nickname")

    connection = (
        db.query(MLUserConnection)
        .filter(MLUserConnection.user_id == user.id, MLUserConnection.app_id == app.id)
        .first()
    )

    if not connection:
        connection = MLUserConnection(user_id=user.id, app_id=app.id)

    connection.access_token_encrypted = encrypt_value(access_token)
    if refresh_token:
        connection.refresh_token_encrypted = encrypt_value(refresh_token)
    connection.expires_at = datetime.utcnow() + timedelta(seconds=expires_in) if expires_in else None
    connection.updated_at = datetime.utcnow()
    connection.seller_id = seller_id or connection.seller_id
    connection.nickname = nickname or connection.nickname

    db.add(connection)
    db.commit()
    db.refresh(connection)
    return connection


def _ensure_connection_token(db: Session, connection: MLUserConnection, app: MLApp) -> str:
    now = datetime.utcnow()
    if connection.expires_at and connection.expires_at > now + timedelta(minutes=2):
        token = decrypt_value(connection.access_token_encrypted)
        if token:
            return token

    refresh_token = decrypt_value(connection.refresh_token_encrypted)
    if not refresh_token:
        raise HTTPException(status_code=400, detail="No hay refresh_token guardado para este usuario")

    payload = {
        "grant_type": "refresh_token",
        "client_id": app.client_id,
        "client_secret": decrypt_value(app.client_secret_encrypted),
        "refresh_token": refresh_token,
    }
    data = _perform_token_request(app, payload)
    connection = _store_user_tokens(db, connection.user, app, data)
    token = decrypt_value(connection.access_token_encrypted)
    if not token:
        raise HTTPException(status_code=500, detail="No se pudo regenerar el token")
    return token


def _meli_get_connection(app: MLApp, connection: MLUserConnection, db: Session, url: str, params: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    token = _ensure_connection_token(db, connection, app)
    res = requests.get(url, headers={"Authorization": f"Bearer {token}"}, params=params, timeout=20)
    if res.status_code == 401:
        token = _ensure_connection_token(db, connection, app)
        res = requests.get(url, headers={"Authorization": f"Bearer {token}"}, params=params, timeout=20)
    if not res.ok:
        logging.error("MercadoLibre GET %s falló: %s", url, res.text)
        raise HTTPException(status_code=400, detail=f"MercadoLibre devolvió error: {res.text}")
    return res.json()


def _fetch_seller_profile(db: Session, app: MLApp, connection: MLUserConnection) -> dict[str, Any]:
    if USE_MELI_STUB:
        connection.seller_id = connection.seller_id or "TEST_SELLER_ID"
        connection.nickname = connection.nickname or "Seller Demo"
        connection.updated_at = datetime.utcnow()
        db.add(connection)
        db.commit()
        return {"id": connection.seller_id, "nickname": connection.nickname}

    try:
        data = _meli_get_connection(app, connection, db, "https://api.mercadolibre.com/users/me")
        connection.seller_id = data.get("id") or connection.seller_id
        connection.nickname = data.get("nickname") or connection.nickname
        connection.updated_at = datetime.utcnow()
        db.add(connection)
        db.commit()
        return data
    except HTTPException:
        return {"id": connection.seller_id, "nickname": connection.nickname}


def _connection_to_out(connection: MLUserConnection) -> MLConnectionOut:
    return MLConnectionOut(
        id=connection.id,
        app_alias=connection.app.alias if connection.app else "",
        seller_id=connection.seller_id,
        nickname=connection.nickname,
        updated_at=connection.updated_at,
        expires_at=connection.expires_at,
    )


def _get_connection_for_user(db: Session, user: User, app_alias: str) -> tuple[MLApp, MLUserConnection]:
    app = _get_app_or_404(db, alias=app_alias)
    connection = (
        db.query(MLUserConnection)
        .filter(MLUserConnection.app_id == app.id, MLUserConnection.user_id == user.id)
        .first()
    )
    if not connection:
        raise HTTPException(status_code=404, detail="No tienes conexión activa con Mercado Libre")
    return app, connection


def _sync_orders_payload(app: MLApp, connection: MLUserConnection, db: Session) -> dict[str, Any]:
    if USE_MELI_STUB:
        return DEMO_ORDERS

    seller_id = connection.seller_id
    if not seller_id:
        seller = _fetch_seller_profile(db, app, connection)
        seller_id = seller.get("id")

    params = {"seller": seller_id, "order.status": "paid", "limit": 50}
    return _meli_get_connection(app, connection, db, "https://api.mercadolibre.com/orders/search", params=params)


def _sync_inventory_payload(app: MLApp, connection: MLUserConnection, db: Session) -> dict[str, Any]:
    if USE_MELI_STUB:
        return {"active": DEMO_ACTIVE_LISTINGS, "paused": DEMO_PAUSED_LISTINGS}

    seller_id = connection.seller_id
    if not seller_id:
        seller = _fetch_seller_profile(db, app, connection)
        seller_id = seller.get("id")

    def _listings(status: str) -> dict[str, Any]:
        params = {"seller": seller_id, "status": status, "limit": 50}
        ids = _meli_get_connection(
            app,
            connection,
            db,
            "https://api.mercadolibre.com/users/{seller_id}/items/search".format(seller_id=seller_id),
            params=params,
        ).get("results", [])
        details = [
            _meli_get_connection(app, connection, db, f"https://api.mercadolibre.com/items/{item_id}")
            for item_id in ids[:20]
        ]
        return {"item_ids": ids, "details": details}

    return {"active": _listings("active"), "paused": _listings("paused")}


# ==============================
# ADMIN: CRUD DE APPS
# ==============================


@ml_admin_router.get("/apps", response_model=List[MLAppOut])
def list_apps(db: Session = Depends(get_db)):
    apps = db.query(MLApp).order_by(MLApp.created_at.desc()).all()
    return [_app_to_out(app) for app in apps]


@ml_admin_router.post("/apps", response_model=MLAppOut)
def create_app(payload: MLAppPayload, db: Session = Depends(get_db)):
    alias = _normalize_alias(payload.alias)
    if db.query(MLApp).filter(MLApp.alias == alias).first():
        raise HTTPException(status_code=400, detail="Ya existe una app con este alias")

    if not payload.client_secret:
        raise HTTPException(status_code=400, detail="client_secret es obligatorio")

    app = MLApp(
        alias=alias,
        site_id=payload.site_id.upper(),
        client_id=payload.client_id.strip(),
        client_secret_encrypted=encrypt_value(payload.client_secret.strip()),
        redirect_uri=str(payload.redirect_uri),
        webhook_url=str(payload.webhook_url) if payload.webhook_url else None,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return _app_to_out(app)


@ml_admin_router.put("/apps/{app_id}", response_model=MLAppOut)
def update_app(app_id: int, payload: MLAppPayload, db: Session = Depends(get_db)):
    app = _get_app_or_404(db, app_id=app_id)
    alias = _normalize_alias(payload.alias)

    existing = db.query(MLApp).filter(MLApp.alias == alias, MLApp.id != app_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="El alias ya está en uso")

    app.alias = alias
    app.site_id = payload.site_id.upper()
    app.client_id = payload.client_id.strip()
    app.redirect_uri = str(payload.redirect_uri)
    app.webhook_url = str(payload.webhook_url) if payload.webhook_url else None
    if payload.client_secret:
        app.client_secret_encrypted = encrypt_value(payload.client_secret.strip())
    app.updated_at = datetime.utcnow()

    db.add(app)
    db.commit()
    db.refresh(app)
    return _app_to_out(app)


@ml_admin_router.delete("/apps/{app_id}")
def delete_app(app_id: int, db: Session = Depends(get_db)):
    app = _get_app_or_404(db, app_id=app_id)
    db.delete(app)
    db.commit()
    return {"detail": "Aplicación eliminada"}


@ml_admin_router.post("/apps/{app_id}/test")
def test_app_connection(app_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    app = _get_app_or_404(db, app_id=app_id)
    state = _build_state(app.id, current_user.id)
    return {
        "authorization_url": _authorization_url_for_app(app, state),
        "state": state,
        "client_secret_masked": _mask_secret(decrypt_value(app.client_secret_encrypted)),
    }


# ==============================
# USUARIO: OAUTH & SINCRONIZACIÓN
# ==============================


@meli_router.get("/auth")
def start_user_auth(app_alias: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    app = _get_app_or_404(db, alias=app_alias)
    state = _build_state(app.id, current_user.id)
    return {
        "authorization_url": _authorization_url_for_app(app, state),
        "state": state,
        "app_alias": app.alias,
    }


@meli_router.get("/callback")
def handle_callback(code: str, state: str, db: Session = Depends(get_db)):
    try:
        app_id_str, user_id_str, *_ = state.split(":")
        app_id = int(app_id_str)
        user_id = int(user_id_str)
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Estado inválido")

    app = _get_app_or_404(db, app_id=app_id)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado para el callback")

    payload = {
        "grant_type": "authorization_code",
        "client_id": app.client_id,
        "client_secret": decrypt_value(app.client_secret_encrypted),
        "code": code,
        "redirect_uri": app.redirect_uri,
    }
    data = _perform_token_request(app, payload)
    connection = _store_user_tokens(db, user, app, data)
    seller = _fetch_seller_profile(db, app, connection)
    return {
        "detail": "Cuenta vinculada correctamente",
        "connection": _connection_to_out(connection),
        "seller": seller,
    }


class RefreshPayload(BaseModel):
    app_alias: str


class WebhookNotification(BaseModel):
    user_id: Optional[str] = None
    resource: Optional[str] = None
    topic: Optional[str] = None
    application_id: Optional[int] = None
    attempts: Optional[int] = None


@meli_router.post("/refresh")
def refresh_connection(payload: RefreshPayload, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    app, connection = _get_connection_for_user(db, current_user, payload.app_alias)
    token = _ensure_connection_token(db, connection, app)
    return {"access_token": token, "expires_at": connection.expires_at}


class DisconnectPayload(BaseModel):
    app_alias: str


@meli_router.post("/disconnect")
def disconnect_account(payload: DisconnectPayload, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    app, connection = _get_connection_for_user(db, current_user, payload.app_alias)
    db.delete(connection)
    db.commit()
    return {"detail": f"Conexión con {app.alias} eliminada"}


@meli_router.get("/status", response_model=Optional[MLConnectionOut])
def connection_status(app_alias: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        _, connection = _get_connection_for_user(db, current_user, app_alias)
        return _connection_to_out(connection)
    except HTTPException:
        return None


@meli_router.get("/sync")
def sync_data(app_alias: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    app, connection = _get_connection_for_user(db, current_user, app_alias)
    seller = _fetch_seller_profile(db, app, connection)
    orders = _sync_orders_payload(app, connection, db)
    inventory = _sync_inventory_payload(app, connection, db)
    connection.updated_at = datetime.utcnow()
    db.add(connection)
    db.commit()
    return {
        "seller": seller,
        "orders": orders,
        "inventory": inventory,
        "last_sync": connection.updated_at,
    }


@router.get("/sync")
def sync_overview(
    credential_id: int = Query(0, ge=0),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Devuelve seller, órdenes e inventario actualizados para el panel de usuario."""

    if credential_id == 0:
        return {
            "seller": DEMO_SELLER,
            "orders": DEMO_ORDERS,
            "inventory": {"active": DEMO_ACTIVE_LISTINGS, "paused": DEMO_PAUSED_LISTINGS},
            "last_sync": datetime.utcnow(),
        }

    cred = _credential_or_404(db, credential_id)
    _require_owner(cred, current_user.id)

    seller = _meli_get(cred, "https://api.mercadolibre.com/users/me", db)
    cred.seller_id = seller.get("id") or cred.seller_id
    cred.nickname = seller.get("nickname") or cred.nickname

    orders = recent_orders(cred.id, db, current_user)
    inventory = {
        "active": active_listings(cred.id, db, current_user),
        "paused": paused_listings(cred.id, db, current_user),
    }

    cred.updated_at = datetime.utcnow()
    db.add(cred)
    db.commit()

    return {"seller": seller, "orders": orders, "inventory": inventory, "last_sync": cred.updated_at}


def _extract_seller_id(notification: WebhookNotification) -> Optional[str]:
    if notification.user_id:
        return str(notification.user_id)
    if notification.resource:
        parts = notification.resource.strip("/").split("/")
        if parts:
            return parts[-1]
    return None


def _refresh_data_context_for_user(cred: MercadoLibreCredential, db: Session, user: Optional[User]) -> None:
    if not user:
        return

    try:
        from data_router import _DATA_CONTEXT
        from utils.data_engine import harmonize_sales_data, harmonize_stock_data

        sales_raw, _ = fetch_orders_dataframe(cred.id, db, user)
        stock_raw, _ = fetch_inventory_dataframe(cred.id, db, user)
        sales_df, _ = harmonize_sales_data(sales_raw, "mercadolibre")
        stock_df, _ = harmonize_stock_data(stock_raw, "mercadolibre")
        _DATA_CONTEXT.set_payload(
            str(user.id),
            sales_df,
            stock_df,
            "mercadolibre",
            raw_sales_df=sales_raw,
            raw_stock_df=stock_raw,
        )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logging.exception("No se pudo refrescar el contexto de datos para ML: %s", exc)


@router.post("/webhook")
def mercadolibre_webhook(payload: WebhookNotification, db: Session = Depends(get_db)):
    """Recibe notificaciones de MercadoLibre y refresca datos en memoria."""

    seller_id = _extract_seller_id(payload)
    if not seller_id:
        logging.info("Webhook ML recibido sin seller/user id. Payload: %s", payload.dict())
        return {"detail": "payload sin seller", "updated_users": []}

    creds = (
        db.query(MercadoLibreCredential)
        .filter(MercadoLibreCredential.seller_id == seller_id)
        .all()
    )
    updated_users: set[str] = set()

    if not creds:
        logging.warning("No se encontraron credenciales para seller_id %s", seller_id)
        return {"detail": "sin credenciales", "updated_users": []}

    for cred in creds:
        user = cred.user or db.query(User).filter(User.id == cred.user_id).first()
        try:
            _refresh_data_context_for_user(cred, db, user)
            updated_users.add(str(cred.user_id))
        except HTTPException as exc:  # noqa: PERF401
            logging.warning("Webhook ML no pudo actualizar usuario %s: %s", cred.user_id, exc)

    return {"detail": "ok", "updated_users": sorted(updated_users)}


def _authorization_url(credential: MercadoLibreCredential, state: str) -> str:
    domain = _get_country_domain(credential.country_code)
    base_url = f"https://auth.mercadolibre.{domain}/authorization"
    params = {
        "response_type": "code",
        "client_id": credential.client_id,
        "redirect_uri": credential.redirect_uri,
        "state": state,
    }
    return f"{base_url}?{urlencode(params)}"


def _require_owner(cred: MercadoLibreCredential, user_id: int) -> None:
    if cred.user_id != user_id:
        raise HTTPException(status_code=403, detail="No puedes acceder a estas credenciales")


def _store_tokens(db: Session, cred: MercadoLibreCredential, token_payload: dict[str, Any]) -> MercadoLibreCredential:
    access_token = token_payload.get("access_token")
    refresh_token = token_payload.get("refresh_token")
    expires_in = token_payload.get("expires_in") or 0

    if not access_token:
        raise HTTPException(status_code=400, detail="Respuesta sin access_token")

    cred.access_token_encrypted = encrypt_value(access_token)
    if refresh_token:
        cred.refresh_token_encrypted = encrypt_value(refresh_token)
    if expires_in:
        cred.access_token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

    cred.updated_at = datetime.utcnow()
    cred.seller_id = token_payload.get("user_id") or cred.seller_id
    cred.nickname = token_payload.get("nickname") or cred.nickname
    db.add(cred)
    db.commit()
    db.refresh(cred)
    return cred


def _ensure_token(db: Session, cred: MercadoLibreCredential) -> str:
    now = datetime.utcnow()
    if cred.access_token_encrypted and cred.access_token_expires_at and cred.access_token_expires_at > now + timedelta(minutes=2):
        token = decrypt_value(cred.access_token_encrypted)
        if token:
            return token

    refresh_token = decrypt_value(cred.refresh_token_encrypted)
    if not refresh_token:
        raise HTTPException(status_code=400, detail="No hay refresh_token guardado. Repite la autorización.")

    payload = {
        "grant_type": "refresh_token",
        "client_id": cred.client_id,
        "client_secret": decrypt_value(cred.client_secret_encrypted),
        "refresh_token": refresh_token,
    }

    res = requests.post("https://api.mercadolibre.com/oauth/token", data=payload, timeout=20)
    if not res.ok:
        logging.error("Error refrescando token de MercadoLibre: %s", res.text)
        raise HTTPException(status_code=400, detail="No se pudo refrescar el token de MercadoLibre")

    data = res.json()
    _store_tokens(db, cred, data)
    token = decrypt_value(cred.access_token_encrypted)
    if not token:
        raise HTTPException(status_code=500, detail="No se pudo recuperar el token actualizado")
    return token


def _meli_get(cred: MercadoLibreCredential, url: str, db: Session, params: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    token = _ensure_token(db, cred)
    res = requests.get(url, headers={"Authorization": f"Bearer {token}"}, params=params, timeout=20)
    if res.status_code == 401:
        token = _ensure_token(db, cred)
        res = requests.get(url, headers={"Authorization": f"Bearer {token}"}, params=params, timeout=20)
    if not res.ok:
        logging.error("MercadoLibre GET %s falló: %s", url, res.text)
        raise HTTPException(status_code=400, detail=f"MercadoLibre devolvió error: {res.text}")
    return res.json()


def _credential_or_404(db: Session, credential_id: int) -> MercadoLibreCredential:
    cred = db.query(MercadoLibreCredential).filter(MercadoLibreCredential.id == credential_id).first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credencial no encontrada")
    return cred


@router.post("/credentials", response_model=CredentialOut)
def create_credentials(payload: CredentialPayload, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    credential = MercadoLibreCredential(
        user_id=current_user.id,
        account_name=payload.account_name.strip() or "Principal",
        client_id=payload.client_id.strip(),
        client_secret_encrypted=encrypt_value(payload.client_secret.strip()),
        redirect_uri=str(payload.redirect_uri),
        country_code=payload.country_code.strip().upper(),
        webhook_url=str(payload.webhook_url) if payload.webhook_url else None,
    )
    db.add(credential)
    db.commit()
    db.refresh(credential)
    return CredentialOut(
        id=credential.id,
        account_name=credential.account_name,
        country_code=credential.country_code,
        redirect_uri=credential.redirect_uri,
        webhook_url=credential.webhook_url,
        seller_id=credential.seller_id,
        nickname=credential.nickname,
        has_tokens=bool(credential.access_token_encrypted),
        updated_at=credential.updated_at,
    )


@router.get("/credentials", response_model=List[CredentialOut])
def list_credentials(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    creds = (
        db.query(MercadoLibreCredential)
        .filter(MercadoLibreCredential.user_id == current_user.id)
        .order_by(MercadoLibreCredential.created_at.desc())
        .all()
    )
    response = [
        CredentialOut(
            id=c.id,
            account_name=c.account_name,
            country_code=c.country_code,
            redirect_uri=c.redirect_uri,
            webhook_url=c.webhook_url,
            seller_id=c.seller_id,
            nickname=c.nickname,
            has_tokens=bool(c.access_token_encrypted),
            updated_at=c.updated_at,
        )
        for c in creds
    ]
    response.insert(0, _demo_credential_out())
    return response


@router.get("/demo/credential", response_model=CredentialOut)
def demo_credential(current_user=Depends(get_current_user)):
    return _demo_credential_out()


@router.post("/credentials/{credential_id}/authorize")
def start_authorization(credential_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    cred = _credential_or_404(db, credential_id)
    _require_owner(cred, current_user.id)
    state = f"{cred.id}:{current_user.id}:{uuid.uuid4()}"
    return {"authorization_url": _authorization_url(cred, state), "state": state}


@router.get("/auth")
def meli_auth(credential_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Endpoint corto para iniciar OAuth desde frontend."""

    return start_authorization(credential_id, db, current_user)


@router.get("/oauth/callback")
def oauth_callback(code: str, state: str, db: Session = Depends(get_db)):
    try:
        parts = state.split(":")
        cred_id = int(parts[0])
        user_id = int(parts[1]) if len(parts) > 1 else None
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Estado inválido")

    cred = _credential_or_404(db, cred_id)
    if user_id and cred.user_id != user_id:
        raise HTTPException(status_code=403, detail="Estado no coincide con el propietario")

    payload = {
        "grant_type": "authorization_code",
        "client_id": cred.client_id,
        "client_secret": decrypt_value(cred.client_secret_encrypted),
        "code": code,
        "redirect_uri": cred.redirect_uri,
    }
    res = requests.post("https://api.mercadolibre.com/oauth/token", data=payload, timeout=20)
    if not res.ok:
        logging.error("Intercambio de código fallido: %s", res.text)
        raise HTTPException(status_code=400, detail="No se pudo obtener el token de MercadoLibre")

    data = res.json()
    _store_tokens(db, cred, data)
    return {"detail": "Cuenta vinculada correctamente", "credential_id": cred.id}


@router.get("/callback")
def meli_callback(code: str, state: str, db: Session = Depends(get_db)):
    """Alias amigable para recibir el callback de OAuth."""

    return oauth_callback(code, state, db)


@router.get("/credentials/{credential_id}/seller")
def seller_info(credential_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    cred = _credential_or_404(db, credential_id)
    _require_owner(cred, current_user.id)
    seller = _meli_get(cred, "https://api.mercadolibre.com/users/me", db)
    cred.seller_id = seller.get("id") or cred.seller_id
    cred.nickname = seller.get("nickname") or cred.nickname
    cred.updated_at = datetime.utcnow()
    db.add(cred)
    db.commit()
    return seller


@router.post("/refresh")
def refresh_token(credential_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Refresca manualmente el token de acceso cuando el frontend lo requiera."""

    cred = _credential_or_404(db, credential_id)
    _require_owner(cred, current_user.id)
    token = _ensure_token(db, cred)
    return {"access_token": token, "expires_at": cred.access_token_expires_at}


@router.get("/demo/seller")
def demo_seller(current_user=Depends(get_current_user)):
    return DEMO_SELLER


def _list_items(cred: MercadoLibreCredential, db: Session, status: str) -> List[str]:
    if not cred.seller_id:
        seller = _meli_get(cred, "https://api.mercadolibre.com/users/me", db)
        cred.seller_id = seller.get("id")
        db.add(cred)
        db.commit()
    params = {"seller": cred.seller_id, "status": status, "limit": 50}
    data = _meli_get(
        cred,
        "https://api.mercadolibre.com/users/{seller_id}/items/search".format(seller_id=cred.seller_id),
        db,
        params=params,
    )
    return data.get("results", [])


def _fetch_items_details(cred: MercadoLibreCredential, db: Session, item_ids: List[str]) -> List[dict[str, Any]]:
    details: List[dict[str, Any]] = []
    for item_id in item_ids:
        try:
            details.append(_meli_get(cred, f"https://api.mercadolibre.com/items/{item_id}", db))
        except HTTPException:
            continue
    return details


@router.get("/credentials/{credential_id}/listings/active")
def active_listings(credential_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    cred = _credential_or_404(db, credential_id)
    _require_owner(cred, current_user.id)
    ids = _list_items(cred, db, status="active")
    return {"item_ids": ids, "details": _fetch_items_details(cred, db, ids[:20])}


@router.get("/demo/listings/active")
def demo_active_listings(current_user=Depends(get_current_user)):
    return DEMO_ACTIVE_LISTINGS


@router.get("/credentials/{credential_id}/listings/paused")
def paused_listings(credential_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    cred = _credential_or_404(db, credential_id)
    _require_owner(cred, current_user.id)
    ids = _list_items(cred, db, status="paused")
    return {"item_ids": ids, "details": _fetch_items_details(cred, db, ids[:20])}


@router.get("/demo/listings/paused")
def demo_paused_listings(current_user=Depends(get_current_user)):
    return DEMO_PAUSED_LISTINGS


@router.get("/credentials/{credential_id}/orders")
def recent_orders(
    credential_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    limit: int = Query(50, ge=1, le=200),
):
    cred = _credential_or_404(db, credential_id)
    _require_owner(cred, current_user.id)
    if not cred.seller_id:
        seller = _meli_get(cred, "https://api.mercadolibre.com/users/me", db)
        cred.seller_id = seller.get("id")
        db.add(cred)
        db.commit()
    params = {"seller": cred.seller_id, "order.status": "paid", "limit": limit}
    data = _meli_get(cred, "https://api.mercadolibre.com/orders/search", db, params=params)
    return data


@router.get("/demo/orders")
def demo_orders(current_user=Depends(get_current_user)):
    return DEMO_ORDERS


def _orders_to_dataframe(orders: List[dict[str, Any]]) -> pd.DataFrame:
    rows: List[Dict[str, Any]] = []
    for order in orders:
        base_row = {
            "order_id": order.get("id"),
            "status": order.get("status"),
            "date_created": order.get("date_created"),
            "currency_id": order.get("currency_id"),
            "total_amount": order.get("total_amount"),
            "paid_amount": order.get("paid_amount"),
            "buyer_id": (order.get("buyer") or {}).get("id"),
            "buyer_nickname": (order.get("buyer") or {}).get("nickname"),
            "shipping_mode": (order.get("shipping") or {}).get("mode"),
            "site_id": order.get("site_id"),
        }
        items = order.get("order_items") or [{}]
        for item in items:
            row = base_row.copy()
            row.update(
                {
                    "item_id": (item.get("item") or {}).get("id"),
                    "title": (item.get("item") or {}).get("title"),
                    "quantity": item.get("quantity"),
                    "unit_price": item.get("unit_price"),
                    "full_unit_price": item.get("full_unit_price"),
                    "variation_id": (item.get("item") or {}).get("variation_id"),
                }
            )
            rows.append(row)
    if not rows:
        return pd.DataFrame()
    return pd.DataFrame(rows)


def _compute_sales_inventory_metrics(
    df: pd.DataFrame,
    active_listings: dict[str, Any] | None = None,
    paused_listings: dict[str, Any] | None = None,
) -> dict[str, Any]:
    metrics: dict[str, Any] = {"ventas": {}, "inventario": {}}

    if df.empty:
        return metrics

    total_orders = len(df)
    total_revenue = float(df.get("total_amount", pd.Series(dtype=float)).sum())
    customers = df.get("buyer_id", pd.Series(dtype=int)).nunique()
    success_mask = df.get("status", pd.Series(dtype=str)).str.lower().isin(
        {"paid", "shipped", "delivered", "closed"}
    )
    successful_orders = int(success_mask.sum()) if not success_mask.empty else 0

    parsed_dates = pd.to_datetime(df.get("date_created"), errors="coerce")
    sorted_dates = parsed_dates.dropna().sort_values()
    gaps = sorted_dates.diff().dropna()
    avg_cycle_days = float(gaps.mean().total_seconds() / 86400) if not gaps.empty else 0.0
    period_days = max((sorted_dates.max() - sorted_dates.min()).days or 1, 1) if not sorted_dates.empty else 30

    metrics["ventas"] = {
        "ingresos_totales": round(total_revenue, 2),
        "ordenes_totales": total_orders,
        "tasa_conversion_aprox": round((successful_orders / total_orders) * 100, 2)
        if total_orders
        else 0.0,
        "valor_promedio_cliente": round(total_revenue / customers, 2) if customers else 0.0,
        "ticket_promedio": round(total_revenue / total_orders, 2) if total_orders else 0.0,
        "ciclo_venta_promedio_dias": round(avg_cycle_days, 2),
        "ventas_por_region": [
            {"region": str(site), "monto": float(amount)}
            for site, amount in df.groupby("site_id")["total_amount"].sum().items()
        ],
    }

    active_details = (active_listings or {}).get("details", []) or []
    paused_details = (paused_listings or {}).get("details", []) or []
    inventory_rows = active_details + paused_details

    if inventory_rows:
        available_total = sum((item.get("available_quantity") or 0) for item in inventory_rows)
        sold_total = sum((item.get("sold_quantity") or 0) for item in inventory_rows)
        avg_inventory = max((available_total + sold_total) / 2, 1)
        turnover = sold_total / avg_inventory if avg_inventory else 0

        paused_ids = {item.get("id") for item in paused_details}
        paused_orders = df[df.get("item_id").isin(paused_ids)] if paused_ids else pd.DataFrame()
        backorder_rate = (
            round((len(paused_orders) / total_orders) * 100, 2) if total_orders and not paused_orders.empty else 0.0
        )

        order_qty_by_item = df.groupby("item_id")["quantity"].sum()
        discrepancy = 0.0
        reference_total = 0.0
        for item in inventory_rows:
            item_id = item.get("id")
            if not item_id:
                continue
            recorded_orders = float(order_qty_by_item.get(item_id, 0))
            expected = float(item.get("sold_quantity") or 0)
            reference_total += max(expected, recorded_orders, 0)
            discrepancy += abs(expected - recorded_orders)

        accuracy = (
            round((1 - (discrepancy / reference_total)) * 100, 2) if reference_total else 100.0
        )

        inventory_value = sum(
            (item.get("price") or 0) * (item.get("available_quantity") or 0) for item in inventory_rows
        )

        metrics["inventario"] = {
            "rotacion": round(turnover, 2),
            "valor_en_stock": round(inventory_value, 2),
            "dias_venta_inventario": round((avg_inventory / max(sold_total, 1)) * period_days, 2),
            "tasa_pedidos_pendientes": backorder_rate,
            "precision_registros": max(min(accuracy, 100.0), 0.0),
            "resumen_items": [
                {
                    "id": item.get("id"),
                    "titulo": item.get("title"),
                    "disponible": item.get("available_quantity"),
                    "vendido": item.get("sold_quantity"),
                    "estado": item.get("status"),
                }
                for item in inventory_rows
            ],
        }

    return metrics


def _analyze_orders_dataset(
    orders_payload: List[dict[str, Any]],
    current_user,
    *,
    active_listings: dict[str, Any] | None = None,
    paused_listings: dict[str, Any] | None = None,
    demo_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    df = _orders_to_dataframe(orders_payload)
    if df.empty:
        raise HTTPException(status_code=400, detail="No hay órdenes para analizar")

    user_identifier = None
    if isinstance(current_user, dict):
        user_identifier = current_user.get("username") or current_user.get("email")
    else:
        user_identifier = getattr(current_user, "username", None)

    result = analyze_file(
        df,
        date_field="date_created",
        metric_field="total_amount",
        segment_by="status",
        file_types={"mercadolibre"},
        usage_context={"source": "mercadolibre_orders", "user": user_identifier},
        user_id=user_identifier,
    )

    safe_sample = df.head(10).to_dict(orient="records")

    response: dict[str, Any] = {
        "summary": result.get("summary", {}),
        "sample": safe_sample,
        "graphs": result.get("graphs", []),
        "ai_summary": result.get("ai_summary", ""),
        "data_health": result.get("data_health", {}),
        "ai_schema": result.get("ai_schema"),
        "metadata": {
            "rows": len(df),
            "columns": list(df.columns),
            "source": "MercadoLibre",
        },
        "business_metrics": _compute_sales_inventory_metrics(
            df, active_listings=active_listings, paused_listings=paused_listings
        ),
    }

    if demo_metadata:
        response["demo_metadata"] = demo_metadata

    return response


def fetch_orders_dataframe(credential_id: int, db: Session, current_user) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Devuelve las órdenes de MercadoLibre en un DataFrame preparado para el motor de métricas."""

    if credential_id == 0:
        orders = DEMO_ORDERS.get("results") or []
        return _orders_to_dataframe(orders), {"source": "MercadoLibre (demo)"}

    data = recent_orders(credential_id, db, current_user, limit=200)
    orders = data.get("results") or []
    df = _orders_to_dataframe(orders)
    return df, {"source": "MercadoLibre"}


def fetch_inventory_dataframe(credential_id: int, db: Session, current_user) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Compila inventario activo/pausado en un DataFrame estándar."""

    if credential_id == 0:
        rows = (DEMO_ACTIVE_LISTINGS.get("details") or []) + (DEMO_PAUSED_LISTINGS.get("details") or [])
    else:
        active = active_listings(credential_id, db, current_user)
        paused = paused_listings(credential_id, db, current_user)
        rows = (active.get("details") or []) + (paused.get("details") or [])

    inventory_df = pd.DataFrame(rows)
    if not inventory_df.empty:
        inventory_df = inventory_df.rename(columns={"title": "product", "category_id": "category", "available_quantity": "stock"})
    return inventory_df, {"source": "MercadoLibre" if credential_id else "MercadoLibre (demo)"}


@router.get("/credentials/{credential_id}/analyze/orders")
def analyze_orders(credential_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if credential_id == 0:
        return _analyze_orders_dataset(
            DEMO_ORDERS.get("results") or [],
            current_user,
            active_listings=DEMO_ACTIVE_LISTINGS,
            paused_listings=DEMO_PAUSED_LISTINGS,
            demo_metadata={"is_demo": True, "source": "mercadolibre_demo"},
        )

    data = recent_orders(credential_id, db, current_user, limit=100)
    orders = data.get("results") or []

    return _analyze_orders_dataset(orders, current_user)


@router.get("/sync/orders")
def sync_orders(credential_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Entrega las órdenes en formato estándar para el motor de métricas."""

    df, meta = fetch_orders_dataframe(credential_id, db, current_user)
    standardized, mapping = standardize_dataframe(df)
    user_label = resolve_user_identifier(current_user) or "desconocido"
    persist_app_log(
        level="INFO",
        message=(
            f"Usuario {user_label} sincronizó órdenes de MercadoLibre "
            f"({len(standardized)} registros)"
        ),
        path="/mercadolibre/sync/orders",
        user=user_label,
    )
    return {
        "source": meta,
        "records": standardized.to_dict(orient="records"),
        "mapping": mapping,
    }


@router.get("/sync/orders/full")
def sync_orders_full(credential_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Recupera todas las órdenes históricas paginando de a 200 registros."""

    if credential_id == 0:
        df = _orders_to_dataframe(DEMO_ORDERS.get("results") or [])
        standardized, mapping = standardize_dataframe(df)
        return {
            "detail": "Importación completa simulada (demo). Puede tardar en cuentas reales.",
            "total": len(df),
            "records": standardized.to_dict(orient="records"),
            "mapping": mapping,
        }

    cred = _credential_or_404(db, credential_id)
    _require_owner(cred, current_user.id)
    if not cred.seller_id:
        seller = _meli_get(cred, "https://api.mercadolibre.com/users/me", db)
        cred.seller_id = seller.get("id")
        db.add(cred)
        db.commit()
        db.refresh(cred)

    limit = 200
    offset = 0
    all_orders: list[dict[str, Any]] = []

    while True:
        params = {"seller": cred.seller_id, "order.status": "paid", "limit": limit, "offset": offset}
        data = _meli_get(cred, "https://api.mercadolibre.com/orders/search", db, params=params)
        orders = data.get("results") or []
        all_orders.extend(orders)
        paging = data.get("paging") or {}
        total = paging.get("total", 0)

        if offset + limit >= total or not orders:
            break

        offset += limit

    df = _orders_to_dataframe(all_orders)
    standardized, mapping = standardize_dataframe(df)

    user_label = resolve_user_identifier(current_user) or "desconocido"
    persist_app_log(
        level="INFO",
        message=(
            f"Usuario {user_label} realizó sincronización completa de órdenes "
            f"de MercadoLibre ({len(standardized)} registros)"
        ),
        path="/mercadolibre/sync/orders/full",
        user=user_label,
    )

    # TODO: Guardar las órdenes completas en la base para futuros usos/consultas.
    return {
        "detail": "Sincronización completa ejecutada. Este proceso puede tardar unos minutos dependiendo del volumen de datos.",
        "total": len(all_orders),
        "records": standardized.to_dict(orient="records"),
        "mapping": mapping,
    }


@router.get("/sync/stock")
def sync_stock(credential_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Entrega inventario activo/pausado en formato estándar."""

    df, meta = fetch_inventory_dataframe(credential_id, db, current_user)
    standardized, mapping = standardize_dataframe(df)
    user_label = resolve_user_identifier(current_user) or "desconocido"
    persist_app_log(
        level="INFO",
        message=(
            f"Usuario {user_label} sincronizó inventario de MercadoLibre "
            f"({len(standardized)} registros)"
        ),
        path="/mercadolibre/sync/stock",
        user=user_label,
    )
    return {
        "source": meta,
        "records": standardized.to_dict(orient="records"),
        "mapping": mapping,
    }


@router.get("/sync/products")
def sync_products(credential_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Alias de inventario centrado en catálogo para el frontend."""

    return sync_stock(credential_id, db, current_user)

