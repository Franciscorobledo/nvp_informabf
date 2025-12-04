from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from mercadolibre import fetch_inventory_dataframe, fetch_orders_dataframe
from utils.data_engine import (
    build_custom_chart,
    compute_sales_metrics,
    compute_stock_metrics,
    standardize_dataframe,
    summarize_business,
)
from utils.dataframe_loader import read_dataframes


router = APIRouter(prefix="/metrics", tags=["KPIs"], responses={404: {"description": "No encontrado"}})


def _load_dataframe_from_upload(upload: UploadFile) -> pd.DataFrame:
    try:
        content = upload.file.read()
        dataframes = read_dataframes(upload, content)
        if not dataframes:
            raise HTTPException(status_code=400, detail="No se pudo leer el archivo")
        return dataframes[0]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _standardize(df: pd.DataFrame) -> Dict[str, Any]:
    standardized, mapping = standardize_dataframe(df)
    column_types = {col: str(dtype) for col, dtype in standardized.dtypes.items()}
    return {"df": standardized, "mapping": mapping, "column_types": column_types}


@router.post("/sales")
def sales_metrics(
    *,
    file: Optional[UploadFile] = File(None, description="CSV/XLSX con ventas"),
    data: Optional[List[Dict[str, Any]]] = Body(None, description="Lista de registros ya cargados"),
    credential_id: Optional[int] = Body(None, description="Credencial de MercadoLibre"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Devuelve KPIs de ventas, gráficos sugeridos y tabla normalizada."""

    df: pd.DataFrame
    source = "archivo"

    if file is not None:
        df = _load_dataframe_from_upload(file)
    elif credential_id is not None:
        df, meta = fetch_orders_dataframe(credential_id, db, current_user)
        source = meta.get("source", "MercadoLibre")
    elif data is not None:
        df = pd.DataFrame(data)
        source = "json"
    else:
        raise HTTPException(status_code=400, detail="Debes enviar un archivo, data JSON o credential_id")

    normalized = _standardize(df)
    metrics = compute_sales_metrics(normalized["df"])

    return {
        "source": source,
        "kpis": metrics.get("kpis"),
        "charts": metrics.get("charts"),
        "table": metrics.get("table"),
        "alerts": metrics.get("alerts"),
        "column_types": normalized["column_types"],
        "mapping": normalized["mapping"],
    }


@router.post("/stock")
def stock_metrics(
    *,
    file: Optional[UploadFile] = File(None, description="CSV/XLSX con inventario"),
    data: Optional[List[Dict[str, Any]]] = Body(None, description="Datos ya cargados"),
    credential_id: Optional[int] = Body(None, description="Credencial MercadoLibre"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Retorna rotación, días de inventario y alertas de riesgo."""

    if file is not None:
        df = _load_dataframe_from_upload(file)
        source = "archivo"
    elif credential_id is not None:
        df, meta = fetch_inventory_dataframe(credential_id, db, current_user)
        source = meta.get("source", "MercadoLibre")
    elif data is not None:
        df = pd.DataFrame(data)
        source = "json"
    else:
        raise HTTPException(status_code=400, detail="Debes enviar un archivo, data JSON o credential_id")

    normalized = _standardize(df)
    metrics = compute_stock_metrics(normalized["df"])

    return {
        "source": source,
        "kpis": metrics.get("kpis"),
        "charts": metrics.get("charts"),
        "table": metrics.get("table"),
        "alerts": metrics.get("alerts"),
        "column_types": normalized["column_types"],
        "mapping": normalized["mapping"],
    }


class CustomChartPayload(BaseModel):
    metric: str
    dimension: str
    chart_type: str = "bar"
    data: Optional[List[Dict[str, Any]]] = None
    credential_id: Optional[int] = None


@router.post("/custom")
def custom_chart(
    payload: CustomChartPayload,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Genera un gráfico personalizado agrupando métricas por dimensión."""

    df: pd.DataFrame
    if payload.data:
        df = pd.DataFrame(payload.data)
    elif payload.credential_id is not None:
        df, _ = fetch_orders_dataframe(payload.credential_id, db, current_user)
    else:
        raise HTTPException(status_code=400, detail="Se requiere data inline o credential_id")

    normalized = _standardize(df)
    try:
        chart = build_custom_chart(normalized["df"], payload.metric, payload.dimension, payload.chart_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "chart": chart,
        "column_types": normalized["column_types"],
        "mapping": normalized["mapping"],
    }


class SummaryPayload(BaseModel):
    data: Optional[List[Dict[str, Any]]] = None
    credential_id: Optional[int] = None


@router.post("/summary")
def summary(payload: SummaryPayload, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Devuelve un resumen consultivo generado con IA."""

    if payload.data:
        df = pd.DataFrame(payload.data)
    elif payload.credential_id is not None:
        df, _ = fetch_orders_dataframe(payload.credential_id, db, current_user)
    else:
        raise HTTPException(status_code=400, detail="Debes enviar data o credential_id")

    normalized = _standardize(df)
    ai_summary = summarize_business(normalized["df"], normalized["column_types"])

    return {
        "ai_summary": ai_summary.get("ai_summary"),
        "insights": ai_summary.get("insights"),
        "column_types": normalized["column_types"],
        "mapping": normalized["mapping"],
    }

