"""Motor unificado de análisis para ventas e inventario.

Este módulo centraliza la normalización de datos provenientes de archivos
(CSV/XLSX/ZIP) o de integraciones externas (MercadoLibre) para producir una
salida consistente hacia el frontend: KPIs, gráficos sugeridos, tablas y
alertas.
"""

from __future__ import annotations

import math
import unicodedata
from datetime import datetime
from typing import Any, Dict, Iterable, List, Tuple

import numpy as np
import pandas as pd

from ai_module import generate_ai_insights

# Palabras clave por columna estándar
COLUMN_SYNONYMS = {
    "date": {"fecha", "date", "created_at", "order_date", "fecha venta", "fecha pedido"},
    "product": {"producto", "product", "item", "sku", "articulo", "title", "item_title"},
    "category": {"categoria", "category", "segmento", "rubro", "family"},
    "quantity": {"cantidad", "quantity", "qty", "unidades", "units", "sold_quantity"},
    "price": {"precio", "price", "unit_price", "total", "importe", "paid_amount", "amount"},
    "cost": {"costo", "cost", "unit_cost", "costo_unitario"},
    "stock": {"stock", "inventario", "available_quantity", "existencias", "on_hand"},
}


def _normalize(text: str) -> str:
    """Normaliza texto eliminando acentos y espacios."""

    if text is None:
        return ""
    normalized = unicodedata.normalize("NFD", str(text))
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn").strip().lower()


def detect_key_columns(df: pd.DataFrame) -> Dict[str, str]:
    """Detecta columnas clave devolviendo el mapeo estándar → columna original."""

    mapping: Dict[str, str] = {}
    normalized_cols = {col: _normalize(col) for col in df.columns}

    for standard, keywords in COLUMN_SYNONYMS.items():
        for original, normalized in normalized_cols.items():
            if normalized in keywords:
                mapping[standard] = original
                break

    # Heurísticas adicionales
    if "date" not in mapping:
        for col in df.columns:
            series = pd.to_datetime(df[col], errors="coerce", utc=True)
            if series.notna().mean() > 0.6:
                mapping["date"] = col
                break

    if "quantity" not in mapping:
        numeric_candidates = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
        for col in numeric_candidates:
            if any(keyword in normalized_cols[col] for keyword in ["qty", "cant", "unit"]):
                mapping["quantity"] = col
                break

    return mapping


def standardize_dataframe(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, str]]:
    """Renombra columnas a un esquema estándar y tipa los campos clave."""

    mapping = detect_key_columns(df)
    renamed = df.copy()

    column_aliases = {
        mapping.get("date", "date"): "date",
        mapping.get("product", "product"): "product",
        mapping.get("category", "category"): "category",
        mapping.get("quantity", "quantity"): "quantity",
        mapping.get("price", "price"): "price",
        mapping.get("cost", "cost"): "cost",
        mapping.get("stock", "stock"): "stock",
    }

    renamed = renamed.rename(columns=column_aliases)

    if "date" in renamed.columns:
        renamed["date"] = pd.to_datetime(renamed["date"], errors="coerce")

    for numeric_col in ["quantity", "price", "cost", "stock"]:
        if numeric_col in renamed.columns:
            renamed[numeric_col] = pd.to_numeric(renamed[numeric_col], errors="coerce")

    return renamed, mapping


def _safe_mean(series: pd.Series) -> float:
    valid = pd.to_numeric(series, errors="coerce")
    if valid.empty:
        return 0.0
    return float(valid.mean())


def _safe_sum(series: pd.Series) -> float:
    valid = pd.to_numeric(series, errors="coerce")
    if valid.empty:
        return 0.0
    return float(valid.sum())


def _build_kpi(label: str, value: Any, fmt: str = "number", delta: float | None = None) -> Dict[str, Any]:
    payload: Dict[str, Any] = {"label": label, "value": value, "format": fmt}
    if delta is not None:
        payload["delta"] = delta
    return payload


