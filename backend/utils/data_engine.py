"""Motor unificado de análisis para ventas e inventario.

Este módulo centraliza la normalización de datos provenientes de archivos
(CSV/XLSX/ZIP) o de integraciones externas (MercadoLibre) para producir una
salida consistente hacia el frontend: KPIs, gráficos sugeridos, tablas y
alertas.
"""

from __future__ import annotations

import math
import unicodedata
from datetime import datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional, Tuple

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
    renamed = renamed.loc[:, ~renamed.columns.duplicated()]

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


# =============================================================
#   NUEVO MOTOR DE DATOS UNIFICADO (VENTAS + STOCK)
# =============================================================


def harmonize_sales_data(df: pd.DataFrame, source: str = "files") -> Tuple[pd.DataFrame, Dict[str, str]]:
    """Normaliza ventas para exponer un esquema común orientado a métricas comerciales."""

    standardized, mapping = standardize_dataframe(df)
    sales = standardized.copy()

    sales["product_id"] = sales.get("sku") or sales.get("product")
    sales["product_name"] = sales.get("product")
    sales["date"] = pd.to_datetime(sales.get("date"), errors="coerce")

    def _numeric_series(values, default, index):
        series = values if isinstance(values, (pd.Series, pd.Index)) else None
        if series is None:
            series = pd.Series(default, index=index, dtype=float)
        return pd.to_numeric(series, errors="coerce").fillna(default)

    sales["quantity_sold"] = _numeric_series(sales.get("quantity"), 1, sales.index)
    price_series = _numeric_series(sales.get("price"), 0, sales.index)
    sales["revenue"] = price_series * sales["quantity_sold"]
    sales["cost"] = _numeric_series(sales.get("cost"), 0, sales.index)
    sales["margin"] = sales["revenue"] - (sales["cost"] * sales["quantity_sold"])
    sales["current_stock"] = np.nan
    sales["channel"] = source

    if "category" not in sales:
        sales["category"] = None

    columns = [
        "product_id",
        "product_name",
        "category",
        "date",
        "quantity_sold",
        "revenue",
        "cost",
        "margin",
        "current_stock",
        "channel",
    ]

    return sales[columns], mapping


def harmonize_stock_data(df: pd.DataFrame, source: str = "files") -> Tuple[pd.DataFrame, Dict[str, str]]:
    """Normaliza inventario actual al mismo esquema de métricas."""

    standardized, mapping = standardize_dataframe(df)
    stock = standardized.copy()

    stock["product_id"] = stock.get("sku") or stock.get("product")
    stock["product_name"] = stock.get("product")

    def _numeric_stock(values, default, index):
        series = values if isinstance(values, (pd.Series, pd.Index)) else None
        if series is None:
            series = pd.Series(default, index=index, dtype=float)
        return pd.to_numeric(series, errors="coerce").fillna(default)

    stock["current_stock"] = _numeric_stock(stock.get("stock"), 0, stock.index)
    stock["quantity_sold"] = 0
    stock["revenue"] = 0
    stock["cost"] = _numeric_stock(stock.get("cost"), 0, stock.index)
    stock["margin"] = 0
    stock["date"] = pd.NaT
    stock["channel"] = source

    if "category" not in stock:
        stock["category"] = None

    columns = [
        "product_id",
        "product_name",
        "category",
        "date",
        "quantity_sold",
        "revenue",
        "cost",
        "margin",
        "current_stock",
        "channel",
    ]

    return stock[columns], mapping


