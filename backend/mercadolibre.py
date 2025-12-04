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
from utils.data_engine import standardize_dataframe


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
    return {
        "source": meta,
        "records": standardized.to_dict(orient="records"),
        "mapping": mapping,
    }


@router.get("/sync/stock")
def sync_stock(credential_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Entrega inventario activo/pausado en formato estándar."""

    df, meta = fetch_inventory_dataframe(credential_id, db, current_user)
    standardized, mapping = standardize_dataframe(df)
    return {
        "source": meta,
        "records": standardized.to_dict(orient="records"),
        "mapping": mapping,
    }


@router.get("/sync/products")
def sync_products(credential_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Alias de inventario centrado en catálogo para el frontend."""

    return sync_stock(credential_id, db, current_user)

