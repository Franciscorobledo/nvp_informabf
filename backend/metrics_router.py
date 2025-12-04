from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
from data_router import _get_or_seed_data
from mercadolibre import fetch_inventory_dataframe, fetch_orders_dataframe
from utils.data_engine import (
    build_custom_chart,
    build_product_summary,
    compute_sales_metrics,
    compute_stock_metrics,
    harmonize_sales_data,
    harmonize_stock_data,
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


def _resolve_active_data(
    credential_id: Optional[int], db: Session, current_user
) -> Dict[str, Any]:
    if credential_id is not None:
        sales_raw, _ = fetch_orders_dataframe(credential_id, db, current_user)
        stock_raw, _ = fetch_inventory_dataframe(credential_id, db, current_user)
        sales_df, _ = harmonize_sales_data(sales_raw, "mercadolibre")
        stock_df, _ = harmonize_stock_data(stock_raw, "mercadolibre")
        source = "mercadolibre"
    else:
        ctx = _get_or_seed_data(str(current_user.id))
        sales_df = ctx.get("sales", pd.DataFrame())
        stock_df = ctx.get("stock", pd.DataFrame())
        source = ctx.get("source", "demo")

    return {"sales": sales_df, "stock": stock_df, "source": source}


def _column_types(df: pd.DataFrame) -> Dict[str, str]:
    return {col: str(dtype) for col, dtype in df.dtypes.items()}


def _serialize_records(df: pd.DataFrame, columns: List[str]) -> List[Dict[str, Any]]:
    if df.empty:
        return []
    safe_df = df.copy()
    for col in columns:
        if col not in safe_df.columns:
            safe_df[col] = None

    safe_df = safe_df[columns].copy()
    for col in columns:
        if pd.api.types.is_numeric_dtype(safe_df[col]):
            safe_df[col] = safe_df[col].fillna(0)
        else:
            safe_df[col] = safe_df[col].fillna("")

    return safe_df.to_dict(orient="records")


@router.get("/sales")
def get_sales_metrics(
    credential_id: Optional[int] = Query(None, description="Credencial de MercadoLibre"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """KPIs oficiales del panel de ventas."""

    ctx = _resolve_active_data(credential_id, db, current_user)
    sales_df: pd.DataFrame = ctx["sales"]

    total_sales = float(sales_df.get("revenue", 0).sum()) if not sales_df.empty else 0.0
    units_sold = float(sales_df.get("quantity_sold", 0).sum()) if not sales_df.empty else 0.0
    avg_ticket = total_sales / len(sales_df) if len(sales_df) else 0.0
    total_margin = float(sales_df.get("margin", 0).sum()) if not sales_df.empty else 0.0

    trend_chart = None
    if not sales_df.empty and "date" in sales_df:
        daily = (
            sales_df.copy()
            .assign(date=sales_df["date"].dt.date)
            .groupby("date")[["revenue", "quantity_sold"]]
            .sum()
            .reset_index()
        )
        trend_chart = {
            "type": "line",
            "title": "Ventas por día",
            "x": daily["date"].astype(str).tolist(),
            "series": [
                {"name": "Ventas", "data": daily["revenue"].round(2).tolist()},
                {"name": "Unidades", "data": daily["quantity_sold"].round(2).tolist()},
            ],
        }

    top_products = None
    if not sales_df.empty:
        top_products_df = (
            sales_df.groupby("product_name")[["revenue", "quantity_sold", "margin"]]
            .sum()
            .sort_values("revenue", ascending=False)
            .head(10)
            .reset_index()
        )
        top_products = {
            "type": "bar",
            "title": "Top productos",
            "x": top_products_df["product_name"].astype(str).tolist(),
            "series": [
                {"name": "Ventas", "data": top_products_df["revenue"].round(2).tolist()},
                {"name": "Unidades", "data": top_products_df["quantity_sold"].round(2).tolist()},
            ],
        }

    categories_chart = None
    if "category" in sales_df.columns:
        categories_df = (
            sales_df.groupby("category")["revenue"]
            .sum()
            .reset_index()
            .sort_values("revenue", ascending=False)
        )
        categories_chart = {
            "type": "pie",
            "title": "Ventas por categoría",
            "x": categories_df["category"].astype(str).tolist(),
            "series": [
                {"name": "Ventas", "data": categories_df["revenue"].round(2).tolist()}
            ],
        }

    table_df = (
        sales_df.groupby(["product_name", "category"], dropna=False)[
            ["revenue", "quantity_sold", "margin"]
        ]
        .sum()
        .reset_index()
        .sort_values("revenue", ascending=False)
    )

    return {
        "source": ctx["source"],
        "kpis": {
            "total_sales": total_sales,
            "units_sold": units_sold,
            "avg_ticket": avg_ticket,
            "margin": total_margin,
        },
        "charts": {
            "trend": trend_chart,
            "top_products": top_products,
            "categories": categories_chart,
        },
        "table": _serialize_records(
            table_df,
            ["product_name", "category", "revenue", "quantity_sold", "margin"],
        ),
        "column_types": _column_types(sales_df),
    }


@router.get("/stock")
def get_stock_metrics(
    credential_id: Optional[int] = Query(None, description="Credencial de MercadoLibre"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """KPIs oficiales del panel de stock."""

    ctx = _resolve_active_data(credential_id, db, current_user)
    summary = build_product_summary(ctx["sales"], ctx["stock"])

    stock_total = float(summary.get("current_stock", 0).sum()) if not summary.empty else 0.0
    critical = summary[summary["current_stock"] <= 10]
    without_rotation = summary[(summary["quantity_sold_last30"] <= 0) & (summary["current_stock"] > 0)]
    avg_days_inventory = (
        float(summary["days_inventory"].dropna().mean())
        if "days_inventory" in summary and not summary["days_inventory"].dropna().empty
        else 0.0
    )

    rotation_chart = None
    if not summary.empty:
        rotation_df = summary.sort_values("rotation", ascending=False).head(10)
        rotation_chart = {
            "type": "bar",
            "title": "Rotación (30d)",
            "x": rotation_df["product_name"].astype(str).tolist(),
            "series": [
                {"name": "Rotación", "data": rotation_df["rotation"].round(2).tolist()},
                {"name": "Stock", "data": rotation_df["current_stock"].round(2).tolist()},
            ],
        }

    dead_stock_chart = None
    dead_stock_df = summary[(summary["current_stock"] > 0) & (summary["quantity_sold_last30"] <= 0)]
    if not dead_stock_df.empty:
        dead_stock_chart = {
            "type": "bar",
            "title": "Stock muerto",
            "x": dead_stock_df["product_name"].astype(str).tolist(),
            "series": [
                {"name": "Stock", "data": dead_stock_df["current_stock"].round(2).tolist()}
            ],
        }

    semaphore_chart = None
    if not summary.empty:
        def _status(row):
            if row.get("current_stock", 0) <= 10:
                return "rojo"
            if row.get("rotation", 0) < 0.2:
                return "amarillo"
            return "verde"

        summary["status"] = summary.apply(_status, axis=1)
        semaphore_counts = summary["status"].value_counts().to_dict()
        semaphore_chart = {
            "type": "pie",
            "title": "Semáforo de stock",
            "x": list(semaphore_counts.keys()),
            "series": [
                {"name": "Productos", "data": list(semaphore_counts.values())}
            ],
        }

    table_columns = [
        "product_name",
        "current_stock",
        "quantity_sold_last30",
        "rotation",
        "days_inventory",
    ]

    if "category" in summary.columns:
        table_columns.insert(1, "category")

    return {
        "source": ctx["source"],
        "kpis": {
            "stock_total": stock_total,
            "critical_products": int(len(critical)),
            "dead_stock": int(len(without_rotation)),
            "avg_days_inventory": avg_days_inventory,
        },
        "charts": {
            "rotation": rotation_chart,
            "dead_stock": dead_stock_chart,
            "semaphore": semaphore_chart,
        },
        "table": _serialize_records(summary, table_columns),
        "column_types": _column_types(summary),
    }


@router.get("/comparative")
def get_comparative_metrics(
    credential_id: Optional[int] = Query(None, description="Credencial de MercadoLibre"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Comparativas mes vs mes, categoría y períodos."""

    ctx = _resolve_active_data(credential_id, db, current_user)
    sales_df: pd.DataFrame = ctx["sales"].copy()

    monthly_chart = None
    category_chart = None
    period_chart = None

    if not sales_df.empty and "date" in sales_df:
        sales_df["month"] = sales_df["date"].dt.to_period("M").astype(str)
        monthly = (
            sales_df.groupby("month")[["revenue", "quantity_sold"]]
            .sum()
            .sort_index()
            .reset_index()
        )
        monthly_chart = {
            "type": "line",
            "title": "Mes vs Mes",
            "x": monthly["month"].tolist(),
            "series": [
                {"name": "Ventas", "data": monthly["revenue"].round(2).tolist()},
                {"name": "Unidades", "data": monthly["quantity_sold"].round(2).tolist()},
            ],
        }

        last_period = sales_df["date"].max()
        cutoff_current = last_period - pd.Timedelta(days=30)
        cutoff_previous = cutoff_current - pd.Timedelta(days=30)

        current_period = sales_df[sales_df["date"] >= cutoff_current]
        previous_period = sales_df[
            (sales_df["date"] < cutoff_current) & (sales_df["date"] >= cutoff_previous)
        ]

        period_chart = {
            "type": "bar",
            "title": "Período vs Período (30d)",
            "x": ["Período actual", "Período previo"],
            "series": [
                {
                    "name": "Ventas",
                    "data": [
                        float(current_period.get("revenue", 0).sum()),
                        float(previous_period.get("revenue", 0).sum()),
                    ],
                },
                {
                    "name": "Unidades",
                    "data": [
                        float(current_period.get("quantity_sold", 0).sum()),
                        float(previous_period.get("quantity_sold", 0).sum()),
                    ],
                },
            ],
        }

    if "category" in sales_df.columns:
        categories = (
            sales_df.groupby("category")[["revenue", "margin"]]
            .sum()
            .reset_index()
            .sort_values("revenue", ascending=False)
        )
        category_chart = {
            "type": "bar",
            "title": "Categoría vs Categoría",
            "x": categories["category"].astype(str).tolist(),
            "series": [
                {"name": "Ventas", "data": categories["revenue"].round(2).tolist()},
                {"name": "Margen", "data": categories["margin"].round(2).tolist()},
            ],
        }

    return {
        "source": ctx["source"],
        "charts": {
            "monthly": monthly_chart,
            "categories": category_chart,
            "periods": period_chart,
        },
    }


@router.get("/summary")
def get_ai_summary(
    credential_id: Optional[int] = Query(None, description="Credencial de MercadoLibre"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Resumen automático con IA."""

    ctx = _resolve_active_data(credential_id, db, current_user)
    sales_df = ctx["sales"]
    column_types = _column_types(sales_df)
    ai_summary = summarize_business(sales_df, column_types)

    return {"source": ctx["source"], **ai_summary}


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

    metric_aliases = {
        "sales": "revenue",
        "units": "quantity_sold",
        "margin": "margin",
        "stock": "current_stock",
        "rotation": "rotation",
        "revenue": "revenue",
        "quantity": "quantity_sold",
    }
    dimension_aliases = {
        "product": "product_name",
        "product_name": "product_name",
        "category": "category",
        "date": "date",
    }

    metric_column = metric_aliases.get(payload.metric, payload.metric)
    dimension_column = dimension_aliases.get(payload.dimension, payload.dimension)

    if payload.data:
        df = pd.DataFrame(payload.data)
        normalized = _standardize(df)
        base_df = normalized["df"]
    else:
        ctx = _resolve_active_data(payload.credential_id, db, current_user)
        base_df = build_product_summary(ctx.get("sales", pd.DataFrame()), ctx.get("stock", pd.DataFrame()))
        normalized = {"column_types": _column_types(base_df), "mapping": {}}

    try:
        chart = build_custom_chart(base_df, metric_column, dimension_column, payload.chart_type)
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

