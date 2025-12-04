from __future__ import annotations

import threading
from datetime import datetime
import io
from typing import Any, Dict, Literal, Optional, Tuple

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from auth import get_current_user
from ai_module import classify_tabular_dataset
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
ingest_router = APIRouter(prefix="/ingest", tags=["Ingesta inteligente"])


STANDARD_SCHEMA_DOC = """
VENTAS (sales):
- date
- sku
- product_name
- quantity
- unit_price
- total
- channel

STOCK (inventory):
- sku
- product_name
- category
- current_stock
- unit_cost
- location
"""

SALES_REQUIRED = {"date", "sku"}
SALES_OPTIONAL = {"product_name", "channel"}
STOCK_REQUIRED = {"sku", "current_stock"}
STOCK_OPTIONAL = {"category", "location"}


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


class IngestedDataset(BaseModel):
    type: str
    row_count: int
    column_mapping: Dict[str, str]
    missing_required: list
    missing_optional: list
    classification_source: str = "openai"
    warnings: list[str] = Field(default_factory=list)


class IngestResponse(BaseModel):
    status: str
    datasets: list[IngestedDataset]


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


def _dataset_preview(df: pd.DataFrame) -> Tuple[list[str], list[dict]]:
    columns = list(df.columns)
    sample_rows = df.head(15).fillna("").to_dict(orient="records")
    return columns, sample_rows


def _heuristic_classify(columns: list[str], sample_rows: list[dict]) -> dict:
    """Clasifica datasets tabulares sin depender de OpenAI.

    Esto es un salvavidas para entornos sin credenciales de IA: detecta patrones
    comunes en español/inglés y arma un mapping básico de columnas.
    """

    lower_columns = [col.lower() for col in columns]
    used_columns: set[str] = set()

    def _match(synonyms: list[str]) -> Optional[str]:
        for original, lower in zip(columns, lower_columns):
            if original in used_columns:
                continue
            if any(token in lower for token in synonyms):
                used_columns.add(original)
                return original
        return None

    mapping: Dict[str, str] = {}

    # Campos de ventas
    mapping["date"] = _match(["fecha", "date", "día", "dia"])
    mapping["sku"] = _match(
        ["sku", "codigo", "código", "producto", "product_id", "item", "articulo", "artículo", "sucursal", "tienda", "id"]
    )
    mapping["product_name"] = _match(
        ["producto", "product", "item", "articulo", "artículo", "nombre", "descripcion", "categoría", "categoria"]
    )
    mapping["quantity"] = _match(["cantidad", "unidades", "qty", "ticket", "tickets"])
    mapping["unit_price"] = _match(["precio", "price", "unit_price", "p.u", "pu", "importe_unitario"])
    mapping["total"] = _match(["total", "venta", "ventas", "monto", "importe", "venta_neta", "neto", "facturacion", "ingreso"])
    mapping["channel"] = _match(["canal", "channel", "sucursal", "tienda", "marketplace", "plataforma"])

    # Campos de stock
    mapping.setdefault("current_stock", _match(["stock_final", "stock", "inventario", "existencia", "stock_actual", "stock_inicial"]))
    mapping.setdefault("category", _match(["categoria", "categoría", "familia", "rubro"]))
    mapping.setdefault("unit_cost", _match(["costo", "coste", "unit_cost", "costo_unitario"]))
    mapping.setdefault("location", _match(["almacen", "almacén", "bodega", "deposito", "depósito", "ubicacion", "sucursal", "tienda"]))

    sales_signals = any(token in lc for lc in lower_columns for token in ["venta", "ticket", "factur", "precio"])
    stock_signals = any(token in lc for lc in lower_columns for token in ["stock", "inventario", "existencia"])

    dtype: Literal["sales", "stock", "unknown"] = "unknown"

    if ("current_stock" in mapping and mapping["current_stock"]) or stock_signals:
        dtype = "stock"
    elif sales_signals or (mapping.get("date") and (mapping.get("total") or mapping.get("quantity"))):
        dtype = "sales"

    # Validar campos mínimos para no devolver falsos positivos
    if dtype == "sales" and (not mapping.get("date") or not mapping.get("sku")):
        dtype = "unknown"
    if dtype == "stock" and (not mapping.get("sku") or not mapping.get("current_stock")):
        dtype = "unknown"

    return {"type": dtype, "columns": {k: v for k, v in mapping.items() if v}}