def build_product_summary(sales_df: pd.DataFrame, stock_df: pd.DataFrame) -> pd.DataFrame:
    """Agrega ventas + stock por producto, calculando rotación y días de inventario."""

    sales_df = sales_df.copy()
    stock_df = stock_df.copy()

    sales_df["revenue"] = pd.to_numeric(sales_df.get("revenue", 0), errors="coerce").fillna(0)
    sales_df["margin"] = pd.to_numeric(sales_df.get("margin", 0), errors="coerce").fillna(0)
    sales_df["quantity_sold"] = pd.to_numeric(sales_df.get("quantity_sold", 0), errors="coerce").fillna(0)

    sales_agg = (
        sales_df.groupby(["product_id", "product_name", "category"], dropna=False)
        .agg({"revenue": "sum", "margin": "sum", "quantity_sold": "sum", "date": "max"})
        .reset_index()
    )

    stock_agg = (
        stock_df.groupby(["product_id", "product_name", "category"], dropna=False)["current_stock"]
        .sum()
        .reset_index()
    )

    combined = pd.merge(
        sales_agg,
        stock_agg,
        on=["product_id", "product_name", "category"],
        how="outer",
        suffixes=("_sales", "_stock"),
    )

    combined["revenue"] = combined.get("revenue", 0).fillna(0)
    combined["margin"] = combined.get("margin", 0).fillna(0)
    combined["quantity_sold"] = combined.get("quantity_sold", 0).fillna(0)
    combined["current_stock"] = combined.get("current_stock", 0).fillna(0)

    if not sales_df.empty and "date" in sales_df:
        last_date = sales_df["date"].max()
        cutoff = last_date - timedelta(days=30)
        recent = sales_df[sales_df["date"] >= cutoff]
        recent_units = recent.groupby("product_name")["quantity_sold"].sum().reset_index()
        combined = combined.merge(recent_units, on="product_name", how="left", suffixes=("", "_last30"))
        combined["quantity_sold_last30"] = combined.get("quantity_sold_last30", 0).fillna(0)
    else:
        combined["quantity_sold_last30"] = 0
        last_date = None

    combined["rotation"] = combined.apply(
        lambda row: float(row["quantity_sold_last30"]) / max(row["current_stock"], 1)
        if pd.notna(row.get("current_stock"))
        else 0,
        axis=1,
    )

    def _inventory_days(row):
        daily_units = row["quantity_sold_last30"] / 30 if row["quantity_sold_last30"] else 0
        if daily_units <= 0:
            return None
        return float(row["current_stock"] / daily_units) if row.get("current_stock") is not None else None

    combined["days_inventory"] = combined.apply(_inventory_days, axis=1)
    combined["last_sale_date"] = combined.get("date")
    combined["data_freshness"] = last_date

    return combined.fillna({"product_name": "Sin nombre", "category": "Sin categoría"})


