from __future__ import annotations

import logging
import threading
import json
from datetime import datetime
import io
from io import BytesIO
from typing import Any, Dict, Literal, Optional, Tuple

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import get_current_user
from ai_module import (
    classify_tabular_dataset,
    generate_ai_insights,
    generate_dataset_chat_reply,
)
from database import get_db
from mercadolibre import fetch_inventory_dataframe, fetch_orders_dataframe
from models import UserSalesDataset, UserStockDataset
from utils.data_engine import (
    aggregate_manual_metrics,
    build_product_summary,
    harmonize_sales_data,
    harmonize_stock_data,
    compute_auto_metrics,
)
from utils.dataframe_loader import read_dataframes
from utils.metrics_cache import invalidate_user_cache
from utils.app_log import persist_app_log, resolve_user_identifier

router = APIRouter(prefix="/data", tags=["Motor de datos"])
ingest_router = APIRouter(prefix="/ingest", tags=["Ingesta inteligente"])
analysis_router = APIRouter(prefix="/analysis", tags=["Análisis"])


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
        *,
        raw_sales_df: Optional[pd.DataFrame] = None,
        raw_stock_df: Optional[pd.DataFrame] = None,
        column_mappings: Optional[Dict[str, Dict[str, str]]] = None,
    ) -> None:
        if sales_df is None and stock_df is None:
            raise ValueError("Debe proveer ventas o stock")
        with self._lock:
            self._store[user_id] = {
                "sales": sales_df if sales_df is not None else pd.DataFrame(),
                "stock": stock_df if stock_df is not None else pd.DataFrame(),
                "source": source,
                "updated_at": datetime.utcnow(),
                "raw_sales": raw_sales_df if raw_sales_df is not None else pd.DataFrame(),
                "raw_stock": raw_stock_df if raw_stock_df is not None else pd.DataFrame(),
                "column_mappings": column_mappings or {},
            }

    def get(self, user_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            payload = self._store.get(user_id)
            return payload.copy() if payload else None


_DATA_CONTEXT = _DataContext()

# Almacenamiento simplificado en memoria para el flujo MVP solicitado
_SIMPLE_DATA_LOCK = threading.Lock()
_SIMPLE_DATA: Dict[str, Dict[str, Any]] = {}


def _set_simple_data(
    user_id: str,
    sales_df: Optional[pd.DataFrame],
    stock_df: Optional[pd.DataFrame],
    *,
    source: str = "files",
    updated_at: Optional[datetime] = None,
):
    """Guarda dataframes normalizados en memoria para el usuario actual."""

    with _SIMPLE_DATA_LOCK:
        _SIMPLE_DATA[user_id] = {
            "sales": sales_df if sales_df is not None else pd.DataFrame(),
            "stock": stock_df if stock_df is not None else pd.DataFrame(),
            "updated_at": updated_at or datetime.utcnow(),
            "source": source,
        }


def _get_simple_data(user_id: str) -> Dict[str, Any]:
    with _SIMPLE_DATA_LOCK:
        payload = _SIMPLE_DATA.get(user_id, {})
        return {
            "sales": payload.get("sales", pd.DataFrame()),
            "stock": payload.get("stock", pd.DataFrame()),
            "updated_at": payload.get("updated_at"),
            "source": payload.get("source", "files"),
        }


def _serialize_dataframe(df: pd.DataFrame) -> bytes:
    """Serializa un dataframe a parquet o JSON si no hay motores instalados."""

    buffer = BytesIO()
    try:
        df.to_parquet(buffer, index=False)
        return buffer.getvalue()
    except Exception:  # noqa: BLE001
        buffer = BytesIO()
        buffer.write(df.to_json(orient="records").encode("utf-8"))
        return buffer.getvalue()


def _deserialize_dataframe(blob: Optional[bytes]) -> Optional[pd.DataFrame]:
    if not blob:
        return None
    try:
        return pd.read_parquet(BytesIO(blob))
    except Exception:  # noqa: BLE001
        try:
            return pd.read_json(BytesIO(blob))
        except Exception:  # noqa: BLE001
            return None


def _persist_dataset(
    db: Session,
    user_id: str,
    dataset_type: Literal["sales", "stock"],
    df: Optional[pd.DataFrame],
    column_mappings: Optional[Dict[str, Dict[str, str]]],
    source: str,
    updated_at: datetime,
):
    if df is None:
        return

    payload = _serialize_dataframe(df)
    mapping = (column_mappings or {}).get(dataset_type)

    if dataset_type == "sales":
        existing = (
            db.query(UserSalesDataset)
            .filter(UserSalesDataset.user_id == int(user_id))
            .order_by(UserSalesDataset.updated_at.desc())
            .first()
        )
        record = existing or UserSalesDataset(user_id=int(user_id))
        record.dataframe_parquet = payload
        record.column_mapping_json = mapping
        record.source = source
        record.updated_at = updated_at
        db.add(record)
    else:
        existing = (
            db.query(UserStockDataset)
            .filter(UserStockDataset.user_id == int(user_id))
            .order_by(UserStockDataset.updated_at.desc())
            .first()
        )
        record = existing or UserStockDataset(user_id=int(user_id))
        record.dataframe_parquet = payload
        record.column_mapping_json = mapping
        record.source = source
        record.updated_at = updated_at
        db.add(record)

    db.commit()


def _load_latest_dataset(
    db: Session, user_id: str, *, source: Optional[str] = None
) -> tuple[Optional[dict], Optional[dict]]:
    sales_query = db.query(UserSalesDataset).filter(UserSalesDataset.user_id == int(user_id))
    stock_query = db.query(UserStockDataset).filter(UserStockDataset.user_id == int(user_id))

    if source:
        sales_query = sales_query.filter(UserSalesDataset.source == source)
        stock_query = stock_query.filter(UserStockDataset.source == source)

    sales = sales_query.order_by(UserSalesDataset.updated_at.desc()).first()
    stock = stock_query.order_by(UserStockDataset.updated_at.desc()).first()

    return sales, stock


def _ensure_user_context(
    db: Session, user_id: str, *, source: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    existing = _DATA_CONTEXT.get(user_id)
    if existing:
        return existing

    sales_record, stock_record = _load_latest_dataset(db, user_id, source=source)

    if source and sales_record is None and stock_record is None:
        sales_record, stock_record = _load_latest_dataset(db, user_id)

    sales_df = _deserialize_dataframe(getattr(sales_record, "dataframe_parquet", None))
    stock_df = _deserialize_dataframe(getattr(stock_record, "dataframe_parquet", None))

    if sales_df is None and stock_df is None:
        return None

    column_mappings: Dict[str, Dict[str, str]] = {}
    if getattr(sales_record, "column_mapping_json", None):
        column_mappings["sales"] = sales_record.column_mapping_json or {}
    if getattr(stock_record, "column_mapping_json", None):
        column_mappings["stock"] = stock_record.column_mapping_json or {}

    source = getattr(sales_record, "source", None) or getattr(stock_record, "source", "files")
    updated_at = getattr(sales_record, "updated_at", None) or getattr(stock_record, "updated_at", datetime.utcnow())

    _DATA_CONTEXT.set_payload(
        user_id,
        sales_df,
        stock_df,
        source,
        column_mappings=column_mappings,
    )
    _set_simple_data(user_id, sales_df, stock_df, source=source, updated_at=updated_at)
    return _DATA_CONTEXT.get(user_id)


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


class DataStatusResponse(BaseModel):
    source: str
    updated_at: datetime
    has_sales: bool = False
    has_stock: bool = False


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


class RemapRequest(BaseModel):
    dataset: Literal["sales", "stock"]
    mapping: Dict[str, str]


class MappingRequest(BaseModel):
    columns: list[str]
    dataset: Optional[Literal["sales", "stock"]] = None


class DataChatPayload(BaseModel):
    message: str


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


def _get_saved_mapping(
    db: Session,
    user_id: str,
    columns: list[str],
    dataset_hint: Optional[Literal["sales", "stock"]] = None,
) -> Optional[dict]:
    """Busca si existe un mapeo confirmado para un conjunto de columnas."""

    target_tables: list[tuple[Literal["sales", "stock"], Any]] = []
    if dataset_hint in {"sales", "stock"}:
        if dataset_hint == "sales":
            target_tables.append(("sales", UserSalesDataset))
        else:
            target_tables.append(("stock", UserStockDataset))
    else:
        target_tables.extend([("sales", UserSalesDataset), ("stock", UserStockDataset)])

    normalized_columns = {str(col).strip().lower() for col in columns}

    for dtype, model in target_tables:
        record = (
            db.query(model)
            .filter(model.user_id == int(user_id))
            .order_by(model.updated_at.desc())
            .first()
        )
        mapping = getattr(record, "column_mapping_json", None) or {}
        mapped_values = {str(v).strip().lower() for v in mapping.values() if v}
        if mapping and mapped_values.issubset(normalized_columns):
            return {"type": dtype, "columns": mapping}
    return None


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
    mapping["quantity"] = _match(["cantidad", "unidades", "qty", "ticket", "tickets", "quantity"])
    mapping["unit_price"] = _match(["precio", "price", "unit_price", "p.u", "pu", "importe_unitario"])
    mapping["total"] = _match(["total", "venta", "ventas", "monto", "importe", "venta_neta", "neto", "facturacion", "ingreso"])
    mapping["channel"] = _match(["canal", "channel", "sucursal", "tienda", "marketplace", "plataforma"])

    # Campos de stock
    mapping.setdefault("current_stock", _match(["stock_final", "stock", "inventario", "existencia", "stock_actual", "stock_inicial"]))
    mapping.setdefault("category", _match(["categoria", "categoría", "familia", "rubro"]))
    mapping.setdefault("unit_cost", _match(["costo", "coste", "unit_cost", "costo_unitario"]))
    mapping.setdefault("location", _match(["almacen", "almacén", "bodega", "deposito", "depósito", "ubicacion", "sucursal", "tienda"]))

    sales_signals = any(token in lc for lc in lower_columns for token in ["venta", "ticket", "factur", "precio", "quantity", "cantidad", "qty"])
    stock_signals = any(token in lc for lc in lower_columns for token in ["stock", "inventario", "existencia"])

    dtype: Literal["sales", "stock", "unknown"] = "unknown"

    if ("current_stock" in mapping and mapping["current_stock"]) or stock_signals:
        dtype = "stock"
    elif sales_signals or (mapping.get("date") and (mapping.get("total") or mapping.get("quantity"))):
        dtype = "sales"

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


def _read_upload_to_dataframe(upload: UploadFile) -> pd.DataFrame:
    content = upload.file.read()
    filename = (upload.filename or "").lower()
    allowed_extensions = (".csv", ".xlsx", ".xls")

    if not filename.endswith(allowed_extensions):
        raise HTTPException(
            status_code=400,
            detail="Formato no soportado. Sube archivos CSV o Excel (.xlsx, .xls).",
        )

    if not content:
        raise HTTPException(status_code=400, detail="El archivo está vacío o no se pudo leer.")

    try:
        if filename.endswith(".xlsx") or filename.endswith(".xls"):
            return pd.read_excel(BytesIO(content))
        return pd.read_csv(BytesIO(content), sep=None, engine="python")
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail="No se pudo procesar el archivo. Verifica que sea un CSV o Excel válido.",
        ) from exc


def _normalize_sales_columns(df: pd.DataFrame) -> pd.DataFrame:
    normalized = df.copy()
    normalized.columns = [str(col).strip() for col in normalized.columns]
    lower_cols = {col.lower(): col for col in normalized.columns}

    def _find_col(options: list[str]) -> Optional[str]:
        for opt in options:
            if opt in lower_cols:
                return lower_cols[opt]
            for lower_name, original in lower_cols.items():
                if opt in lower_name:
                    return original
        return None

    mapping = {
        "sku": _find_col(["sku", "ean", "codigo", "code", "id_producto", "producto_id"]),
        "product_name": _find_col(["producto", "product", "nombre", "descripcion"]),
        "quantity": _find_col(["cantidad", "quantity", "qty", "unidades", "units"]),
        "unit_price": _find_col(["precio", "price", "unit_price", "precio_unitario", "unitario"]),
        "total": _find_col(["total", "importe", "monto", "valor", "subtotal"]),
    }

    for target, source_col in mapping.items():
        if source_col and source_col != target:
            normalized[target] = normalized[source_col]

    return normalized


def _normalize_stock_columns(df: pd.DataFrame) -> pd.DataFrame:
    normalized = df.copy()
    normalized.columns = [str(col).strip() for col in normalized.columns]
    lower_cols = {col.lower(): col for col in normalized.columns}

    def _find_col(options: list[str]) -> Optional[str]:
        for opt in options:
            if opt in lower_cols:
                return lower_cols[opt]
            for lower_name, original in lower_cols.items():
                if opt in lower_name:
                    return original
        return None

    mapping = {
        "sku": _find_col(["sku", "ean", "codigo", "code", "id_producto", "producto_id"]),
        "product_name": _find_col(["producto", "product", "nombre", "descripcion"]),
        "current_stock": _find_col(["stock", "inventario", "existencia", "existencias", "cantidad_disponible"]),
    }

    for target, source_col in mapping.items():
        if source_col and source_col != target:
            normalized[target] = normalized[source_col]

    return normalized


def _detect_dataset_type(df: pd.DataFrame) -> Literal["sales", "stock", "unknown"]:
    lower_cols = [str(col).lower() for col in df.columns]
    if any(token in "|".join(lower_cols) for token in ["stock", "inventario", "existencia"]):
        return "stock"
    if any(token in "|".join(lower_cols) for token in ["cantidad", "quantity", "qty", "total", "precio"]):
        return "sales"
    return "unknown"


@ingest_router.post("/upload")
async def ingest_upload(
    *,
    sales_file: Optional[list[UploadFile]] = File(None, description="Archivo de ventas"),
    stock_file: Optional[list[UploadFile]] = File(None, description="Archivo de stock"),
    archivo_ventas: Optional[list[UploadFile]] = File(None, description="Archivo de ventas", alias="archivo_ventas"),
    archivo_stock: Optional[list[UploadFile]] = File(None, description="Archivo de stock", alias="archivo_stock"),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Sube archivos de ventas y/o stock y los almacena en memoria (MVP).

    Se aceptan los campos sales_file y stock_file en multipart/form-data. Para
    compatibilidad también se aceptan archivo_ventas y archivo_stock.
    """

    try:
        ventas_uploads = []
        stock_uploads = []

        for uploads in [sales_file, archivo_ventas]:
            if uploads:
                ventas_uploads.extend(uploads)

        for uploads in [stock_file, archivo_stock]:
            if uploads:
                stock_uploads.extend(uploads)

        if not ventas_uploads and not stock_uploads:
            raise HTTPException(status_code=400, detail="Debes enviar al menos un archivo")

        sales_rows = 0
        stock_rows = 0
        sales_frames: list[pd.DataFrame] = []
        stock_frames: list[pd.DataFrame] = []
        datasets: list[IngestedDataset] = []
        raw_sales_frames: list[pd.DataFrame] = []
        raw_stock_frames: list[pd.DataFrame] = []
        column_mappings: Dict[str, Dict[str, str]] = {}
        unmapped_columns: list[dict] = []

        user_id = str(current_user.id)

        for upload in [*ventas_uploads, *stock_uploads]:
            df = _read_upload_to_dataframe(upload)
            dataset_hint = _detect_dataset_type(df)
            internal_df, normalized_df, dataset_meta = _ingest_dataframe(
                df,
                "files",
                strict_required=False,
                user_id=user_id,
                db=db,
                dataset_hint=dataset_hint if dataset_hint != "unknown" else None,
            )

            unmapped_columns.extend(
                _find_unmapped_columns(df, dataset_meta.get("column_mapping") or {}, dataset_meta.get("type", "unknown"))
            )

            if dataset_meta.get("type") in {"sales", "stock"}:
                column_mappings.setdefault(dataset_meta["type"], {}).update(dataset_meta.get("column_mapping") or {})

            if dataset_meta.get("missing_optional"):
                dataset_meta["warnings"].append(
                    f"Faltan columnas opcionales: {', '.join(dataset_meta['missing_optional'])}"
                )

            datasets.append(IngestedDataset(**dataset_meta))

            if dataset_meta.get("type") == "sales" and normalized_df is not None:
                sales_rows += len(normalized_df)
                sales_frames.append(normalized_df)
                raw_sales_frames.append(df)
            elif dataset_meta.get("type") == "stock" and normalized_df is not None:
                stock_rows += len(normalized_df)
                stock_frames.append(normalized_df)
                raw_stock_frames.append(df)

        sales_df: Optional[pd.DataFrame] = None
        stock_df: Optional[pd.DataFrame] = None
        raw_sales_df: Optional[pd.DataFrame] = None
        raw_stock_df: Optional[pd.DataFrame] = None

        if sales_frames:
            sales_df = pd.concat(sales_frames, ignore_index=True)
            raw_sales_df = pd.concat(raw_sales_frames, ignore_index=True)
        if stock_frames:
            stock_df = pd.concat(stock_frames, ignore_index=True)
            raw_stock_df = pd.concat(raw_stock_frames, ignore_index=True)

        if sales_df is None and stock_df is None:
            raise HTTPException(status_code=400, detail="No se detectaron columnas válidas de ventas o stock")

        # Prepara columnas estándar para las métricas unificadas
        if sales_df is not None:
            if "price" not in sales_df.columns:
                if "unit_price" in sales_df.columns:
                    sales_df = sales_df.rename(columns={"unit_price": "price"})
                elif "total" in sales_df.columns:
                    sales_df = sales_df.rename(columns={"total": "price"})
        if stock_df is not None:
            if "stock" not in stock_df.columns and "current_stock" in stock_df.columns:
                stock_df = stock_df.rename(columns={"current_stock": "stock"})

        # Persiste tanto el contexto simplificado como el de métricas oficiales
        _set_simple_data(str(current_user.id), sales_df, stock_df)

        sales_harmonized = None
        stock_harmonized = None

        if sales_df is not None:
            sales_harmonized, _ = harmonize_sales_data(sales_df, "files")
        if stock_df is not None:
            stock_harmonized, _ = harmonize_stock_data(stock_df, "files")

        _DATA_CONTEXT.set_payload(
            user_id,
            sales_harmonized,
            stock_harmonized,
            "files",
            raw_sales_df=raw_sales_df,
            raw_stock_df=raw_stock_df,
            column_mappings=column_mappings,
        )
        invalidate_user_cache(user_id)
        payload = _DATA_CONTEXT.get(user_id)

        if db is not None:
            updated_at = payload.get("updated_at", datetime.utcnow())
            if sales_harmonized is not None:
                _persist_dataset(db, user_id, "sales", sales_harmonized, column_mappings, "files", updated_at)
            if stock_harmonized is not None:
                _persist_dataset(db, user_id, "stock", stock_harmonized, column_mappings, "files", updated_at)

        user_label = resolve_user_identifier(current_user) or "desconocido"
        persist_app_log(
            level="INFO",
            message=(
                f"Usuario {user_label} cargó ventas ({int(sales_rows)} filas) "
                f"y stock ({int(stock_rows)} filas)"
            ),
            path="/ingest/upload",
            user=user_label,
        )

        return {
            "status": "ok",
            "sales_rows": int(sales_rows),
            "stock_rows": int(stock_rows),
            "updated_at": payload.get("updated_at", datetime.utcnow()),
            "datasets": [ds.model_dump() for ds in datasets],
            "unmapped_columns": unmapped_columns,
        }
    except HTTPException as exc:  # noqa: BLE001
        logging.warning("⚠️ Error en /ingest/upload: %s", exc.detail)
        return JSONResponse(status_code=exc.status_code, content={"status": "error", "message": exc.detail})
    except Exception as exc:  # noqa: BLE001
        logging.exception("❌ Error inesperado al procesar la ingesta")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": "Error al procesar los archivos. Verifica el formato e intenta nuevamente."},
        )


@router.post("/remap")
async def remap_columns(
    payload: RemapRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    user_id = str(current_user.id)
    ctx = _DATA_CONTEXT.get(user_id)

    if not ctx:
        raise HTTPException(status_code=400, detail="Primero sube archivos de ventas o stock para remapear.")

    source = ctx.get("source", "files")
    column_mappings = ctx.get("column_mappings", {}) or {}
    existing_mapping = column_mappings.get(payload.dataset, {})
    merged_mapping = {**existing_mapping, **payload.mapping}

    raw_sales_df = ctx.get("raw_sales") if isinstance(ctx.get("raw_sales"), pd.DataFrame) else pd.DataFrame()
    raw_stock_df = ctx.get("raw_stock") if isinstance(ctx.get("raw_stock"), pd.DataFrame) else pd.DataFrame()

    if payload.dataset == "sales":
        if raw_sales_df.empty:
            raise HTTPException(status_code=400, detail="No hay datos originales de ventas para remapear.")
        normalized_sales = _normalize_sales(raw_sales_df, merged_mapping, source)
        normalized_stock = _normalize_stock(raw_stock_df, column_mappings.get("stock", {}), source) if not raw_stock_df.empty else None
    else:
        if raw_stock_df.empty:
            raise HTTPException(status_code=400, detail="No hay datos originales de stock para remapear.")
        normalized_stock = _normalize_stock(raw_stock_df, merged_mapping, source)
        normalized_sales = _normalize_sales(raw_sales_df, column_mappings.get("sales", {}), source) if not raw_sales_df.empty else None

    sales_harmonized = None
    stock_harmonized = None

    if normalized_sales is not None:
        sales_harmonized, _ = harmonize_sales_data(normalized_sales, source)
    if normalized_stock is not None:
        stock_harmonized, _ = harmonize_stock_data(normalized_stock, source)

    updated_mappings = {**column_mappings, payload.dataset: merged_mapping}

    updated_at = datetime.utcnow()

    _DATA_CONTEXT.set_payload(
        user_id,
        sales_harmonized if sales_harmonized is not None else ctx.get("sales"),
        stock_harmonized if stock_harmonized is not None else ctx.get("stock"),
        source,
        raw_sales_df=raw_sales_df if not raw_sales_df.empty else None,
        raw_stock_df=raw_stock_df if not raw_stock_df.empty else None,
        column_mappings=updated_mappings,
    )

    _set_simple_data(user_id, normalized_sales, normalized_stock, source=source, updated_at=updated_at)
    if db is not None:
        if payload.dataset == "sales":
            persisted_df = sales_harmonized if sales_harmonized is not None else ctx.get("sales")
            _persist_dataset(db, user_id, "sales", persisted_df, updated_mappings, source, updated_at)
        else:
            persisted_df = stock_harmonized if stock_harmonized is not None else ctx.get("stock")
            _persist_dataset(db, user_id, "stock", persisted_df, updated_mappings, source, updated_at)

    unmapped_columns = []
    if payload.dataset == "sales":
        unmapped_columns = _find_unmapped_columns(raw_sales_df, merged_mapping, "sales")
    else:
        unmapped_columns = _find_unmapped_columns(raw_stock_df, merged_mapping, "stock")

    return {
        "status": "ok",
        "dataset": payload.dataset,
        "column_mapping": merged_mapping,
        "unmapped_columns": unmapped_columns,
    }


@router.post("/mapping")
def get_previous_mapping(
    payload: MappingRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if not payload.columns:
        raise HTTPException(status_code=400, detail="Debes enviar las columnas a consultar")

    mapping = _get_saved_mapping(db, str(current_user.id), payload.columns, payload.dataset)
    if not mapping:
        return {"mapping": None}

    return {"mapping": mapping.get("columns"), "dataset": mapping.get("type")}


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


def _find_unmapped_columns(df: pd.DataFrame, mapping: Dict[str, str], dataset_type: str) -> list[dict]:
    original_columns = [str(col) for col in df.columns]
    mapped_columns = [str(col) for col in (mapping or {}).values() if col]
    return [
        {"dataset": dataset_type, "column": col}
        for col in sorted(set(original_columns) - set(mapped_columns))
    ]


def _ingest_dataframe(
    df: pd.DataFrame,
    source: str,
    *,
    strict_required: bool = True,
    user_id: Optional[str] = None,
    db: Optional[Session] = None,
    dataset_hint: Optional[Literal["sales", "stock"]] = None,
) -> Tuple[pd.DataFrame, Optional[pd.DataFrame], dict]:
    columns, sample_rows = _dataset_preview(df)

    cached_mapping = None
    if db is not None and user_id:
        cached_mapping = _get_saved_mapping(db, user_id, columns, dataset_hint)

    if cached_mapping:
        dtype = cached_mapping.get("type")
        mapping = cached_mapping.get("columns") or {}
        classification_source = "cached"
        warnings: list[str] = []
        ai_reason = None
    else:
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
            if cached_mapping:
                classification_source = "cached"
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
        if not strict_required:
            warnings.append(f"Faltan columnas requeridas: {', '.join(missing_required)}")
        else:
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


@router.get("/status", response_model=DataStatusResponse)
def get_data_status(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    user_id = str(current_user.id)
    ctx = _DATA_CONTEXT.get(user_id) or _ensure_user_context(db, user_id)

    if not ctx:
        return DataStatusResponse(
            source="demo",
            updated_at=datetime.utcnow(),
            has_sales=False,
            has_stock=False,
        )

    sales_df = ctx.get("sales", pd.DataFrame())
    stock_df = ctx.get("stock", pd.DataFrame())

    return DataStatusResponse(
        source=ctx.get("source", "files"),
        updated_at=ctx.get("updated_at", datetime.utcnow()),
        has_sales=not sales_df.empty,
        has_stock=not stock_df.empty,
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
        credential_id = 0 if payload.credential_id is None else payload.credential_id
        try:
            sales_raw, _ = fetch_orders_dataframe(credential_id, db, current_user)
            stock_raw, _ = fetch_inventory_dataframe(credential_id, db, current_user)
        except HTTPException:
            # Propaga errores claros sobre credenciales inexistentes o sin acceso
            raise
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=400, detail=f"No se pudo obtener datos de MercadoLibre: {exc}") from exc
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
    _set_simple_data(user_id, payload_ctx.get("sales"), payload_ctx.get("stock"), source=payload_ctx.get("source", source))

    if db is not None:
        updated_at = payload_ctx.get("updated_at", datetime.utcnow())
        if payload_ctx.get("sales") is not None:
            _persist_dataset(db, user_id, "sales", payload_ctx.get("sales"), payload_ctx.get("column_mappings"), payload_ctx.get("source", source), updated_at)
        if payload_ctx.get("stock") is not None:
            _persist_dataset(db, user_id, "stock", payload_ctx.get("stock"), payload_ctx.get("column_mappings"), payload_ctx.get("source", source), updated_at)

    invalidate_user_cache(user_id)
    return UploadResponse(
        source=payload_ctx["source"],
        sales_rows=len(payload_ctx.get("sales", [])),
        stock_rows=len(payload_ctx.get("stock", [])),
        updated_at=payload_ctx.get("updated_at", datetime.utcnow()),
    )


@router.get("/metrics/auto", response_model=AutoMetricsResponse)
async def auto_metrics(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Calcula KPIs automáticos usando la fuente activa (MercadoLibre o archivos)."""

    user_id = str(current_user.id)
    ctx = _DATA_CONTEXT.get(user_id) or _ensure_user_context(db, user_id)
    if not ctx:
        ctx = _get_or_seed_data(user_id)
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
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Agrega métricas según la configuración del usuario (modo manual)."""

    ctx = _DATA_CONTEXT.get(str(current_user.id)) or _ensure_user_context(db, str(current_user.id))
    if not ctx:
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


@analysis_router.get("/metrics")
def get_analysis_metrics(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Calcula KPIs básicos a partir de los archivos subidos en memoria."""

    _ensure_user_context(db, str(current_user.id))
    ctx = _get_simple_data(str(current_user.id))
    sales_df: pd.DataFrame = ctx.get("sales", pd.DataFrame())
    stock_df: pd.DataFrame = ctx.get("stock", pd.DataFrame())

    if sales_df.empty and stock_df.empty:
        return {"status": "error", "message": "No hay datos cargados."}

    # Normalizar columnas clave
    for col in ["quantity", "unit_price", "total", "current_stock"]:
        if col in sales_df.columns:
            sales_df[col] = pd.to_numeric(sales_df[col], errors="coerce").fillna(0)
        if col in stock_df.columns:
            stock_df[col] = pd.to_numeric(stock_df[col], errors="coerce").fillna(0)

    if "total" not in sales_df.columns and "unit_price" in sales_df.columns and "quantity" in sales_df.columns:
        sales_df["total"] = sales_df["unit_price"] * sales_df["quantity"]

    total_sales = float(sales_df.get("total", 0).sum()) if not sales_df.empty else 0.0
    total_units = float(sales_df.get("quantity", 0).sum()) if not sales_df.empty else 0.0

    group_key = "sku" if "sku" in sales_df.columns else ("product_name" if "product_name" in sales_df.columns else None)
    chart_data: list[dict] = []
    table_data: list[dict] = []

    if group_key:
        grouped = sales_df.groupby(group_key).agg(
            {
                "total": "sum" if "total" in sales_df.columns else "sum",
                "quantity": "sum" if "quantity" in sales_df.columns else "sum",
                "product_name": "first" if "product_name" in sales_df.columns else "first",
            }
        ).reset_index()

        chart_data = [
            {
                "label": str(row[group_key]),
                "ventas": float(row.get("total", 0)),
            }
            for _, row in grouped.iterrows()
        ]

        table_data = [
            {
                "sku": row.get("sku") if "sku" in grouped.columns else row.get(group_key),
                "product_name": row.get("product_name"),
                "ventas": float(row.get("total", 0)),
                "unidades": float(row.get("quantity", 0)),
            }
            for _, row in grouped.iterrows()
        ]
    elif not sales_df.empty:
        chart_data = [{"label": str(idx), "ventas": float(val)} for idx, val in enumerate(sales_df.get("total", []))]
        table_data = [
            {
                "sku": None,
                "product_name": row.get("product_name"),
                "ventas": float(row.get("total", 0)),
                "unidades": float(row.get("quantity", 0)),
            }
            for _, row in sales_df.iterrows()
        ]
    elif not stock_df.empty:
        table_data = [
            {
                "sku": row.get("sku"),
                "product_name": row.get("product_name"),
                "ventas": 0.0,
                "unidades": 0.0,
            }
            for _, row in stock_df.iterrows()
        ]

    kpis = {
        "ventas_totales": round(total_sales, 2),
        "unidades_totales": int(total_units),
    }

    return {
        "status": "ok",
        "kpis": kpis,
        "chart_data": chart_data,
        "table_data": table_data,
    }


@analysis_router.get("/summary")
def get_analysis_summary(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _ensure_user_context(db, str(current_user.id))
    ctx = _get_or_seed_data(str(current_user.id))
    metrics = get_analysis_metrics(current_user)
    if metrics.get("status") != "ok":
        raise HTTPException(status_code=400, detail=metrics.get("message") or "No hay datos para resumir")

    profile = {
        "row_count": len(ctx.get("sales", pd.DataFrame())) + len(ctx.get("stock", pd.DataFrame())),
        "column_count": len(ctx.get("sales", pd.DataFrame()).columns | ctx.get("stock", pd.DataFrame()).columns)
        if not ctx.get("stock", pd.DataFrame()).empty
        else len(ctx.get("sales", pd.DataFrame()).columns),
        "type_counts": {},
        "file_types": [ctx.get("source", "demo")],
    }

    column_types = {}
    for frame in [ctx.get("sales", pd.DataFrame()), ctx.get("stock", pd.DataFrame())]:
        for col, dtype in frame.dtypes.items():
            column_types[col] = str(dtype)

    summary_text = generate_ai_insights(
        summary={"kpis": metrics.get("kpis", {}), "warnings": metrics.get("warnings", [])},
        column_types=column_types,
        heuristics="Análisis combinado de ventas y stock",
        dataset_profile=profile,
        usage_context={"user": str(current_user.id), "source": "analysis"},
    )

    return {"status": "ok", "summary": summary_text}


@router.post("/chat")
def chat_with_loaded_data(
    payload: DataChatPayload,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Chat sencillo sobre el dataset cargado en memoria."""

    _ensure_user_context(db, str(current_user.id))
    ctx = _get_or_seed_data(str(current_user.id))
    sales_df: pd.DataFrame = ctx.get("sales", pd.DataFrame())
    stock_df: pd.DataFrame = ctx.get("stock", pd.DataFrame())

    if sales_df.empty and stock_df.empty:
        raise HTTPException(status_code=400, detail="No hay datos cargados para chatear.")

    metrics = get_analysis_metrics(current_user)
    if metrics.get("status") != "ok":
        raise HTTPException(status_code=400, detail=metrics.get("message") or "No hay datos para chatear")

    column_types: dict[str, str] = {}
    type_counts: dict[str, int] = {}
    for frame in [sales_df, stock_df]:
        if frame is None or frame.empty:
            continue
        for col, dtype in frame.dtypes.items():
            dtype_str = str(dtype)
            column_types[col] = dtype_str
            type_counts[dtype_str] = type_counts.get(dtype_str, 0) + 1

    dataset_profile = {
        "row_count": len(sales_df) + len(stock_df),
        "column_count": len(set(list(sales_df.columns) + list(stock_df.columns))),
        "type_counts": type_counts,
        "file_types": [ctx.get("source", "files")],
    }

    sample_rows: list[dict] = []
    if not sales_df.empty:
        sample_rows.extend(sales_df.head(3).fillna("").to_dict(orient="records"))
    if not stock_df.empty:
        sample_rows.extend(stock_df.head(3).fillna("").to_dict(orient="records"))

    ai_summary = generate_ai_insights(
        summary={"kpis": metrics.get("kpis", {}), "warnings": metrics.get("warnings", [])},
        column_types=column_types,
        heuristics="Contexto rápido para chat de dataset",
        dataset_profile=dataset_profile,
        usage_context={"user": str(current_user.id), "source": "data_chat"},
    )

    dataset_context = {
        "dataset_name": ctx.get("source", "Dataset cargado"),
        "ai_summary": ai_summary,
        "refined_insights": metrics.get("table_data") or [],
        "data_health": {},
        "sample": _json_safe(sample_rows),
        "column_types": column_types,
        "dataset_profile": dataset_profile,
        "metadata": {
            "source": ctx.get("source"),
            "updated_at": _json_safe(ctx.get("updated_at")),
        },
    }

    reply = generate_dataset_chat_reply(dataset_context, payload.message)
    return {"reply": reply, "dataset_profile": dataset_profile}