def _normalize_sales(df: pd.DataFrame, mapping: Dict[str, str], source: str) -> pd.DataFrame:
    renamed = df.rename(columns=mapping)
    normalized = pd.DataFrame()
    normalized["date"] = pd.to_datetime(renamed.get("date"), errors="coerce")
    normalized["sku"] = renamed.get("sku")
    product_series = renamed.get("product_name")
    if product_series is None:
        product_series = renamed.get("sku")
    normalized["product_name"] = product_series
    normalized["quantity"] = pd.to_numeric(renamed.get("quantity"), errors="coerce")
    normalized["unit_price"] = pd.to_numeric(renamed.get("unit_price"), errors="coerce")
    normalized["total"] = pd.to_numeric(renamed.get("total"), errors="coerce")
    normalized["channel"] = renamed.get("channel", source) if "channel" in renamed else source

    if normalized["total"].isna().all() and "quantity" in normalized and "unit_price" in normalized:
        normalized["total"] = (normalized["quantity"].fillna(1) * normalized["unit_price"].fillna(0)).astype(float)

    if normalized["quantity"].isna().all() and "total" in normalized and "unit_price" in normalized:
        with_price = normalized["unit_price"].replace(0, pd.NA)
        normalized["quantity"] = (normalized["total"] / with_price).replace([np.inf, -np.inf], pd.NA)

    return normalized


def _normalize_stock(df: pd.DataFrame, mapping: Dict[str, str], source: str) -> pd.DataFrame:
    renamed = df.rename(columns=mapping)
    normalized = pd.DataFrame()
    normalized["sku"] = renamed.get("sku")
    product_series = renamed.get("product_name")
    if product_series is None:
        product_series = renamed.get("sku")
    normalized["product_name"] = product_series
    normalized["category"] = renamed.get("category")
    normalized["current_stock"] = pd.to_numeric(renamed.get("current_stock"), errors="coerce")
    normalized["unit_cost"] = pd.to_numeric(renamed.get("unit_cost"), errors="coerce")
    normalized["location"] = renamed.get("location")
    normalized["channel"] = source
    return normalized


def _to_internal_sales(df: pd.DataFrame) -> pd.DataFrame:
    internal = pd.DataFrame()
    internal["product_id"] = df.get("sku")
    internal["product_name"] = df.get("product_name")
    internal["category"] = None
    internal["date"] = df.get("date")
    internal["quantity_sold"] = pd.to_numeric(df.get("quantity"), errors="coerce").fillna(0)
    internal["revenue"] = pd.to_numeric(df.get("total"), errors="coerce").fillna(0)
    unit_cost = pd.to_numeric(df.get("unit_cost"), errors="coerce") if "unit_cost" in df else pd.Series(0, index=df.index)
    internal["cost"] = unit_cost.fillna(0)
    internal["margin"] = internal["revenue"] - (internal["cost"] * internal["quantity_sold"])
    internal["current_stock"] = np.nan
    internal["channel"] = df.get("channel")
    return internal


def _to_internal_stock(df: pd.DataFrame) -> pd.DataFrame:
    internal = pd.DataFrame()
    internal["product_id"] = df.get("sku")
    internal["product_name"] = df.get("product_name")
    internal["category"] = df.get("category")
    internal["date"] = pd.NaT
    internal["quantity_sold"] = 0
    internal["revenue"] = 0
    unit_cost = pd.to_numeric(df.get("unit_cost"), errors="coerce") if "unit_cost" in df else pd.Series(0, index=df.index)
    internal["cost"] = unit_cost.fillna(0)
    internal["margin"] = 0
    internal["current_stock"] = pd.to_numeric(df.get("current_stock"), errors="coerce").fillna(0)
    internal["channel"] = df.get("channel")
    return internal


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


