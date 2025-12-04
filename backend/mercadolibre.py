from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import requests
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, HttpUrl
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from models import MercadoLibreCredential
from utils.crypto_utils import decrypt_value, encrypt_value
from analysis import analyze_file
import pandas as pd


router = APIRouter(prefix="/mercadolibre", tags=["MercadoLibre"])

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


def _get_country_domain(country_code: str) -> str:
    return SITE_DOMAINS.get(country_code.upper(), "com")


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
    return [
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


@router.post("/credentials/{credential_id}/authorize")
def start_authorization(credential_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    cred = _credential_or_404(db, credential_id)
    _require_owner(cred, current_user.id)
    state = f"{cred.id}:{current_user.id}:{uuid.uuid4()}"
    return {"authorization_url": _authorization_url(cred, state), "state": state}


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


@router.get("/credentials/{credential_id}/listings/paused")
def paused_listings(credential_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    cred = _credential_or_404(db, credential_id)
    _require_owner(cred, current_user.id)
    ids = _list_items(cred, db, status="paused")
    return {"item_ids": ids, "details": _fetch_items_details(cred, db, ids[:20])}


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


@router.get("/credentials/{credential_id}/analyze/orders")
def analyze_orders(credential_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    data = recent_orders(credential_id, db, current_user, limit=100)
    orders = data.get("results") or []
    df = _orders_to_dataframe(orders)
    if df.empty:
        raise HTTPException(status_code=400, detail="No hay órdenes para analizar")

    result = analyze_file(
        df,
        date_field="date_created",
        metric_field="total_amount",
        segment_by="status",
        file_types={"mercadolibre"},
        usage_context={"source": "mercadolibre_orders", "user": current_user.username},
        user_id=current_user.username,
    )

    safe_sample = df.head(10).to_dict(orient="records")
    return {
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
    }

