import logging
import os
from datetime import datetime, timedelta
from typing import Dict, Optional

import requests
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import admin_required, get_current_user
from database import get_db
from models import Subscription, SubscriptionPlan, User
from utils.mercadopago_keys import get_mp_access_token, persist_mp_access_token

router = APIRouter(prefix="/subscriptions", tags=["Suscripciones"])

MP_WEBHOOK_SECRET = os.getenv("MP_WEBHOOK_SECRET")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")
BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:1000")

PLAN_PRIORITY = {"starter": 1, "pro": 2, "premium": 3}
DEFAULT_PLANS = [
    {
        "name": "Starter",
        "alias": "starter",
        "price_monthly": 9900,
        "currency": "CLP",
        "description": "Funciones esenciales de carga de datos y KPIs básicos.",
        "features": [
            "Carga de CSV/Excel",
            "KPIs principales",
            "Panel básico",
        ],
    },
    {
        "name": "Pro",
        "alias": "pro",
        "price_monthly": 19900,
        "currency": "CLP",
        "description": "Incluye integraciones con Mercado Libre y reportes PDF.",
        "features": [
            "Todo en Starter",
            "Integración Mercado Libre",
            "Reportes PDF",
        ],
    },
    {
        "name": "Premium",
        "alias": "premium",
        "price_monthly": 34900,
        "currency": "CLP",
        "description": "IA avanzada, predicciones y alertas inteligentes.",
        "features": [
            "Todo en Pro",
            "IA avanzada y predicciones",
            "Alertas inteligentes",
        ],
    },
]


class SubscriptionCreate(BaseModel):
    plan_id: int


class PlanUpdate(BaseModel):
    price_monthly: Optional[float] = None
    currency: Optional[str] = None


class MercadoPagoTokenPayload(BaseModel):
    access_token: str


class SubscriptionSummary(BaseModel):
    subscription_status: str
    current_plan: Optional[Dict]
    current_period_end: Optional[datetime]
    provider: Optional[str]


def ensure_default_plans(db: Session) -> None:
    existing_aliases = {p.alias for p in db.query(SubscriptionPlan).all()}
    created = 0
    for plan in DEFAULT_PLANS:
        if plan["alias"] in existing_aliases:
            continue
        db_plan = SubscriptionPlan(**plan, created_at=datetime.utcnow())
        db.add(db_plan)
        created += 1
    if created:
        db.commit()
        logging.info("Planes creados por defecto: %s", created)


def _resolve_plan_priority(alias: Optional[str]) -> int:
    if not alias:
        return 0
    return PLAN_PRIORITY.get(alias.lower(), 0)


def require_plan(min_plan_alias: str):
    async def dependency(user: User = Depends(get_current_user)):
        user_plan_alias = user.current_plan.alias.lower() if user.current_plan else None
        if user.subscription_status != "active" or _resolve_plan_priority(user_plan_alias) < PLAN_PRIORITY.get(
            min_plan_alias, 0
        ):
            raise HTTPException(
                status_code=402,
                detail="Tu plan actual no permite acceder a esta función. Mejora tu plan en /planes.",
            )
        return user

    return dependency


@router.get("/plans")
def list_plans(db: Session = Depends(get_db)):
    plans = db.query(SubscriptionPlan).order_by(SubscriptionPlan.price_monthly.asc()).all()
    return [
        {
            "id": plan.id,
            "name": plan.name,
            "alias": plan.alias,
            "price_monthly": plan.price_monthly,
            "currency": plan.currency,
            "description": plan.description,
            "features": plan.features or [],
        }
        for plan in plans
    ]


@router.get("/admin/plans", dependencies=[Depends(admin_required)])
def admin_list_plans(db: Session = Depends(get_db)):
    plans = db.query(SubscriptionPlan).order_by(SubscriptionPlan.price_monthly.asc()).all()
    return [
        {
            "id": plan.id,
            "name": plan.name,
            "alias": plan.alias,
            "price_monthly": plan.price_monthly,
            "currency": plan.currency,
            "description": plan.description,
            "features": plan.features or [],
            "created_at": plan.created_at,
        }
        for plan in plans
    ]


@router.put("/admin/plans/{plan_id}", dependencies=[Depends(admin_required)])
def update_plan(plan_id: int, payload: PlanUpdate, db: Session = Depends(get_db)):
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")

    if payload.price_monthly is None and payload.currency is None:
        raise HTTPException(status_code=400, detail="No se enviaron cambios para actualizar")

    updated = False
    if payload.price_monthly is not None:
        plan.price_monthly = payload.price_monthly
        updated = True
    if payload.currency is not None:
        plan.currency = payload.currency
        updated = True

    if updated:
        db.add(plan)
        db.commit()
        db.refresh(plan)

    return {
        "status": "ok",
        "message": "Plan actualizado correctamente",
        "plan": {
            "id": plan.id,
            "name": plan.name,
            "alias": plan.alias,
            "price_monthly": plan.price_monthly,
            "currency": plan.currency,
            "description": plan.description,
            "features": plan.features or [],
        },
    }


@router.get("/admin/mercadopago/status", dependencies=[Depends(admin_required)])
def mercadopago_status():
    token = get_mp_access_token()
    return {"access_token_present": bool(token)}


