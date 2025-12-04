from __future__ import annotations

import threading
from datetime import datetime
from typing import Any, Dict, Optional

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from auth import get_current_user
from database import get_db
from mercadolibre import fetch_inventory_dataframe, fetch_orders_dataframe
from utils.data_engine import (
    aggregate_manual_metrics,
    harmonize_sales_data,
    harmonize_stock_data,
    compute_auto_metrics,
)
from utils.dataframe_loader import read_dataframes

router = APIRouter(prefix="/data", tags=["Motor de datos"])


class _DataContext:
    def __init__(self):
        self._lock = threading.Lock()
        self._store: Dict[str, Dict[str, Any]] = {}

    def set_payload(
        self,
        user_id: str,
        sales_df: Optional[pd.DataFrame],
        stock_df: Optional[pd.DataFrame],
        source: str,
    ) -> None:
        if sales_df is None and stock_df is None:
            raise ValueError("Debe proveer ventas o stock")
        with self._lock:
            self._store[user_id] = {
                "sales": sales_df if sales_df is not None else pd.DataFrame(),
                "stock": stock_df if stock_df is not None else pd.DataFrame(),
                "source": source,
                "updated_at": datetime.utcnow(),
            }

    def get(self, user_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            payload = self._store.get(user_id)
            return payload.copy() if payload else None


_DATA_CONTEXT = _DataContext()


SAMPLE_SALES = pd.DataFrame(
    [
        {"date": "2024-05-02", "product": "Zapatilla Run", "category": "Calzado", "quantity": 6, "price": 52000, "cost": 31000},
        {"date": "2024-05-05", "product": "Buzo Urbano", "category": "Indumentaria", "quantity": 4, "price": 42000, "cost": 21000},
        {"date": "2024-06-01", "product": "Zapatilla Run", "category": "Calzado", "quantity": 8, "price": 54000, "cost": 32000},
        {"date": "2024-06-04", "product": "Campera Softshell", "category": "Indumentaria", "quantity": 3, "price": 99000, "cost": 55000},
        {"date": "2024-06-15", "product": "Gorra Classic", "category": "Accesorios", "quantity": 12, "price": 15000, "cost": 6000},
        {"date": "2024-07-02", "product": "Zapatilla Trail", "category": "Calzado", "quantity": 5, "price": 73000, "cost": 41000},
        {"date": "2024-07-08", "product": "Buzo Urbano", "category": "Indumentaria", "quantity": 6, "price": 43000, "cost": 21000},
        {"date": "2024-07-12", "product": "Campera Softshell", "category": "Indumentaria", "quantity": 2, "price": 100000, "cost": 57000},
    ]
)

SAMPLE_STOCK = pd.DataFrame(
    [
        {"product": "Zapatilla Run", "category": "Calzado", "stock": 120},
        {"product": "Buzo Urbano", "category": "Indumentaria", "stock": 80},
        {"product": "Campera Softshell", "category": "Indumentaria", "stock": 35},
        {"product": "Gorra Classic", "category": "Accesorios", "stock": 300},
        {"product": "Zapatilla Trail", "category": "Calzado", "stock": 45},
    ]
)


class ManualRequest(BaseModel):
    metric: str
    dimension: str
    filters: Optional[Dict[str, Any]] = None
    chart_type: str = "bar"


class SourceRequest(BaseModel):
    source: str
    credential_id: Optional[int] = None


class UploadResponse(BaseModel):
    source: str
    sales_rows: int = 0
    stock_rows: int = 0
    updated_at: datetime


class AutoMetricsResponse(BaseModel):
    source: str
    updated_at: datetime
    kpis: Dict[str, Any]
    chart_data: Optional[Dict[str, Any]] = None
    table_data: Optional[list] = None


class ManualMetricsResponse(BaseModel):
    source: str
    updated_at: datetime
    chart_data: Dict[str, Any]
    table_data: list
    meta: Dict[str, Any]


def _load_dataframe_from_upload(upload: UploadFile) -> pd.DataFrame:
    try:
        content = upload.file.read()
        dataframes = read_dataframes(upload, content)
        if not dataframes:
            raise HTTPException(status_code=400, detail="No se pudo leer el archivo")
        return dataframes[0]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _json_safe(data: Any):
    if isinstance(data, pd.DataFrame):
        return data.to_dict(orient="records")
    if isinstance(data, (datetime, pd.Timestamp)):
        return data.isoformat()
    if isinstance(data, float) and pd.isna(data):
        return None
    if isinstance(data, list):
        return [_json_safe(v) for v in data]
    if isinstance(data, dict):
        return {k: _json_safe(v) for k, v in data.items()}
    return data


def _get_or_seed_data(user_id: str) -> Dict[str, Any]:
    payload = _DATA_CONTEXT.get(user_id)
    if payload:
        return payload

    sales, _ = harmonize_sales_data(SAMPLE_SALES.copy(), "demo")
    stock, _ = harmonize_stock_data(SAMPLE_STOCK.copy(), "demo")
    _DATA_CONTEXT.set_payload(user_id, sales, stock, "demo")
    return _DATA_CONTEXT.get(user_id) or {}


@router.post("/upload", response_model=UploadResponse)
async def upload_data(
    *,
    sales_file: Optional[UploadFile] = File(None, description="Archivo de ventas"),
    stock_file: Optional[UploadFile] = File(None, description="Archivo de stock"),
    current_user=Depends(get_current_user),
):
    """Recibe archivos de ventas/stock, los normaliza y los deja como fuente activa."""

    if sales_file is None and stock_file is None:
        raise HTTPException(status_code=400, detail="Debes enviar al menos un archivo")

    sales_df: Optional[pd.DataFrame] = None
    stock_df: Optional[pd.DataFrame] = None

    if sales_file is not None:
        raw_sales = _load_dataframe_from_upload(sales_file)
        sales_df, _ = harmonize_sales_data(raw_sales, "files")

    if stock_file is not None:
        raw_stock = _load_dataframe_from_upload(stock_file)
        stock_df, _ = harmonize_stock_data(raw_stock, "files")

    _DATA_CONTEXT.set_payload(str(current_user.id), sales_df, stock_df, "files")
    payload = _DATA_CONTEXT.get(str(current_user.id))

    return UploadResponse(
        source=payload["source"],
        sales_rows=len(payload.get("sales", [])),
        stock_rows=len(payload.get("stock", [])),
        updated_at=payload.get("updated_at", datetime.utcnow()),
    )


@router.post("/source", response_model=UploadResponse)
async def select_source(
    payload: SourceRequest,
    db=Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Activa MercadoLibre o archivos como fuente para el motor."""

    source = payload.source.lower()
    user_id = str(current_user.id)

    if source == "mercadolibre":
        credential_id = payload.credential_id or 0
        sales_raw, _ = fetch_orders_dataframe(credential_id, db, current_user)
        stock_raw, _ = fetch_inventory_dataframe(credential_id, db, current_user)
        sales_df, _ = harmonize_sales_data(sales_raw, "mercadolibre")
        stock_df, _ = harmonize_stock_data(stock_raw, "mercadolibre")
        _DATA_CONTEXT.set_payload(user_id, sales_df, stock_df, "mercadolibre")
    elif source == "files":
        current = _DATA_CONTEXT.get(user_id)
        if not current:
            raise HTTPException(status_code=400, detail="Primero sube archivos de ventas/stock")
        _DATA_CONTEXT.set_payload(user_id, current.get("sales"), current.get("stock"), "files")
    else:
        raise HTTPException(status_code=400, detail="Fuente no soportada")

    payload_ctx = _DATA_CONTEXT.get(user_id)
    return UploadResponse(
        source=payload_ctx["source"],
        sales_rows=len(payload_ctx.get("sales", [])),
        stock_rows=len(payload_ctx.get("stock", [])),
        updated_at=payload_ctx.get("updated_at", datetime.utcnow()),
    )


@router.get("/metrics/auto", response_model=AutoMetricsResponse)
async def auto_metrics(current_user=Depends(get_current_user)):
    """Calcula KPIs automáticos usando la fuente activa (MercadoLibre o archivos)."""

    ctx = _get_or_seed_data(str(current_user.id))
    metrics = compute_auto_metrics(ctx.get("sales", pd.DataFrame()), ctx.get("stock", pd.DataFrame()))

    return AutoMetricsResponse(
        source=ctx.get("source", "demo"),
        updated_at=ctx.get("updated_at", datetime.utcnow()),
        kpis=_json_safe(metrics.get("kpis", {})),
        chart_data=_json_safe(metrics.get("chart_data")),
        table_data=_json_safe(metrics.get("table_data", [])),
    )


@router.post("/metrics/manual", response_model=ManualMetricsResponse)
async def manual_metrics(
    payload: ManualRequest,
    current_user=Depends(get_current_user),
):
    """Agrega métricas según la configuración del usuario (modo manual)."""

    ctx = _get_or_seed_data(str(current_user.id))

    try:
        results = aggregate_manual_metrics(
            ctx.get("sales", pd.DataFrame()),
            ctx.get("stock", pd.DataFrame()),
            payload.metric,
            payload.dimension,
            payload.filters,
            payload.chart_type,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return ManualMetricsResponse(
        source=ctx.get("source", "demo"),
        updated_at=ctx.get("updated_at", datetime.utcnow()),
        chart_data=_json_safe(results.get("chart_data")),
        table_data=_json_safe(results.get("table_data", [])),
        meta=_json_safe(results.get("meta", {})),
    )