@ingest_router.post("/upload", response_model=IngestResponse)
async def ingest_upload(
    *,
    archivo_ventas: Optional[UploadFile] = File(None, description="Archivo de ventas"),
    archivo_stock: Optional[UploadFile] = File(None, description="Archivo de stock"),
    current_user=Depends(get_current_user),
):
    if archivo_ventas is None and archivo_stock is None:
        raise HTTPException(status_code=400, detail="Debes enviar al menos un archivo")

    datasets: list[dict] = []
    sales_df: Optional[pd.DataFrame] = None
    stock_df: Optional[pd.DataFrame] = None

    def _load(upload: UploadFile) -> pd.DataFrame:
        try:
            content = upload.file.read()
            dfs = read_dataframes(upload, content)
            if not dfs:
                raise HTTPException(status_code=400, detail="No se pudo leer el archivo")
            return dfs[0]
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="No pude leer este archivo. Asegúrate de que sea una tabla con encabezados en la primera fila (CSV o Excel).",
            )

    if archivo_ventas is not None:
        raw_sales = _load(archivo_ventas)
        sales_internal, _, report = _ingest_dataframe(raw_sales, "files")
        sales_df = sales_internal
        datasets.append(report)

    if archivo_stock is not None:
        raw_stock = _load(archivo_stock)
        stock_internal, _, report = _ingest_dataframe(raw_stock, "files")
        stock_df = stock_internal
        datasets.append(report)

    if sales_df is None and stock_df is None:
        raise HTTPException(status_code=400, detail="No pude leer ningún dataset válido")

    _DATA_CONTEXT.set_payload(str(current_user.id), sales_df, stock_df, "files")

    return IngestResponse(status="ok", datasets=datasets)


def _validate_required(type_name: str, mapping: Dict[str, str]) -> Tuple[list, list]:
    if type_name == "sales":
        required = SALES_REQUIRED
        optional = list(SALES_OPTIONAL)
        missing = [col for col in required if col not in mapping]
        if "quantity" not in mapping and "total" not in mapping:
            missing.append("quantity|total")
    else:
        required = STOCK_REQUIRED
        optional = list(STOCK_OPTIONAL)
        missing = [col for col in required if col not in mapping]
    missing_optional = [col for col in optional if col not in mapping]
    return missing, missing_optional


def _ingest_dataframe(df: pd.DataFrame, source: str) -> Tuple[pd.DataFrame, Optional[pd.DataFrame], dict]:
    columns, sample_rows = _dataset_preview(df)
    ai_result = classify_tabular_dataset(columns, sample_rows, STANDARD_SCHEMA_DOC)

    dtype = ai_result.get("type")
    mapping = ai_result.get("columns") or {}
    classification_source = "openai"
    warnings: list[str] = []

    ai_reason = ai_result.get("reason")
    if ai_reason:
        warnings.append(f"No se pudo usar OpenAI: {ai_reason}")

    if dtype not in {"sales", "stock", "unknown"}:
        dtype = "unknown"

    if dtype == "unknown":
        heuristic = _heuristic_classify(columns, sample_rows)
        if heuristic.get("type") != "unknown":
            dtype = heuristic.get("type")
            mapping = heuristic.get("columns") or {}
            classification_source = "heuristic"
            if ai_reason:
                warnings.append("Se aplicó el mapeo heurístico porque OpenAI no estuvo disponible.")
        elif ai_reason:
            warnings.append("OpenAI no disponible y heurística no pudo reconocer el archivo.")

    missing_required, missing_optional = _validate_required(dtype, mapping)

    if dtype == "unknown":
        raise HTTPException(
            status_code=400,
            detail="Este archivo no parece contener datos de ventas ni de stock. Revisa que incluya al menos fecha, sku/código, cantidad o stock.",
        )

    if missing_required:
        raise HTTPException(
            status_code=400,
            detail=f"Faltan columnas requeridas: {', '.join(missing_required)}",
        )

    normalized_df: Optional[pd.DataFrame] = None
    internal_df: Optional[pd.DataFrame] = None

    if dtype == "sales":
        normalized_df = _normalize_sales(df, mapping, source)
        internal_df = _to_internal_sales(normalized_df)
    elif dtype == "stock":
        normalized_df = _normalize_stock(df, mapping, source)
        internal_df = _to_internal_stock(normalized_df)

    return internal_df, normalized_df, {
        "type": dtype,
        "row_count": len(df),
        "column_mapping": mapping,
        "missing_required": missing_required,
        "missing_optional": missing_optional,
        "classification_source": classification_source,
        "warnings": warnings,
    }


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


@router.get("/sample/{dataset}")
async def download_sample(
    dataset: Literal["sales", "stock"],
    current_user=Depends(get_current_user),
):
    """Devuelve un CSV de ejemplo para ventas o stock."""

    data = SAMPLE_SALES if dataset == "sales" else SAMPLE_STOCK
    filename = "ejemplo_ventas.csv" if dataset == "sales" else "ejemplo_stock.csv"

    buffer = io.StringIO()
    data.to_csv(buffer, index=False)
    buffer.seek(0)

    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    return StreamingResponse(iter([buffer.getvalue()]), media_type="text/csv", headers=headers)


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