def compute_auto_metrics(sales_df: pd.DataFrame, stock_df: pd.DataFrame, low_stock_threshold: int = 10) -> Dict[str, Any]:
    """Calcula KPIs automáticos y datasets listos para gráfica/tabla."""

    summary = build_product_summary(sales_df, stock_df)

    kpis: Dict[str, Any] = {}
    total_sales = float(summary["revenue"].sum()) if not summary.empty else 0.0
    total_units = float(summary["quantity_sold"].sum()) if not summary.empty else 0.0
    total_margin = float(summary["margin"].sum()) if not summary.empty else 0.0
    orders_count = len(sales_df) if not sales_df.empty else 0
    avg_ticket = total_sales / orders_count if orders_count else 0.0

    kpis["total_sales"] = _build_kpi("Ventas totales", round(total_sales, 2), "currency")
    kpis["total_units"] = _build_kpi("Unidades", int(total_units))
    kpis["avg_ticket"] = _build_kpi("Ticket promedio", round(avg_ticket, 2), "currency")
    kpis["total_margin"] = _build_kpi("Margen total", round(total_margin, 2), "currency")

    if not summary.empty:
        top_sales = summary.sort_values("revenue", ascending=False).head(1)
        top_margin = summary.sort_values("margin", ascending=False).head(1)
        if not top_sales.empty:
            kpis["top_product_by_sales"] = _build_kpi(
                "Top por ventas", top_sales.iloc[0]["product_name"]
            )
        if not top_margin.empty:
            kpis["top_product_by_margin"] = _build_kpi(
                "Top por margen", top_margin.iloc[0]["product_name"]
            )

    total_stock_units = float(stock_df.get("current_stock", 0).sum()) if not stock_df.empty else 0.0
    kpis["total_stock_units"] = _build_kpi("Unidades en stock", round(total_stock_units, 2))

    low_stock_products = summary[summary["current_stock"] < low_stock_threshold]
    kpis["products_with_low_stock"] = _build_kpi(
        "SKU con stock bajo", int(len(low_stock_products))
    )

    if "last_sale_date" in summary.columns:
        cutoff = datetime.utcnow() - timedelta(days=45)
        without_movement = summary[(summary["current_stock"] > 0) & (summary["last_sale_date"].fillna(pd.Timestamp(0)) < cutoff)]
        kpis["products_without_movement"] = _build_kpi("Sin movimiento", int(len(without_movement)))
    else:
        kpis["products_without_movement"] = _build_kpi("Sin movimiento", 0)

    slow_rotation = summary[(summary["rotation"] <= 0.2) & (summary["current_stock"] > low_stock_threshold)]
    kpis["products_with_slow_rotation"] = _build_kpi("Rotación lenta", int(len(slow_rotation)))

    star_candidates = summary[(summary["revenue"] > total_sales * 0.05) & (summary["margin"] > total_margin * 0.05)]
    kpis["products_star"] = _build_kpi("Productos estrella", int(len(star_candidates)))

    chart_data = None
    if not summary.empty:
        ranked = summary.sort_values("quantity_sold", ascending=False).head(10)
        chart_data = {
            "type": "bar",
            "title": "Top 10 productos por unidades vendidas",
            "x": ranked["product_name"].astype(str).tolist(),
            "series": [
                {"name": "Unidades", "data": ranked["quantity_sold"].round(2).tolist()},
                {"name": "Stock", "data": ranked["current_stock"].round(2).tolist()},
            ],
        }

    table_columns = [
        "product_name",
        "category",
        "revenue",
        "margin",
        "quantity_sold",
        "current_stock",
        "rotation",
        "days_inventory",
    ]
    table_data = summary[table_columns].fillna(0)
    table_records = table_data.to_dict(orient="records")

    return {
        "kpis": kpis,
        "chart_data": chart_data,
        "table_data": table_records,
    }


def aggregate_manual_metrics(
    sales_df: pd.DataFrame,
    stock_df: pd.DataFrame,
    metric: str,
    dimension: str,
    filters: Optional[Dict[str, Any]] = None,
    chart_type: str = "bar",
) -> Dict[str, Any]:
    """Agrega métricas según selección de usuario (modo manual)."""

    filters = filters or {}
    metric_map = {
        "sales": "revenue",
        "units": "quantity_sold",
        "margin": "margin",
        "stock": "current_stock",
        "rotation": "rotation",
    }

    metric_column = metric_map.get(metric)
    if not metric_column:
        raise ValueError("Métrica no soportada")

    if metric in {"stock", "rotation"}:
        base_df = build_product_summary(sales_df, stock_df)
    else:
        base_df = sales_df.copy()

    if "date_from" in filters and "date" in base_df:
        base_df = base_df[base_df["date"] >= pd.to_datetime(filters["date_from"], errors="coerce")]
    if "date_to" in filters and "date" in base_df:
        base_df = base_df[base_df["date"] <= pd.to_datetime(filters["date_to"], errors="coerce")]
    if filters.get("category") and "category" in base_df:
        base_df = base_df[base_df["category"] == filters["category"]]

    if dimension not in base_df.columns:
        raise ValueError("La dimensión seleccionada no existe en los datos")

    grouped = base_df.groupby(dimension)[metric_column].sum().reset_index()
    grouped = grouped.sort_values(metric_column, ascending=False)

    top_n = int(filters.get("top_n") or 0)
    if top_n:
        grouped = grouped.head(top_n)

    chart_payload = {
        "type": chart_type,
        "title": f"{metric_column} por {dimension}",
        "x": grouped[dimension].astype(str).tolist(),
        "series": [{"name": metric_column, "data": grouped[metric_column].round(2).tolist()}],
    }

    return {
        "chart_data": chart_payload,
        "table_data": grouped.to_dict(orient="records"),
        "meta": {"metric": metric, "dimension": dimension, "filters": filters},
    }