@router.post("/admin/mercadopago/token", dependencies=[Depends(admin_required)])
def update_mp_token(payload: MercadoPagoTokenPayload):
    try:
        persist_mp_access_token(payload.access_token)
    except ValueError as exc:  # pragma: no cover - simple validation
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {"status": "ok", "message": "Token de Mercado Pago actualizado."}


@router.post("/create")
def create_subscription(payload: SubscriptionCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    plan = db.query(SubscriptionPlan).filter(SubscriptionPlan.id == payload.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan no encontrado")

    mp_access_token = get_mp_access_token()
    if not mp_access_token:
        raise HTTPException(status_code=500, detail="Mercado Pago no está configurado")

    back_url = f"{FRONTEND_BASE_URL.rstrip('/')}/suscripcion/estado"
    webhook_url = f"{BACKEND_BASE_URL.rstrip('/')}/subscriptions/mercadopago/webhook"
    mp_payload = {
        "reason": f"Suscripción InformeBF – {plan.name}",
        "auto_recurring": {
            "frequency": 1,
            "frequency_type": "months",
            "transaction_amount": plan.price_monthly,
            "currency_id": plan.currency,
        },
        "back_url": back_url,
        "external_reference": f"user-{user.id}-plan-{plan.alias}-{datetime.utcnow().isoformat()}",
        "payer_email": user.username,
        "notification_url": webhook_url,
    }

    headers = {
        "Authorization": f"Bearer {mp_access_token}",
        "Content-Type": "application/json",
    }

    response = requests.post(
        "https://api.mercadopago.com/preapproval",
        headers=headers,
        json=mp_payload,
        timeout=30,
    )

    if response.status_code not in {200, 201}:
        logging.error("Mercado Pago error: %s", response.text)
        raise HTTPException(status_code=502, detail="No se pudo iniciar la suscripción en Mercado Pago")

    mp_data = response.json()
    init_point = mp_data.get("init_point") or mp_data.get("sandbox_init_point")
    preapproval_id = mp_data.get("id")

    subscription = Subscription(
        user_id=user.id,
        plan_id=plan.id,
        status="pending",
        provider="mercadopago",
        mp_preapproval_id=preapproval_id,
        mp_init_point=init_point,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(subscription)
    db.commit()
    db.refresh(subscription)

    return {"status": "ok", "redirect_url": init_point}


@router.post("/mercadopago/webhook")
async def mercadopago_webhook(request: Request, db: Session = Depends(get_db)):
    if MP_WEBHOOK_SECRET:
        provided = request.headers.get("X-Signature")
        if MP_WEBHOOK_SECRET and provided != MP_WEBHOOK_SECRET:
            return {"status": "ignored"}

    payload = await request.json()
    preapproval_id = payload.get("id") or payload.get("data", {}).get("id")
    if not preapproval_id:
        logging.warning("Webhook sin preapproval id: %s", payload)
        return {"status": "ignored"}

    subscription = db.query(Subscription).filter(Subscription.mp_preapproval_id == preapproval_id).first()
    if not subscription:
        logging.warning("Suscripción no encontrada para preapproval %s", preapproval_id)
        return {"status": "not_found"}

    mp_access_token = get_mp_access_token()
    headers = {"Authorization": f"Bearer {mp_access_token}"}
    mp_response = requests.get(
        f"https://api.mercadopago.com/preapproval/{preapproval_id}", headers=headers, timeout=30
    )
    if mp_response.status_code not in {200, 201}:
        logging.error("No se pudo consultar preapproval %s", preapproval_id)
        return {"status": "error"}

    data = mp_response.json()
    mp_status = data.get("status")
    now = datetime.utcnow()

    if mp_status == "authorized":
        subscription.status = "active"
        subscription.started_at = subscription.started_at or now
        subscription.current_period_end = now + timedelta(days=30)
        subscription.cancelled_at = None
    elif mp_status in {"cancelled", "paused"}:
        subscription.status = "cancelled"
        subscription.cancelled_at = now
    elif mp_status == "pending":
        subscription.status = "pending"
    else:
        subscription.status = "expired"

    subscription.updated_at = now
    db.add(subscription)

    user = subscription.user
    if subscription.status == "active":
        user.current_plan_id = subscription.plan_id
        user.subscription_status = "active"
    elif subscription.status == "pending":
        user.subscription_status = "pending"
    elif subscription.status == "cancelled":
        user.subscription_status = "cancelled"
    else:
        user.subscription_status = "expired"

    db.add(user)
    db.commit()

    return {"status": "ok"}


@router.get("/me", response_model=SubscriptionSummary)
def subscription_me(user: User = Depends(get_current_user)):
    plan = user.current_plan
    current_plan = None
    if plan:
        current_plan = {
            "name": plan.name,
            "alias": plan.alias,
            "price_monthly": plan.price_monthly,
            "currency": plan.currency,
        }

    latest_subscription = user.subscriptions[0] if user.subscriptions else None
    return {
        "subscription_status": user.subscription_status,
        "current_plan": current_plan,
        "current_period_end": latest_subscription.current_period_end if latest_subscription else None,
        "provider": latest_subscription.provider if latest_subscription else None,
    }