def compute_sales_metrics(df: pd.DataFrame) -> Dict[str, Any]:
    """Calcula métricas de ventas básicas y visualizaciones sugeridas."""

    if df.empty:
        return {"kpis": {}, "charts": [], "table": []}

    kpis: Dict[str, Any] = {}
    total_units = _safe_sum(df.get("quantity")) if "quantity" in df else len(df)
    revenue_series = None
    if "price" in df.columns and "quantity" in df.columns:
        revenue_series = df["price"].fillna(0) * df["quantity"].fillna(0)
    elif "price" in df.columns:
        revenue_series = df["price"].fillna(0)

    total_revenue = _safe_sum(revenue_series) if revenue_series is not None else 0.0
    kpis["total_sales"] = _build_kpi("Ventas totales", round(total_revenue, 2), "currency")
    kpis["units_sold"] = _build_kpi("Unidades vendidas", int(total_units), "number")

    avg_ticket = total_revenue / total_units if total_units else 0.0
    kpis["avg_ticket"] = _build_kpi("Ticket promedio", round(avg_ticket, 2), "currency")

    if "cost" in df.columns:
        costs = df["cost"].fillna(0) * df.get("quantity", 1)
        margin_value = total_revenue - _safe_sum(costs)
        margin_pct = (margin_value / total_revenue * 100) if total_revenue else 0
        kpis["margin"] = _build_kpi("Margen", round(margin_value, 2), "currency")
        kpis["margin_pct"] = _build_kpi("Margen %", round(margin_pct, 2), "percent")

    charts: List[Dict[str, Any]] = []
    if "date" in df.columns and revenue_series is not None:
        daily = (
            df.assign(date=df["date"].dt.date)
            .groupby("date")[["quantity", "price"]]
            .sum()
            .reset_index()
        )
        daily["revenue"] = daily.get("price", 0) * daily.get("quantity", 0)
        charts.append(
            {
                "type": "line",
                "title": "Evolución diaria de ventas",
                "x": daily["date"].astype(str).tolist(),
                "series": [
                    {"name": "Ingresos", "data": daily["revenue"].round(2).tolist()},
                    {"name": "Unidades", "data": daily["quantity"].round(2).tolist()},
                ],
            }
        )

    if "product" in df.columns and revenue_series is not None:
        top_products = (
            df.assign(revenue=revenue_series)
            .groupby("product")["revenue"]
            .sum()
            .nlargest(10)
            .reset_index()
        )
        charts.append(
            {
                "type": "bar",
                "title": "Top 10 productos por ingresos",
                "x": top_products["product"].astype(str).tolist(),
                "series": [{"name": "Ingresos", "data": top_products["revenue"].round(2).tolist()}],
            }
        )

    table_preview = df.head(50).to_dict(orient="records")

    alerts: List[str] = []
    if avg_ticket and avg_ticket < _safe_mean(df.get("price", pd.Series(dtype=float))):
        alerts.append("El ticket promedio está por debajo del precio promedio; revisa descuentos y combos.")

    return {"kpis": kpis, "charts": charts, "table": table_preview, "alerts": alerts}


def compute_stock_metrics(df: pd.DataFrame) -> Dict[str, Any]:
    """Calcula métricas de inventario y riesgos de quiebre."""

    if df.empty:
        return {"kpis": {}, "charts": [], "table": [], "alerts": []}

    kpis: Dict[str, Any] = {}
    alerts: List[str] = []

    current_stock = _safe_sum(df.get("stock"))
    sold_units = _safe_sum(df.get("quantity"))

    avg_inventory = max((current_stock + sold_units) / 2, 1)
    rotation = sold_units / avg_inventory if avg_inventory else 0
    kpis["rotation"] = _build_kpi("Rotación", round(rotation, 2))

    daily_sales = sold_units / max((df["date"].max() - df["date"].min()).days or 1, 1) if "date" in df else 0
    days_inventory = current_stock / daily_sales if daily_sales else math.inf
    kpis["days_inventory"] = _build_kpi("Días de inventario", round(days_inventory, 2) if math.isfinite(days_inventory) else None)

    dead_stock = df[(df.get("quantity", 0) <= 0) | (df.get("stock", 0) > df.get("quantity", 0) * 12)]
    kpis["dead_stock_items"] = _build_kpi("SKU con baja rotación", int(len(dead_stock)))

    if daily_sales and current_stock < daily_sales * 7:
        alerts.append("⚠️ Riesgo de quiebre: inventario menor a una semana de ventas promedio.")

    if not dead_stock.empty:
        alerts.append("SKU con rotación nula o muy baja detectados; considera promociones o liquidación.")

    charts: List[Dict[str, Any]] = []
    if "product" in df.columns and "stock" in df.columns:
        top_stock = df.sort_values("stock", ascending=False).head(15)
        charts.append(
            {
                "type": "bar",
                "title": "Stock disponible por producto",
                "x": top_stock["product"].astype(str).tolist(),
                "series": [{"name": "Stock", "data": top_stock["stock"].fillna(0).round(2).tolist()}],
            }
        )

    table_preview = df.head(50).to_dict(orient="records")

    return {"kpis": kpis, "charts": charts, "table": table_preview, "alerts": alerts}


def build_custom_chart(df: pd.DataFrame, metric: str, dimension: str, chart_type: str = "bar") -> Dict[str, Any]:
    """Agrega una métrica personalizada agrupada por dimensión."""

    if metric not in df.columns or dimension not in df.columns:
        raise ValueError("Métrica o dimensión no encontrada en el dataset estandarizado")

    grouped = df.groupby(dimension)[metric].sum().reset_index()
    grouped = grouped.sort_values(metric, ascending=False).head(30)

    return {
        "type": chart_type,
        "title": f"{metric} por {dimension}",
        "x": grouped[dimension].astype(str).tolist(),
        "series": [{"name": metric, "data": grouped[metric].round(2).tolist()}],
    }


def summarize_business(df: pd.DataFrame, column_types: Dict[str, str]) -> Dict[str, Any]:
    """Genera un resumen consultivo asistido por IA."""

    sample = df.head(100).to_dict(orient="records")
    ai_payload = generate_ai_insights(
        {
            "data_health": {},
            "graphs": [],
            "summary": {"rows": len(df), "columns": list(df.columns)},
            "sample": sample,
            "column_types": column_types,
        }
    )

    return {
        "ai_summary": ai_payload.get("ai_summary"),
        "insights": ai_payload.get("refined_insights") or ai_payload.get("insights"),
    }

