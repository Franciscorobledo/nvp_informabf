from collections import defaultdict
from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import pandas as pd
import io
import json
import logging
import uuid
import threading
import jwt
import os
import numpy as np
import uvicorn
from datetime import datetime
import zipfile
import base64
import textwrap
from typing import List
from dotenv import load_dotenv
from pydantic import BaseModel, EmailStr
import smtplib
from email.message import EmailMessage

from utils.file_utils import validate_file
from analysis import (
    analyze_file,
    detect_column_types,
    generate_data_movie_payload,
    _infer_ai_schema,
)
from auth import admin_required, ensure_default_admin, get_current_user, router as auth_router
from ai_module import (
    check_openai_status,
    infer_dataset_schema_with_ai,
    generate_dataset_chat_reply,
)
from mercadolibre import (
    router as mercadolibre_router,
    ml_admin_router,
    meli_router,
)
from metrics_router import router as metrics_router
from utils.dataframe_loader import read_dataframes
from utils.openai_keys import get_openai_api_key, persist_openai_api_key
from utils.openai_monitor import get_usage_snapshot
from usage_api import router as usage_router
from data_router import analysis_router, ingest_router, router as data_router
from utils.job_store import JobStore
from utils.compare_job_store import CompareJobStore
from utils.data_movie_store import DataMovieStore
from utils.dataset_store import DatasetStore
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from database import Base, SessionLocal, engine

# ==============================
# CONFIGURACIÓN GLOBAL
# ==============================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOTENV_PATH = os.path.join(BASE_DIR, ".env")
TMP_DIR = os.path.join(BASE_DIR, "tmp")
SAMPLE_DATA_DIR = os.path.join(BASE_DIR, "sample_data")
load_dotenv(dotenv_path=DOTENV_PATH, override=False)

SECRET_KEY = os.getenv("SECRET_KEY", "DEV_SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ENV = os.getenv("ENV", "development")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
ALLOW_ONRENDER_WILDCARD = os.getenv("ALLOW_ONRENDER_WILDCARD", "true").lower() in {"1", "true", "yes"}
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "1000"))
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USERNAME)
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() in {"1", "true", "yes"}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

logging.info("📄 Variables de entorno cargadas desde: %s", DOTENV_PATH)
logging.info("🔐 OPENAI_API_KEY presente: %s", "sí" if get_openai_api_key() else "no")

app = FastAPI(title="InformeBF - Intelligent Data Visualizer")
job_store = JobStore()
compare_job_store = CompareJobStore()
data_movie_store = DataMovieStore()
dataset_store = DatasetStore()


class OpenAITokenPayload(BaseModel):
    api_key: str


class EmailReportPayload(BaseModel):
    analysis: dict
    email: EmailStr


class DatasetChatPayload(BaseModel):
    message: str

# ==============================
# CONFIGURACIÓN DE CORS
# ==============================
# Permite definir múltiples orígenes en la variable FRONTEND_URL separados por comas
dynamic_origins = [origin.strip() for origin in FRONTEND_URL.split(",") if origin.strip()]

allowed_origins = list({
    *dynamic_origins,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:1000",
    # Variantes de producción conocidas
    "https://nvp-informabf.onrender.com",
    "https://nvp-informabf-front.onrender.com",
    "https://nvp.informabf.onrender.com",
    "https://nvp.informabf-front.onrender.com",
    "http://localhost:1000",
})

allow_origin_regex = None
if ALLOW_ONRENDER_WILDCARD:
    # Render asigna subdominios dinámicos (p. ej., nombre-app.onrender.com).
    # Esta expresión permite cualquier origen HTTPS dentro de onrender.com
    # sin exponer el API a orígenes arbitrarios.
    allow_origin_regex = r"https://.*\.onrender\.com"

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.info(f"🚀 Backend iniciado en modo: {ENV}")
logging.info(f"🌐 Orígenes permitidos: {allowed_origins}")
if allow_origin_regex:
    logging.info(f"🌐 Regex de orígenes permitidos: {allow_origin_regex}")

# ==============================
# AUTENTICACIÓN
# ==============================
app.include_router(auth_router, prefix="/auth", tags=["Autenticación"])
app.include_router(usage_router)
app.include_router(mercadolibre_router)
app.include_router(ml_admin_router)
app.include_router(meli_router)
app.include_router(metrics_router)
app.include_router(data_router)
app.include_router(ingest_router)
app.include_router(analysis_router)


@app.on_event("startup")
def startup_event():
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        ensure_default_admin(db)

# ==============================
# FUNCIONES AUXILIARES
# ==============================
def json_safe(obj):
    """Convierte cualquier tipo no serializable (Timestamp, NaN, numpy types) a algo JSON compatible."""
    if isinstance(obj, (pd.Timestamp, datetime)):
        return obj.isoformat()
    if isinstance(obj, (np.int64, np.int32, np.float64)):
        return float(obj)
    if pd.isna(obj):
        return None
    return obj


def json_safe_deep(data):
    """Normaliza estructuras anidadas para evitar valores NaN/inf en la respuesta JSON."""
    if isinstance(data, dict):
        return {k: json_safe_deep(v) for k, v in data.items()}
    if isinstance(data, (list, tuple, set)):
        return [json_safe_deep(v) for v in data]
    return json_safe(data)


def _load_sample_dataframe(file_name: str) -> pd.DataFrame:
    """Lee un CSV de la carpeta de datos de ejemplo."""

    path = os.path.join(SAMPLE_DATA_DIR, file_name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Archivo de ejemplo no encontrado: {file_name}")

    try:
        return pd.read_csv(path)
    except Exception as exc:  # noqa: BLE001
        logging.error("❌ No se pudo cargar el archivo demo %s: %s", file_name, exc)
        raise HTTPException(status_code=500, detail="No se pudo leer el archivo de ejemplo.") from exc


def quick_date_detection(df: pd.DataFrame) -> list[str]:
    """Intenta detectar columnas de fecha de manera heurística en una muestra."""

    from analysis import detect_date_candidates  # Import local para evitar dependencias circulares

    candidates = detect_date_candidates(df.head(5_000))
    return [candidate["column"] for candidate in candidates]


def clean_base64_image(image_data: str):
    """Limpia un data URI y devuelve bytes de imagen."""
    if not image_data:
        return None
    if "," in image_data:
        image_data = image_data.split(",", 1)[1]
    try:
        return base64.b64decode(image_data)
    except Exception:
        return None


def _persist_dataset_context(
    dataset_id: str,
    dataset_name: str,
    analysis_result: dict,
    metadata: dict | None = None,
    source: str | None = None,
):
    """Guarda en memoria el contexto necesario para el chat de datos."""

    dataset_store.save_dataset(
        dataset_id,
        {
            "dataset_id": dataset_id,
            "dataset_name": dataset_name,
            "summary": analysis_result.get("summary", {}),
            "ai_summary": analysis_result.get("ai_summary"),
            "refined_insights": analysis_result.get("refined_insights", []),
            "data_health": analysis_result.get("data_health", {}),
            "sample": analysis_result.get("sample", []),
            "column_types": analysis_result.get("column_types", {}),
            "dataset_profile": analysis_result.get("dataset_profile", {}),
            "metadata": metadata or {},
            "source": source,
            "demo_metadata": analysis_result.get("demo_metadata"),
        },
    )


def _movie_to_pdf(data_movie: dict) -> io.BytesIO:
    """Genera un PDF simple a partir de las escenas de la película."""

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    title = data_movie.get("movie_title") or "Película de datos"
    subtitle = data_movie.get("movie_subtitle") or "Narrativa automática"

    pdf.setTitle(title)
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(40, height - 50, title)
    pdf.setFont("Helvetica", 12)
    pdf.drawString(40, height - 70, subtitle)

    y = height - 100
    scenes = data_movie.get("scenes") or []
    for scene in scenes:
        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawString(40, y, f"Escena: {scene.get('title') or scene.get('id')}")
        y -= 18
        pdf.setFont("Helvetica", 11)
        narration = scene.get("narration") or ""
        for line in textwrap.wrap(narration, width=95):
            pdf.drawString(40, y, line)
            y -= 14
        bullets = scene.get("bullets") or scene.get("recommendations") or []
        for bullet in bullets:
            for line in textwrap.wrap(f"• {bullet}", width=93):
                pdf.drawString(50, y, line)
                y -= 14

        alerts = scene.get("alerts") or []
        for alert in alerts:
            for line in textwrap.wrap(f"⚠️ {alert}", width=90):
                pdf.drawString(50, y, line)
                y -= 14

        y -= 10
        if y < 120:
            pdf.showPage()
            y = height - 60

    pdf.showPage()
    pdf.save()
    buffer.seek(0)
    return buffer


# ==============================
# DATASETS Y CHAT CON IA
# ==============================


@app.get("/datasets/{dataset_id}/context")
def get_dataset_context(dataset_id: str, current_user=Depends(get_current_user)):
    dataset = dataset_store.get_dataset(dataset_id)
    if not dataset:
        job = job_store.get_job(dataset_id)
        job_result = (job or {}).get("result") if job else None
        if job_result:
            dataset_name = (job_result.get("metadata") or {}).get("file_name") or "Dataset analizado"
            _persist_dataset_context(
                dataset_id=dataset_id,
                dataset_name=dataset_name,
                analysis_result=job_result,
                metadata=job_result.get("metadata"),
                source="analysis_job_cache",
            )
            dataset = dataset_store.get_dataset(dataset_id)

    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset no encontrado o expirado. Reprocesa el archivo para chatear.")

    return JSONResponse(content=json_safe_deep(dataset))


@app.post("/datasets/{dataset_id}/chat")
async def chat_with_dataset(
    dataset_id: str,
    payload: DatasetChatPayload,
    current_user=Depends(get_current_user),
):
    dataset = dataset_store.get_dataset(dataset_id)

    if not dataset:
        job = job_store.get_job(dataset_id)
        job_result = (job or {}).get("result") if job else None
        if job_result:
            dataset_name = (job_result.get("metadata") or {}).get("file_name") or "Dataset analizado"
            _persist_dataset_context(
                dataset_id=dataset_id,
                dataset_name=dataset_name,
                analysis_result=job_result,
                metadata=job_result.get("metadata"),
                source="analysis_job_cache",
            )
            dataset = dataset_store.get_dataset(dataset_id)

    if not dataset:
        raise HTTPException(status_code=404, detail="No encontramos el dataset para chatear. Vuelve a cargar el archivo o la demo.")

    try:
        reply = generate_dataset_chat_reply(dataset, payload.message)
        return {"reply": reply, "datasetId": dataset_id}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logging.error("❌ Error generando respuesta de chat: %s", exc)
        raise HTTPException(status_code=500, detail="No se pudo generar una respuesta con IA. Intenta nuevamente.") from exc


def _movie_charts_zip(data_movie: dict) -> io.BytesIO:
    """Crea un ZIP con descripciones de gráficas para descarga."""

    buffer = io.BytesIO()
    scenes = data_movie.get("scenes") or []
    chart_payload = []

    for scene in scenes:
        chart_payload.append(
            {
                "id": scene.get("id"),
                "type": scene.get("type"),
                "chart_data": scene.get("chart_data"),
                "entities": scene.get("entities"),
                "alerts": scene.get("alerts"),
                "title": scene.get("title"),
                "narration": scene.get("narration"),
            }
        )

    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "charts.json",
            json.dumps(chart_payload, ensure_ascii=False, indent=2),
        )
        zf.writestr(
            "data_movie.json",
            json.dumps(data_movie, ensure_ascii=False, indent=2),
        )

    buffer.seek(0)
    return buffer


def _ensure_job_dir(job_id: str) -> str:
    base = os.path.join(TMP_DIR, "jobs", job_id)
    os.makedirs(base, exist_ok=True)
    return base


def _save_uploaded_file(upload: UploadFile, content: bytes, job_id: str, prefix: str) -> str:
    job_dir = _ensure_job_dir(job_id)
    ext = os.path.splitext(upload.filename)[1]
    filename = f"{prefix}{ext}"
    path = os.path.join(job_dir, filename)
    with open(path, "wb") as f:
        f.write(content)
    return path


def _read_preview_dataframe(upload: UploadFile, content: bytes, nrows: int = 2000) -> pd.DataFrame:
    ext = os.path.splitext(upload.filename)[1].lower()
    buffer = io.BytesIO(content)

    if ext == ".csv":
        return pd.read_csv(buffer, nrows=nrows)
    if ext == ".xlsx":
        return pd.read_excel(buffer, nrows=nrows)
    if ext == ".zip":
        with zipfile.ZipFile(buffer) as archive:
            for name in archive.namelist():
                lower = name.lower()
                if lower.endswith("/"):
                    continue
                if lower.endswith(".csv"):
                    with archive.open(name) as f:
                        return pd.read_csv(f, nrows=nrows)
                if lower.endswith(".xlsx"):
                    with archive.open(name) as f:
                        return pd.read_excel(f, nrows=nrows)
    raise HTTPException(status_code=400, detail="No se pudieron leer los archivos para la comparativa.")


def _prepare_preview(upload: UploadFile, content: bytes) -> dict:
    preview_df = _read_preview_dataframe(upload, content)
    return {
        "rows_est": int(len(preview_df)),
        "columns_count": int(preview_df.shape[1]),
        "columns": list(preview_df.columns),
    }


def _load_dataframes_or_http_error(upload: UploadFile, content: bytes):
    """Lee dataframes y convierte errores de parsing en respuestas amigables."""

    try:
        dataframes = read_dataframes(upload, content)
    except ValueError as exc:
        logging.error("❌ Error leyendo %s: %s", upload.filename, exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not dataframes:
        raise HTTPException(
            status_code=400,
            detail=f"No se encontraron datos legibles en {upload.filename}.",
        )

    return dataframes


def _read_schema_sample(path: str, filename: str, nrows: int = 2000) -> pd.DataFrame:
    ext = os.path.splitext(filename)[1].lower()

    if ext == ".csv":
        return pd.read_csv(path, nrows=nrows)
    if ext == ".xlsx":
        return pd.read_excel(path, nrows=nrows, engine="openpyxl")
    if ext == ".zip":
        with zipfile.ZipFile(path) as archive:
            for name in archive.namelist():
                lower = name.lower()
                if lower.endswith("/"):
                    continue
                if lower.endswith(".csv"):
                    with archive.open(name) as f:
                        return pd.read_csv(f, nrows=nrows)
                if lower.endswith(".xlsx"):
                    with archive.open(name) as f:
                        return pd.read_excel(f, nrows=nrows, engine="openpyxl")
    raise HTTPException(status_code=400, detail="No se pudieron leer los archivos para la comparativa.")


def _aggregate_dataset_from_path(
    path: str,
    filename: str,
    main_metric: str,
    entity_column: str | None,
    date_column: str | None,
    timeline_granularity: str,
    available_columns: list[str] | None = None,
    chunksize: int = 50_000,
) -> dict:
    required_columns = [col for col in {main_metric, entity_column, date_column} if col]
    usecols = [col for col in required_columns if not available_columns or col in available_columns]
    freq = {"day": "D", "week": "W", "month": "M"}.get(timeline_granularity, "M")

    totals = defaultdict(float)
    entity_totals: defaultdict[str, float] = defaultdict(float)
    timeline_totals: defaultdict[str, float] = defaultdict(float)
    row_count = 0
    columns_count = len(available_columns) if available_columns else len(required_columns)

    def process_chunk(chunk: pd.DataFrame):
        nonlocal row_count
        row_count += len(chunk)
        if main_metric not in chunk.columns:
            return

        numeric_metric = pd.to_numeric(chunk[main_metric], errors="coerce")
        totals["total"] += float(numeric_metric.sum(skipna=True))

        if entity_column and entity_column in chunk.columns:
            grouped_entities = (
                chunk.groupby(entity_column)[main_metric]
                .apply(lambda s: pd.to_numeric(s, errors="coerce").sum())
                .rename("value")
            )
            for entity, value in grouped_entities.items():
                entity_totals[str(entity)] += float(value)

        if date_column and date_column in chunk.columns:
            chunk_dates = pd.to_datetime(chunk[date_column], errors="coerce")
            metric_values = pd.to_numeric(chunk[main_metric], errors="coerce")
            valid_mask = chunk_dates.notna() & metric_values.notna()
            if valid_mask.any():
                grouped_time = (
                    pd.DataFrame({date_column: chunk_dates[valid_mask], main_metric: metric_values[valid_mask]})
                    .groupby(pd.Grouper(key=date_column, freq=freq))[main_metric]
                    .sum()
                )
                for dt, value in grouped_time.items():
                    if pd.isna(dt):
                        continue
                    timeline_totals[dt.strftime("%Y-%m-%d")] += float(value)

    ext = os.path.splitext(filename)[1].lower()
    csv_kwargs = {
        "usecols": usecols or None,
        "dtype_backend": "numpy_nullable",
        "on_bad_lines": "skip",
        "low_memory": True,
    }

    if ext == ".csv":
        reader = pd.read_csv(path, chunksize=chunksize, **csv_kwargs)
        for chunk in reader:
            process_chunk(chunk)
    elif ext == ".xlsx":
        df = pd.read_excel(path, usecols=usecols or None, engine="openpyxl")
        process_chunk(df)
    elif ext == ".zip":
        with zipfile.ZipFile(path) as archive:
            for name in archive.namelist():
                lower_name = name.lower()
                if lower_name.endswith("/"):
                    continue
                if lower_name.endswith(".csv"):
                    with archive.open(name) as f:
                        reader = pd.read_csv(f, chunksize=chunksize, **csv_kwargs)
                        for chunk in reader:
                            process_chunk(chunk)
                elif lower_name.endswith(".xlsx"):
                    with archive.open(name) as f:
                        df = pd.read_excel(f, usecols=usecols or None, engine="openpyxl")
                        process_chunk(df)

    return {
        "rows": int(row_count),
        "columns": int(columns_count),
        "total": float(totals.get("total", 0.0)),
        "entities": dict(entity_totals),
        "timeline": dict(timeline_totals),
    }


def add_wrapped_text(canvas_obj, text, x, y, width, line_height=12, font_name="Helvetica", font_size=10):
    canvas_obj.setFont(font_name, font_size)
    for line in textwrap.wrap(str(text), width=width):
        if y - line_height < 40:
            canvas_obj.showPage()
            canvas_obj.setFont(font_name, font_size)
            y = letter[1] - 50
        canvas_obj.drawString(x, y, line)
        y -= line_height
    return y


def _normalize_dataset(
    df: pd.DataFrame, focus: str | None
) -> tuple[pd.DataFrame, dict, dict]:
    """Limpia un dataframe y obtiene un esquema heurístico + notas de IA.

    Para acelerar el proceso y evitar enviar información sensible/completa a la IA,
    solo se usa una muestra (hasta 2.000 filas) para la detección de esquema y
    tipado. El dataframe limpio completo se devuelve para los cálculos finales.
    """

    cleaned = df.replace(["", "NA", "NaN", "None"], np.nan).dropna(how="all")
    sample_size = min(len(cleaned), 2_000)
    sample = cleaned.sample(n=sample_size, random_state=42) if sample_size else cleaned

    column_types = detect_column_types(sample)
    heuristic_schema = _infer_ai_schema(sample, column_types)
    ai_notes = infer_dataset_schema_with_ai(sample, focus=focus)

    if isinstance(heuristic_schema, dict):
        heuristic_schema = {**heuristic_schema, "ai_notes": ai_notes}

    return cleaned, heuristic_schema, column_types


def _select_dataset_purpose(focus: str | None, schema_a: dict, schema_b: dict) -> str:
    if focus and focus != "todo":
        return focus

    for schema in (schema_a, schema_b):
        if isinstance(schema, dict):
            purpose = schema.get("dataset_purpose")
            if purpose:
                return purpose
    return "generico"


def _pick_first_column(candidates: list[str], df_a: pd.DataFrame, df_b: pd.DataFrame) -> str | None:
    for col in candidates:
        if col and col in df_a.columns and col in df_b.columns:
            return col
    for col in candidates:
        if col and (col in df_a.columns or col in df_b.columns):
            return col
    return None


def _select_main_metric(
    schema_a: dict, schema_b: dict, column_types_a: dict, column_types_b: dict
) -> str | None:
    candidates: list[str] = []
    for schema in (schema_a, schema_b):
        if isinstance(schema, dict):
            candidates.extend(schema.get("main_numeric_metrics") or [])

    for col in candidates:
        if (
            col in column_types_a
            and column_types_a.get(col) == "numeric"
            and col in column_types_b
            and column_types_b.get(col) == "numeric"
        ):
            return col

    for col in candidates:
        if (col in column_types_a and column_types_a.get(col) == "numeric") or (
            col in column_types_b and column_types_b.get(col) == "numeric"
        ):
            return col

    for col, detected in {**column_types_a, **column_types_b}.items():
        if detected == "numeric":
            return col

    return None


def _select_entity_column(schema_a: dict, schema_b: dict, df_a: pd.DataFrame, df_b: pd.DataFrame) -> str | None:
    candidates: list[str] = []
    for schema in (schema_a, schema_b):
        if isinstance(schema, dict):
            candidates.extend(schema.get("main_entity_columns") or [])

    if not candidates:
        object_cols = [
            col
            for col in df_a.columns
            if pd.api.types.is_object_dtype(df_a[col]) or pd.api.types.is_string_dtype(df_a[col])
        ]
        candidates.extend(object_cols)

    return _pick_first_column(candidates, df_a, df_b)


def _select_date_column(schema_a: dict, schema_b: dict, df_a: pd.DataFrame, df_b: pd.DataFrame) -> str | None:
    candidates: list[str] = []
    for schema in (schema_a, schema_b):
        if isinstance(schema, dict):
            candidate = schema.get("date_column")
            if candidate:
                candidates.append(candidate)

    return _pick_first_column(candidates, df_a, df_b)


def _select_timeline_granularity(schema_a: dict, schema_b: dict) -> str:
    for schema in (schema_a, schema_b):
        if isinstance(schema, dict):
            granularity = schema.get("timeline_granularity")
            if granularity:
                return granularity
    return "month"


def build_comparison(
    df_a: pd.DataFrame,
    df_b: pd.DataFrame,
    schema_a: dict,
    schema_b: dict,
    column_types_a: dict,
    column_types_b: dict,
    label_a: str,
    label_b: str,
    user_focus: str,
    *,
    aggregated_a: dict | None = None,
    aggregated_b: dict | None = None,
    rows_meta: dict | None = None,
) -> dict:
    dataset_purpose = _select_dataset_purpose(user_focus, schema_a, schema_b)
    main_metric = _select_main_metric(schema_a, schema_b, column_types_a, column_types_b)
    entity_column = _select_entity_column(schema_a, schema_b, df_a, df_b)
    date_column = _select_date_column(schema_a, schema_b, df_a, df_b)
    timeline_granularity = _select_timeline_granularity(schema_a, schema_b)

    if not main_metric:
        raise HTTPException(status_code=400, detail="No se encontró una métrica principal para comparar.")

    main_metric_label = (
        (schema_a or {}).get("main_metric_label")
        or (schema_b or {}).get("main_metric_label")
        or str(main_metric).replace("_", " ").title()
    )
    entity_label = (
        (schema_a or {}).get("entity_label")
        or (schema_b or {}).get("entity_label")
        or entity_column
        or "Entidad"
    )

    required_columns = {main_metric}
    if entity_column:
        required_columns.add(entity_column)
    if date_column:
        required_columns.add(date_column)

    df_a_reduced = df_a[[c for c in required_columns if c in df_a.columns]].copy()
    df_b_reduced = df_b[[c for c in required_columns if c in df_b.columns]].copy()

    metric_a = pd.to_numeric(df_a_reduced.get(main_metric, pd.Series(dtype=float)), errors="coerce")
    metric_b = pd.to_numeric(df_b_reduced.get(main_metric, pd.Series(dtype=float)), errors="coerce")

    total_a = float(metric_a.sum(skipna=True)) if main_metric in df_a.columns else 0.0
    total_b = float(metric_b.sum(skipna=True)) if main_metric in df_b.columns else 0.0
    if aggregated_a is not None and aggregated_b is not None:
        total_a = float(aggregated_a.get("total", total_a))
        total_b = float(aggregated_b.get("total", total_b))
    diff_abs = total_b - total_a
    diff_percent = (diff_abs / total_a) if total_a else None

    by_entity = {
        "entity_key": entity_column,
        "entity_label": entity_label,
        "rows": [],
        "top_increases": [],
        "top_decreases": [],
        "new_entities": [],
        "lost_entities": [],
    }
    if (
        entity_column
        and aggregated_a is not None
        and aggregated_b is not None
        and aggregated_a.get("entities") is not None
        and aggregated_b.get("entities") is not None
    ):
        series_a = pd.Series(aggregated_a.get("entities", {}), name="value_a")
        series_b = pd.Series(aggregated_b.get("entities", {}), name="value_b")
        merged = pd.concat([series_a, series_b], axis=1).fillna(0)
        merged["diff_abs"] = merged["value_b"] - merged["value_a"]
        merged["diff_percent"] = merged.apply(
            lambda r: (r["diff_abs"] / r["value_a"]) if r["value_a"] else None, axis=1
        )

        def status_row(row):
            if row["value_a"] == 0 and row["value_b"] > 0:
                return "new"
            if row["value_a"] > 0 and row["value_b"] == 0:
                return "lost"
            return "up" if row["diff_abs"] > 0 else "down"

        merged["status"] = merged.apply(status_row, axis=1)
        merged_reset = merged.reset_index().rename(columns={"index": "entity"})

        rows = merged_reset.to_dict(orient="records")
        by_entity["rows"] = rows
        by_entity["top_increases"] = sorted(rows, key=lambda r: r.get("diff_abs", 0), reverse=True)[:5]
        by_entity["top_decreases"] = sorted(rows, key=lambda r: r.get("diff_abs", 0))[:5]
        by_entity["new_entities"] = [r for r in rows if r.get("status") == "new"]
        by_entity["lost_entities"] = [r for r in rows if r.get("status") == "lost"]
    elif entity_column and main_metric in df_a_reduced.columns and main_metric in df_b_reduced.columns:
        group_a = (
            df_a_reduced.groupby(entity_column)[main_metric]
            .apply(lambda s: pd.to_numeric(s, errors="coerce").sum())
            .rename("value_a")
        )
        group_b = (
            df_b_reduced.groupby(entity_column)[main_metric]
            .apply(lambda s: pd.to_numeric(s, errors="coerce").sum())
            .rename("value_b")
        )

        merged = pd.concat([group_a, group_b], axis=1).fillna(0)
        merged["diff_abs"] = merged["value_b"] - merged["value_a"]
        merged["diff_percent"] = merged.apply(
            lambda r: (r["diff_abs"] / r["value_a"]) if r["value_a"] else None, axis=1
        )

        def status_row(row):
            if row["value_a"] == 0 and row["value_b"] > 0:
                return "new"
            if row["value_a"] > 0 and row["value_b"] == 0:
                return "lost"
            return "up" if row["diff_abs"] > 0 else "down"

        merged["status"] = merged.apply(status_row, axis=1)
        merged_reset = merged.reset_index().rename(columns={entity_column: "entity"})

        rows = merged_reset.to_dict(orient="records")
        by_entity["rows"] = rows
        by_entity["top_increases"] = sorted(rows, key=lambda r: r.get("diff_abs", 0), reverse=True)[:5]
        by_entity["top_decreases"] = sorted(rows, key=lambda r: r.get("diff_abs", 0))[:5]
        by_entity["new_entities"] = [r for r in rows if r.get("status") == "new"]
        by_entity["lost_entities"] = [r for r in rows if r.get("status") == "lost"]

    by_time = {
        "has_time": False,
        "date_column": date_column,
        "rows": [],
        "timeline_granularity": timeline_granularity,
        "max_gap": None,
    }
    if (
        date_column
        and aggregated_a is not None
        and aggregated_b is not None
        and aggregated_a.get("timeline") is not None
        and aggregated_b.get("timeline") is not None
    ):
        series_a = pd.Series(aggregated_a.get("timeline", {}), name="metric_a")
        series_b = pd.Series(aggregated_b.get("timeline", {}), name="metric_b")

        series_a.index = pd.to_datetime(series_a.index, errors="coerce")
        series_b.index = pd.to_datetime(series_b.index, errors="coerce")

        merged = pd.concat([series_a, series_b], axis=1).fillna(0)
        merged["diff_abs"] = merged["metric_b"] - merged["metric_a"]
        merged["diff_percent"] = merged.apply(
            lambda r: (r["diff_abs"] / r["metric_a"]) if r["metric_a"] else None, axis=1
        )
        merged_reset = merged.reset_index().rename(columns={"index": "period"})
        merged_reset["period"] = merged_reset["period"].dt.strftime("%Y-%m-%d")
        by_time["rows"] = merged_reset.to_dict(orient="records")
        by_time["has_time"] = True

        if not merged_reset.empty:
            max_idx = merged_reset["diff_abs"].abs().idxmax()
            max_row = merged_reset.loc[max_idx]
            by_time["max_gap"] = {
                "period": max_row.get("period"),
                "diff_abs": max_row.get("diff_abs"),
                "diff_percent": max_row.get("diff_percent"),
            }
    elif date_column and main_metric in df_a_reduced.columns and main_metric in df_b_reduced.columns:
        freq_map = {"day": "D", "week": "W", "month": "M"}
        freq = freq_map.get(timeline_granularity, "M")
        by_time["has_time"] = True

        def _prepare_time(df: pd.DataFrame, label: str):
            copy = df[[date_column, main_metric]].copy()
            copy[date_column] = pd.to_datetime(copy[date_column], errors="coerce")
            copy = copy.dropna(subset=[date_column])
            copy[main_metric] = pd.to_numeric(copy[main_metric], errors="coerce")
            return copy.groupby(pd.Grouper(key=date_column, freq=freq))[main_metric].sum().rename(label)

        series_a = _prepare_time(df_a_reduced, "metric_a") if date_column in df_a_reduced.columns else None
        series_b = _prepare_time(df_b_reduced, "metric_b") if date_column in df_b_reduced.columns else None

        if series_a is not None or series_b is not None:
            merged = pd.concat([series_a, series_b], axis=1).fillna(0)
            merged["diff_abs"] = merged["metric_b"] - merged["metric_a"]
            merged["diff_percent"] = merged.apply(
                lambda r: (r["diff_abs"] / r["metric_a"]) if r["metric_a"] else None, axis=1
            )
            merged_reset = merged.reset_index().rename(columns={date_column: "period"})
            merged_reset["period"] = merged_reset["period"].dt.strftime("%Y-%m-%d")
            by_time["rows"] = merged_reset.to_dict(orient="records")

            if not merged_reset.empty:
                max_idx = merged_reset["diff_abs"].abs().idxmax()
                max_row = merged_reset.loc[max_idx]
                by_time["max_gap"] = {
                    "period": max_row.get("period"),
                    "diff_abs": max_row.get("diff_abs"),
                    "diff_percent": max_row.get("diff_percent"),
                }

    if by_entity.get("top_increases"):
        top_names = ", ".join(r["entity"] for r in by_entity["top_increases"][:3])
        insight_pref = f" Principales alzas: {top_names}."
    else:
        insight_pref = ""
    if by_entity.get("top_decreases"):
        bottom_names = ", ".join(r["entity"] for r in by_entity["top_decreases"][:3])
        insight_pref += f" Principales caídas: {bottom_names}."

    insight_text = None
    if diff_percent is not None:
        direction = "crece" if diff_abs >= 0 else "cae"
        insight_text = (
            f"En {label_b} la métrica principal ({main_metric_label}) {direction} "
            f"{diff_percent:.1%} respecto a {label_a}."
        )
    if insight_pref:
        insight_text = (insight_text or "") + insight_pref

    by_entity["new_count"] = len(by_entity["new_entities"])
    by_entity["lost_count"] = len(by_entity["lost_entities"])

    comparison = {
        "summary": {
            "label_a": label_a,
            "label_b": label_b,
            "rows_a": int(rows_meta.get("rows_a", len(df_a))) if rows_meta else int(len(df_a)),
            "rows_b": int(rows_meta.get("rows_b", len(df_b))) if rows_meta else int(len(df_b)),
            "columns_a": int(rows_meta.get("columns_a", df_a.shape[1])) if rows_meta else int(df_a.shape[1]),
            "columns_b": int(rows_meta.get("columns_b", df_b.shape[1])) if rows_meta else int(df_b.shape[1]),
            "dataset_purpose": dataset_purpose,
            "main_metric": main_metric,
            "main_metric_label": main_metric_label,
            "total_a": total_a,
            "total_b": total_b,
            "diff_abs": diff_abs,
            "diff_percent": diff_percent,
            "insight_text": insight_text,
        },
        "by_entity": by_entity,
        "by_time": by_time,
    }

    return json_safe_deep(comparison)


def build_executive_report(analysis_data: dict) -> io.BytesIO:
    """Genera un PDF ejecutivo a partir del análisis enviado desde el frontend."""
    palette = {
        "accent": colors.HexColor("#059669"),
        "accent_dark": colors.HexColor("#0f766e"),
        "muted": colors.HexColor("#6b7280"),
        "border": colors.HexColor("#e5e7eb"),
        "background": colors.HexColor("#f8fafc"),
    }

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    margin = 50
    y = height - margin

    def ensure_space(space=40):
        nonlocal y
        if y - space < margin:
            c.showPage()
            y = height - margin

    def draw_section_header(title, subtitle=None):
        nonlocal y
        ensure_space(50)
        c.setFillColor(palette["accent_dark"])
        c.rect(margin, y - 6, width - (margin * 2), 4, fill=True, stroke=False)
        y -= 16
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(margin, y, title)
        y -= 16
        if subtitle:
            c.setFont("Helvetica", 10)
            c.setFillColor(palette["muted"])
            y = add_wrapped_text(c, subtitle, margin, y, width=90, font_size=10)
        c.setFillColor(colors.black)
        y -= 8

    def draw_badge(label, x, y_pos, color):
        padding_x = 6
        padding_y = 3
        text_width = c.stringWidth(label, "Helvetica-Bold", 9)
        rect_width = text_width + padding_x * 2
        rect_height = 14 + padding_y
        c.setFillColor(color)
        c.roundRect(x, y_pos - rect_height + 4, rect_width, rect_height, 4, fill=True, stroke=False)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(x + padding_x, y_pos, label)
        c.setFillColor(colors.black)

    def draw_card(x, y_pos, card_width, title, content_lines):
        card_height = 60 + (len(content_lines) * 12)
        ensure_space(card_height + 20)
        c.setFillColor(palette["background"])
        c.roundRect(x, y_pos - card_height, card_width, card_height, 8, fill=True, stroke=False)
        c.setStrokeColor(palette["border"])
        c.roundRect(x, y_pos - card_height, card_width, card_height, 8, fill=False, stroke=True)
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 11)
        c.drawString(x + 14, y_pos - 18, title)
        c.setFont("Helvetica", 10)
        y_cursor = y_pos - 32
        for line in content_lines:
            c.drawString(x + 14, y_cursor, f"• {line}")
            y_cursor -= 12
        return y_pos - card_height - 12

    c.setTitle("InformeBF - Reporte ejecutivo")

    # Portada
    c.setFillColor(palette["background"])
    c.rect(0, 0, width, height, fill=True, stroke=False)
    c.setFillColor(palette["accent"])
    c.rect(0, height - 120, width, 120, fill=True, stroke=False)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 22)
    c.drawString(margin, height - 70, "InformeBF · Reporte ejecutivo")
    c.setFont("Helvetica", 12)
    c.drawString(margin, height - 95, "Insights, métricas y visualizaciones en un solo vistazo")
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 10)
    c.drawString(margin, height - 140, f"Generado automáticamente el {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
    draw_badge("Dataset analizado", margin, height - 160, palette["accent_dark"])
    c.showPage()
    y = height - margin

    # Resumen
    draw_section_header(
        "Resumen estadístico",
        "Vista rápida de las columnas más relevantes y sus principales indicadores.",
    )
    summary = analysis_data.get("summary", {})
    if not summary:
        c.setFont("Helvetica", 11)
        c.drawString(margin, y, "No se recibieron estadísticas para este dataset.")
        y -= 20
    else:
        card_width = (width - margin * 2 - 20) / 2
        x_positions = [margin, margin + card_width + 20]
        column_items = list(summary.items())
        for idx, (column, stats) in enumerate(column_items):
            x = x_positions[idx % 2]
            content = []
            if isinstance(stats, dict):
                for key, value in list(stats.items())[:5]:
                    content.append(f"{key}: {value}")
            else:
                content.append(str(stats))
            y = draw_card(x, y, card_width, column, content)
            if idx % 2 == 1:
                y -= 6

    # Insights
    draw_section_header(
        "Insights automáticos",
        "Principales hallazgos generados por IA para orientar tus decisiones.",
    )
    ai_summary = analysis_data.get("ai_summary") or "No se recibieron insights de IA."
    c.setFillColor(palette["background"])
    block_height = 120
    ensure_space(block_height + 30)
    c.roundRect(margin, y - block_height, width - (margin * 2), block_height, 10, fill=True, stroke=False)
    c.setStrokeColor(palette["border"])
    c.roundRect(margin, y - block_height, width - (margin * 2), block_height, 10, fill=False, stroke=True)
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 11)
    y = add_wrapped_text(c, ai_summary, margin + 16, y - 18, width=86, font_size=10)
    y -= 12

    # Gráficos
    graphs = analysis_data.get("graphs", [])
    if graphs:
        draw_section_header(
            "Visualizaciones destacadas",
            "Capturas clave de tus datos con escala optimizada para lectura ejecutiva.",
        )
        for graph in graphs:
            image_bytes = clean_base64_image(graph.get("image"))
            if not image_bytes:
                continue
            title = graph.get("column") or "Gráfico"
            ensure_space(140)
            c.setFont("Helvetica-Bold", 11)
            c.drawString(margin, y, title)
            y -= 14
            try:
                img = ImageReader(io.BytesIO(image_bytes))
                img_width, img_height = img.getSize()
                max_width = width - (margin * 2)
                render_width = min(max_width, img_width)
                scale = render_width / img_width
                render_height = img_height * scale
                if y - render_height < margin:
                    c.showPage()
                    y = height - margin
                    c.setFont("Helvetica-Bold", 11)
                    c.drawString(margin, y, title)
                    y -= 14
                c.roundRect(margin - 6, y - render_height - 8, render_width + 12, render_height + 16, 10, fill=False, stroke=True)
                c.drawImage(
                    img,
                    margin,
                    y - render_height,
                    width=render_width,
                    height=render_height,
                    preserveAspectRatio=True,
                )
                y -= render_height + 24
            except Exception as err:
                logging.error(f"No se pudo añadir un gráfico al PDF: {err}")


    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer


def send_report_email(recipient_email: str, pdf_buffer: io.BytesIO):
    if not SMTP_HOST:
        raise HTTPException(
            status_code=500,
            detail="No hay configuración SMTP disponible para enviar correos.",
        )

    sender = SMTP_FROM or SMTP_USERNAME
    if not sender:
        raise HTTPException(
            status_code=500,
            detail="No se encontró un remitente válido para el envío de correos.",
        )

    pdf_buffer.seek(0)
    message = EmailMessage()
    message["Subject"] = "Reporte Ejecutivo - InformeBF"
    message["From"] = sender
    message["To"] = recipient_email
    message.set_content(
        "Hola,\n\nAdjuntamos tu reporte ejecutivo generado desde InformeBF en formato PDF."
    )
    message.add_attachment(
        pdf_buffer.getvalue(),
        maintype="application",
        subtype="pdf",
        filename="Reporte_InformeBF.pdf",
    )

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            if SMTP_USE_TLS:
                server.starttls()
            if SMTP_USERNAME and SMTP_PASSWORD:
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(message)
    except HTTPException:
        raise
    except Exception as exc:
        logging.error(f"❌ Error enviando el reporte por correo: {exc}")
        raise HTTPException(
            status_code=500,
            detail="No se pudo enviar el reporte por correo electrónico.",
        )

# ==============================
# ENDPOINTS
# ==============================
@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "🚀 InformeBF API operativa",
        "environment": ENV,
        "frontend_allowed": FRONTEND_URL,
        "origins": allowed_origins
    }


@app.get("/admin/openai/status", dependencies=[Depends(admin_required)])
def openai_admin_status():
    """Diagnóstico rápido para administradores sobre OpenAI y uso estimado."""
    logging.info("🛡️ Diagnóstico solicitado para el estado de OpenAI")
    status = check_openai_status()
    usage = status.get("usage") or get_usage_snapshot()
    billing = status.get("billing")
    key_present = bool(get_openai_api_key())

    return {
        "status": status.get("status"),
        "message": status.get("message"),
        "openai_key_present": key_present,
        "usage": usage,
        "billing": billing,
    }


@app.post("/admin/openai/token", dependencies=[Depends(admin_required)])
def update_openai_token(payload: OpenAITokenPayload):
    """Permite actualizar el token de OpenAI sin reiniciar el backend."""

    api_key = payload.api_key.strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="El token de OpenAI no puede estar vacío.")

    try:
        persist_openai_api_key(api_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    logging.info("🔄 Token de OpenAI actualizado por un administrador.")
    return {
        "status": "ok",
        "message": "Token de OpenAI actualizado correctamente.",
    }

# ==============================
# ENDPOINT DE PREVISUALIZACIÓN
# ==============================
@app.post("/upload/preview", dependencies=[Depends(get_current_user)])
async def upload_preview(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No se recibió ningún archivo para previsualizar.")

    logging.info(f"📂 Recibidos {len(files)} archivo(s) para previsualización")

    dataframes = []
    for upload in files:
        if not validate_file(upload.filename):
            raise HTTPException(status_code=400, detail="Formato no soportado (.csv, .xlsx o .zip)")

        content = await upload.read()
        dataframes.extend(_load_dataframes_or_http_error(upload, content))

    if not dataframes:
        raise HTTPException(status_code=400, detail="No se pudo leer información de los archivos adjuntos.")

    try:
        df = pd.concat(dataframes, ignore_index=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"No se pudo combinar la información: {exc}")

    df = df.dropna(how="all").fillna("")
    sample = df.head(5).applymap(json_safe).to_dict(orient="records")
    types = detect_column_types(df)

    return {
        "columns": [{"name": c, "type": types[c]} for c in df.columns],
        "sample": sample
    }

# ==============================
# GESTIÓN DE TRABAJOS DE ANÁLISIS
# ==============================


def _run_full_analysis_job(
    job_id: str,
    df: pd.DataFrame,
    file_types: set[str],
    file_names: list[str],
    date_field: str | None,
    metric_field: str | None,
    segment_field: str | None,
    focus: str | None,
    current_user,
):
    """Ejecuta el análisis completo y actualiza progreso en JobStore."""

    job_store.update_job(job_id, step="analisis_completo", progress=40)
    try:
        usage_context = {
            "user": current_user.get("username") if isinstance(current_user, dict) else None,
            "source": "upload_analysis",
            "files": file_names,
            "focus": focus,
        }

        result = analyze_file(
            df,
            date_field=date_field,
            metric_field=metric_field,
            segment_by=segment_field,
            file_types=file_types,
            usage_context=usage_context,
            user_id=current_user.get("username") if isinstance(current_user, dict) else None,
        )

        job_store.update_job(job_id, step="ia", progress=80)

        safe_sample = result.get("sample") or df.head(10).applymap(json_safe).to_dict(orient="records")
        dataset_name = file_names[0] if file_names else "Dataset analizado"
        dataset_payload = {
            "summary": result.get("summary", {}),
            "sample": safe_sample,
            "graphs": result.get("graphs", []),
            "ai_summary": result.get("ai_summary", "No se generó resumen automático."),
            "data_health": result.get("data_health", {}),
            "refined_insights": result.get("refined_insights", []),
            "historical_deviation": result.get("historical_deviation"),
            "learning_updated": result.get("learning_updated", False),
            "column_types": result.get("column_types", {}),
            "dataset_profile": result.get("dataset_profile", {}),
            "datasetId": job_id,
            "dataset_id": job_id,
            "metadata": {"file_name": dataset_name, "files": file_names},
        }

        response = json_safe_deep(dataset_payload)

        _persist_dataset_context(
            dataset_id=job_id,
            dataset_name=dataset_name,
            analysis_result=dataset_payload,
            metadata={"file_names": file_names, "focus": focus},
            source="analysis_job",
        )

        job_store.update_job(job_id, step="reporte", progress=100, done=True, result=response)
        logging.info("✅ Análisis de job %s completado", job_id)
    except Exception as exc:
        logging.error("❌ Error en job %s: %s", job_id, exc)
        error_msg = (
            f"{exc}. Revisa que el archivo tenga columnas válidas y datos legibles."
        )
        job_store.update_job(job_id, step="error", progress=100, done=True, error=error_msg)


def _prepare_pre_analysis(df: pd.DataFrame, focus: str | None):
    preview_size = 2_000
    sample_df = df.head(preview_size)
    columns = list(sample_df.columns)
    null_counts = sample_df.isna().sum().to_dict()
    null_percentages = {
        col: float(sample_df[col].isna().mean()) * 100 for col in sample_df.columns
    }
    basic_dtypes = {col: str(dtype) for col, dtype in sample_df.dtypes.items()}
    date_candidates = quick_date_detection(sample_df)
    numeric_columns = [
        col for col in sample_df.columns if pd.api.types.is_numeric_dtype(sample_df[col])
    ]

    ai_schema = infer_dataset_schema_with_ai(sample_df.head(250), focus=focus)

    return {
        "rows_est": int(df.shape[0]),
        "rows": int(df.shape[0]),
        "columns": int(sample_df.shape[1]),
        "column_names": columns,
        "null_counts": null_counts,
        "null_percentages": null_percentages,
        "date_candidates": date_candidates,
        "numeric_column_count": len(numeric_columns),
        "dtypes": basic_dtypes,
        "sample_size": int(len(sample_df)),
        "ai_schema": ai_schema,
    }


# ==============================
# ENDPOINTS DE DEMO
# ==============================


@app.get("/demo/analyze")
async def demo_analyze(
    scenario: str = "ventas_demo", current_user=Depends(get_current_user)
):
    scenario_map = {
        "ventas_demo": "ventas_demo.csv",
        "stock_demo": "stock_demo.csv",
    }
    file_name = scenario_map.get(scenario, scenario)
    if not file_name.endswith(".csv"):
        file_name = f"{file_name}.csv"

    df = _load_sample_dataframe(file_name)
    try:
        usage_context = {
            "user": current_user.get("username") if isinstance(current_user, dict) else None,
            "source": "demo_analyze",
            "scenario": scenario,
            "files": [file_name],
        }

        result = analyze_file(
            df,
            date_field=None,
            metric_field=None,
            segment_by=None,
            file_types={".csv"},
            usage_context=usage_context,
            user_id=current_user.get("username") if isinstance(current_user, dict) else None,
        )

        safe_sample = result.get("sample") or df.head(10).applymap(json_safe).to_dict(orient="records")
        dataset_id = str(uuid.uuid4())
        dataset_name = result.get("metadata", {}).get("file_name") or file_name
        demo_metadata = {"is_demo": True, "scenario": scenario}
        dataset_payload = {
            "summary": result.get("summary", {}),
            "sample": safe_sample,
            "graphs": result.get("graphs", []),
            "ai_summary": result.get("ai_summary", "No se generó resumen automático."),
            "data_health": result.get("data_health", {}),
            "refined_insights": result.get("refined_insights", []),
            "historical_deviation": result.get("historical_deviation"),
            "learning_updated": result.get("learning_updated", False),
            "ai_schema": result.get("ai_schema"),
            "data_movie": result.get("data_movie"),
            "column_types": result.get("column_types", {}),
            "dataset_profile": result.get("dataset_profile", {}),
            "datasetId": dataset_id,
            "dataset_id": dataset_id,
            "metadata": {"file_name": dataset_name},
            "demo_metadata": demo_metadata,
        }
        response = json_safe_deep(dataset_payload)

        _persist_dataset_context(
            dataset_id=dataset_id,
            dataset_name=dataset_name,
            analysis_result=dataset_payload,
            metadata={"file_name": dataset_name, "scenario": scenario},
            source="demo_analyze",
        )
        return JSONResponse(content=response)
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logging.error("❌ Error en análisis demo: %s", exc)
        raise HTTPException(status_code=500, detail=f"Error al generar la demo: {exc}") from exc


@app.get("/demo/movie")
async def demo_movie(scenario: str = "ventas_demo", current_user=Depends(get_current_user)):
    scenario_map = {
        "ventas_demo": "ventas_demo.csv",
        "stock_demo": "stock_demo.csv",
    }
    file_name = scenario_map.get(scenario, scenario)
    if not file_name.endswith(".csv"):
        file_name = f"{file_name}.csv"

    df = _load_sample_dataframe(file_name)
    try:
        payload = generate_data_movie_payload(df)
        payload["demo_metadata"] = {"is_demo": True, "scenario": scenario}
        analysis_id = str(uuid.uuid4())
        data_movie_store.save_movie(
            analysis_id,
            {
                "payload": payload,
                "data_movie": payload.get("data_movie"),
                "dataset_csv": df.to_csv(index=False),
            },
        )
        if payload.get("data_movie") is None:
            payload["data_movie"] = {}
        payload["data_movie"].setdefault("download_urls", {})[
            "movie"
        ] = f"/api/movie/report/file/{analysis_id}"
        payload["analysis_id"] = analysis_id
        return JSONResponse(content=json_safe_deep(payload))
    except Exception as exc:  # noqa: BLE001
        logging.error("❌ Error generando película de datos demo: %s", exc)
        raise HTTPException(status_code=500, detail=f"No se pudo generar la película demo: {exc}") from exc


@app.get("/demo/compare")
async def demo_compare(
    scenario: str = "ventas_2024_vs_2025",
    user_focus: str = "todo",
    current_user=Depends(get_current_user),
):
    scenario_map = {
        "ventas_2024_vs_2025": (
            "ventas_comparativa_A.csv",
            "ventas_comparativa_B.csv",
        ),
        "ventas_demo": ("ventas_demo.csv", "stock_demo.csv"),
    }
    file_a, file_b = scenario_map.get(scenario, (None, None))
    if not file_a or not file_b:
        raise HTTPException(status_code=404, detail="Escenario de comparativa demo no disponible")

    df_a = _load_sample_dataframe(file_a)
    df_b = _load_sample_dataframe(file_b)

    try:
        df_a, ai_schema_a, column_types_a = _normalize_dataset(df_a, user_focus)
        df_b, ai_schema_b, column_types_b = _normalize_dataset(df_b, user_focus)

        label_a = "Ventas 2024 (demo)"
        label_b = "Ventas 2025 (demo)"

        comparison = build_comparison(
            df_a,
            df_b,
            ai_schema_a if isinstance(ai_schema_a, dict) else {},
            ai_schema_b if isinstance(ai_schema_b, dict) else {},
            column_types_a,
            column_types_b,
            label_a,
            label_b,
            user_focus,
        )

        return JSONResponse(
            content=json_safe_deep(
                {
                    "label_a": label_a,
                    "label_b": label_b,
                    "ai_schema_a": ai_schema_a,
                    "ai_schema_b": ai_schema_b,
                    "comparison": comparison,
                    "demo_metadata": {"is_demo": True, "scenario": scenario},
                }
            )
        )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        logging.error("❌ Error en comparativa demo: %s", exc)
        raise HTTPException(status_code=500, detail=f"Error al generar la comparativa demo: {exc}") from exc


# ==============================
# ENDPOINTS DE ANÁLISIS CON PROGRESO
# ==============================
@app.post("/analyze/start")
async def start_analysis(
    files: List[UploadFile] = File(...),
    focus: str = Form(None),
    date_field: str = Form(None),
    metric_field: str = Form(None),
    segment_field: str = Form(None),
    current_user=Depends(get_current_user),
):
    if not files:
        raise HTTPException(status_code=400, detail="No se recibió ningún archivo para analizar.")

    logging.info("⚡️ Iniciando análisis con pre-análisis rápido (%s archivos)", len(files))

    dataframes = []
    file_types = set()
    file_names: list[str] = []
    for upload in files:
        if not validate_file(upload.filename):
            raise HTTPException(status_code=400, detail="Formato no soportado (.csv, .xlsx o .zip)")

        content = await upload.read()
        ext = os.path.splitext(upload.filename)[1].lower()
        file_types.add(ext)
        file_names.append(upload.filename)
        dataframes.extend(_load_dataframes_or_http_error(upload, content))

    try:
        df = pd.concat(dataframes, ignore_index=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"No se pudo combinar la información: {exc}")

    df = df.dropna(how="all")
    pre_analysis = _prepare_pre_analysis(df, focus)

    job_id = str(uuid.uuid4())
    job_store.create_job(
        job_id,
        {
            "progress": 20,
            "step": "pre_analisis",
            "done": False,
            "result": None,
        },
    )

    thread = threading.Thread(
        target=_run_full_analysis_job,
        kwargs={
            "job_id": job_id,
            "df": df,
            "file_types": file_types,
            "file_names": file_names,
            "date_field": date_field,
            "metric_field": metric_field,
            "segment_field": segment_field,
            "focus": focus,
            "current_user": current_user,
        },
        daemon=True,
    )
    thread.start()

    return {
        "job_id": job_id,
        "pre_analysis": json_safe_deep(pre_analysis),
        "progress": 20,
        "step": "pre_analisis",
    }


@app.get("/analyze/status/{job_id}")
async def get_analysis_status(job_id: str):
    job = job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado")

    response = {
        "job_id": job_id,
        "progress": job.get("progress", 0),
        "step": job.get("step", "cargando"),
        "done": job.get("done", False),
    }

    if job.get("done"):
        response["result"] = job.get("result")
        response["error"] = job.get("error")

    return response


# ==============================
# ENDPOINT DE ANÁLISIS COMPLETO (sin progreso, compatibilidad)
# ==============================
@app.post("/upload")
async def upload_file(
    files: List[UploadFile] = File(...),
    date_field: str = Form(None),
    metric_field: str = Form(None),
    segment_field: str = Form(None),
    current_user=Depends(get_current_user)
):
    if not files:
        raise HTTPException(status_code=400, detail="No se recibió ningún archivo para analizar.")

    logging.info(f"📊 Analizando {len(files)} archivo(s) enviados (sin job)")

    dataframes = []
    file_types = set()
    file_names: list[str] = []
    for upload in files:
        if not validate_file(upload.filename):
            raise HTTPException(status_code=400, detail="Formato no soportado (.csv, .xlsx o .zip)")

        content = await upload.read()
        ext = os.path.splitext(upload.filename)[1].lower()
        file_types.add(ext)
        file_names.append(upload.filename)
        dataframes.extend(_load_dataframes_or_http_error(upload, content))

    try:
        df = pd.concat(dataframes, ignore_index=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo combinar la información: {e}")

    try:
        usage_context = {
            "user": current_user.get("username"),
            "source": "upload_analysis",
            "files": file_names,
        }

        result = analyze_file(
            df,
            date_field=date_field,
            metric_field=metric_field,
            segment_by=segment_field,
            file_types=file_types,
            usage_context=usage_context,
            user_id=current_user.get("username") if isinstance(current_user, dict) else None,
        )

        safe_sample = df.head(10).applymap(json_safe).to_dict(orient="records")
        response = json_safe_deep({
            "summary": result.get("summary", {}),
            "sample": safe_sample,
            "graphs": result.get("graphs", []),
            "ai_summary": result.get("ai_summary", "No se generó resumen automático."),
            "data_health": result.get("data_health", {}),
            "refined_insights": result.get("refined_insights", []),
            "historical_deviation": result.get("historical_deviation"),
            "learning_updated": result.get("learning_updated", False),
            "ai_schema": result.get("ai_schema"),
            "data_movie": result.get("data_movie"),
        })

        logging.info("✅ Análisis completado correctamente.")
        return JSONResponse(content=response)

    except Exception as e:
        logging.error(f"❌ Error en el análisis: {e}")
        raise HTTPException(status_code=500, detail=f"Error en el análisis: {e}")


@app.post("/analyze/movie")
async def analyze_data_movie(
    file: UploadFile = File(...),
    user_focus: str = Form(None),
    date_field: str | None = Form(None),
    current_user=Depends(get_current_user),
):
    if not file:
        raise HTTPException(status_code=400, detail="No se recibió ningún archivo para la película de datos.")

    if not validate_file(file.filename):
        raise HTTPException(status_code=400, detail="Formato no soportado (.csv, .xlsx o .zip)")

    content = await file.read()
    dataframes = _load_dataframes_or_http_error(file, content)

    try:
        df = pd.concat(dataframes, ignore_index=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"No se pudo combinar la información: {exc}")

    try:
        payload = generate_data_movie_payload(df, focus=user_focus, date_field=date_field)
        analysis_id = str(uuid.uuid4())
        data_movie_store.save_movie(
            analysis_id,
            {
                "payload": payload,
                "data_movie": payload.get("data_movie"),
                "dataset_csv": df.to_csv(index=False),
            },
        )
        if payload.get("data_movie") is None:
            payload["data_movie"] = {}
        payload["data_movie"].setdefault("download_urls", {})[
            "movie"
        ] = f"/api/movie/report/file/{analysis_id}"
        payload["analysis_id"] = analysis_id
        return JSONResponse(content=json_safe_deep(payload))
    except Exception as exc:
        logging.error("❌ Error generando película de datos: %s", exc)
        raise HTTPException(status_code=500, detail=f"Error al generar la película de datos: {exc}")


@app.get("/api/movie/report/pdf/{analysis_id}")
async def download_movie_pdf(analysis_id: str):
    stored = data_movie_store.get_movie(analysis_id)
    if not stored:
        raise HTTPException(status_code=404, detail="Película no encontrada para este ID")

    data_movie = stored.get("data_movie") or (stored.get("payload") or {}).get("data_movie")
    if not data_movie:
        raise HTTPException(status_code=404, detail="No hay escenas guardadas para este análisis")

    pdf_buffer = _movie_to_pdf(data_movie)
    headers = {
        "Content-Disposition": f"attachment; filename=movie-report-{analysis_id}.pdf"
    }
    return StreamingResponse(pdf_buffer, media_type="application/pdf", headers=headers)


@app.get("/api/movie/report/charts-zip/{analysis_id}")
async def download_movie_charts(analysis_id: str):
    stored = data_movie_store.get_movie(analysis_id)
    if not stored:
        raise HTTPException(status_code=404, detail="Película no encontrada para este ID")

    data_movie = stored.get("data_movie") or (stored.get("payload") or {}).get("data_movie")
    if not data_movie:
        raise HTTPException(status_code=404, detail="No hay escenas guardadas para este análisis")

    zip_buffer = _movie_charts_zip(data_movie)
    headers = {
        "Content-Disposition": f"attachment; filename=movie-charts-{analysis_id}.zip"
    }
    return StreamingResponse(zip_buffer, media_type="application/zip", headers=headers)


@app.get("/api/movie/report/file/{analysis_id}")
async def download_movie_file(analysis_id: str):
    stored = data_movie_store.get_movie(analysis_id)
    if not stored:
        raise HTTPException(status_code=404, detail="Película no encontrada para este ID")

    data_movie = stored.get("data_movie") or (stored.get("payload") or {}).get("data_movie")
    if not data_movie:
        raise HTTPException(status_code=404, detail="No hay escenas guardadas para este análisis")

    buffer = io.BytesIO(json.dumps(data_movie, ensure_ascii=False, indent=2).encode("utf-8"))
    headers = {
        "Content-Disposition": f"attachment; filename=movie-{analysis_id}.movie",
    }
    return StreamingResponse(buffer, media_type="application/json", headers=headers)


@app.get("/api/movie/report/dataset/{analysis_id}")
async def download_movie_dataset(analysis_id: str):
    stored = data_movie_store.get_movie(analysis_id)
    if not stored:
        raise HTTPException(status_code=404, detail="Película no encontrada para este ID")

    dataset_csv = stored.get("dataset_csv")
    if not dataset_csv:
        raise HTTPException(status_code=404, detail="No hay dataset disponible para este análisis")

    buffer = io.BytesIO(dataset_csv.encode("utf-8"))
    headers = {
        "Content-Disposition": f"attachment; filename=dataset-{analysis_id}.csv"
    }
    return StreamingResponse(buffer, media_type="text/csv", headers=headers)


@app.post("/analyze/compare")
async def compare_datasets(
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
    user_focus: str = Form("todo"),
    label_a: str = Form("Dataset A"),
    label_b: str = Form("Dataset B"),
    current_user=Depends(get_current_user),
):
    """Compara dos archivos y entrega métricas y variaciones clave."""

    for upload in (file_a, file_b):
        if not validate_file(upload.filename):
            raise HTTPException(status_code=400, detail="Formato no soportado (.csv, .xlsx o .zip)")

    content_a, content_b = await file_a.read(), await file_b.read()
    dataframes_a = _load_dataframes_or_http_error(file_a, content_a)
    dataframes_b = _load_dataframes_or_http_error(file_b, content_b)

    try:
        df_a = pd.concat(dataframes_a, ignore_index=True)
        df_b = pd.concat(dataframes_b, ignore_index=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"No se pudieron combinar los archivos: {exc}")

    try:
        df_a, ai_schema_a, column_types_a = _normalize_dataset(df_a, user_focus)
        df_b, ai_schema_b, column_types_b = _normalize_dataset(df_b, user_focus)

        comparison = build_comparison(
            df_a,
            df_b,
            ai_schema_a if isinstance(ai_schema_a, dict) else {},
            ai_schema_b if isinstance(ai_schema_b, dict) else {},
            column_types_a,
            column_types_b,
            label_a,
            label_b,
            user_focus,
        )

        return JSONResponse(
            content=json_safe_deep(
                {
                    "label_a": label_a,
                    "label_b": label_b,
                    "ai_schema_a": ai_schema_a,
                    "ai_schema_b": ai_schema_b,
                    "comparison": comparison,
                }
            )
        )
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("❌ Error en comparativa: %s", exc)
        raise HTTPException(status_code=500, detail=f"Error al generar la comparativa: {exc}")


def run_compare_job(job_id: str, user_focus: str, label_a: str, label_b: str):
    job = compare_job_store.get_job(job_id)
    if not job:
        logging.warning("⚠️ Job de comparativa no encontrado: %s", job_id)
        return

    try:
        compare_job_store.update_job(job_id, step="leyendo_archivos", progress=30, error=None)
        file_a_path = job.get("file_a_path")
        file_b_path = job.get("file_b_path")
        file_a_name = job.get("file_a_name")
        file_b_name = job.get("file_b_name")

        if not file_a_path or not file_b_path:
            raise ValueError("No se encontraron las rutas temporales de los archivos")

        sample_a = _read_schema_sample(file_a_path, file_a_name)
        sample_b = _read_schema_sample(file_b_path, file_b_name)

        df_a_sample, ai_schema_a, column_types_a = _normalize_dataset(sample_a, user_focus)
        df_b_sample, ai_schema_b, column_types_b = _normalize_dataset(sample_b, user_focus)

        main_metric = _select_main_metric(
            ai_schema_a if isinstance(ai_schema_a, dict) else {},
            ai_schema_b if isinstance(ai_schema_b, dict) else {},
            column_types_a,
            column_types_b,
        )
        entity_column = _select_entity_column(
            ai_schema_a if isinstance(ai_schema_a, dict) else {},
            ai_schema_b if isinstance(ai_schema_b, dict) else {},
            df_a_sample,
            df_b_sample,
        )
        date_column = _select_date_column(
            ai_schema_a if isinstance(ai_schema_a, dict) else {},
            ai_schema_b if isinstance(ai_schema_b, dict) else {},
            df_a_sample,
            df_b_sample,
        )
        timeline_granularity = _select_timeline_granularity(
            ai_schema_a if isinstance(ai_schema_a, dict) else {},
            ai_schema_b if isinstance(ai_schema_b, dict) else {},
        )

        if not main_metric:
            raise ValueError("No se encontró una métrica principal para comparar.")

        compare_job_store.update_job(job_id, step="comparando_datasets", progress=60)

        aggregates_a = _aggregate_dataset_from_path(
            file_a_path,
            file_a_name,
            main_metric,
            entity_column,
            date_column,
            timeline_granularity,
            available_columns=list(sample_a.columns),
        )
        aggregates_b = _aggregate_dataset_from_path(
            file_b_path,
            file_b_name,
            main_metric,
            entity_column,
            date_column,
            timeline_granularity,
            available_columns=list(sample_b.columns),
        )

        comparison = build_comparison(
            df_a_sample,
            df_b_sample,
            ai_schema_a if isinstance(ai_schema_a, dict) else {},
            ai_schema_b if isinstance(ai_schema_b, dict) else {},
            column_types_a,
            column_types_b,
            label_a,
            label_b,
            user_focus,
            aggregated_a=aggregates_a,
            aggregated_b=aggregates_b,
            rows_meta={
                "rows_a": aggregates_a.get("rows", len(df_a_sample)),
                "rows_b": aggregates_b.get("rows", len(df_b_sample)),
                "columns_a": aggregates_a.get("columns", df_a_sample.shape[1]),
                "columns_b": aggregates_b.get("columns", df_b_sample.shape[1]),
            },
        )

        compare_job_store.update_job(job_id, step="generando_insights", progress=90)

        result = {
            "label_a": label_a,
            "label_b": label_b,
            "ai_schema_a": ai_schema_a,
            "ai_schema_b": ai_schema_b,
            "comparison": comparison,
        }

        compare_job_store.update_job(
            job_id,
            step="completo",
            progress=100,
            done=True,
            error=None,
            result=json_safe_deep(result),
        )
    except Exception as exc:  # noqa: BLE001
        logging.exception("❌ Error en job de comparativa %s: %s", job_id, exc)
        current_state = compare_job_store.get_job(job_id) or {}
        fallback_progress = current_state.get("progress", 60) or 60
        compare_job_store.update_job(
            job_id,
            done=True,
            error=str(exc),
            step="error",
            progress=min(fallback_progress, 90),
        )


@app.post("/compare/start")
async def start_compare_job(
    background_tasks: BackgroundTasks,
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
    user_focus: str = Form("todo"),
    label_a: str = Form("Dataset A"),
    label_b: str = Form("Dataset B"),
    current_user=Depends(get_current_user),
):
    if not file_a or not file_b:
        raise HTTPException(status_code=400, detail="Debes enviar ambos archivos para comparar.")

    for upload in (file_a, file_b):
        if not validate_file(upload.filename):
            raise HTTPException(status_code=400, detail="Formato no soportado (.csv, .xlsx o .zip)")

    content_a, content_b = await file_a.read(), await file_b.read()

    preview_a = _prepare_preview(file_a, content_a)
    preview_b = _prepare_preview(file_b, content_b)

    job_id = compare_job_store.create_job(
        {
            "step": "preparando_datos",
            "progress": 10,
            "done": False,
            "error": None,
        }
    )

    path_a = _save_uploaded_file(file_a, content_a, job_id, "file_a")
    path_b = _save_uploaded_file(file_b, content_b, job_id, "file_b")

    compare_job_store.update_job(
        job_id,
        file_a_path=path_a,
        file_b_path=path_b,
        file_a_name=file_a.filename,
        file_b_name=file_b.filename,
    )

    background_tasks.add_task(run_compare_job, job_id, user_focus, label_a, label_b)

    response = {
        "job_id": job_id,
        "pre_summary": {
            "rows_a_est": preview_a["rows_est"],
            "rows_b_est": preview_b["rows_est"],
            "columns_a": preview_a["columns"],
            "columns_b": preview_b["columns"],
            "label_a": label_a,
            "label_b": label_b,
        },
        "progress": 10,
        "step": "preparando_datos",
    }

    return JSONResponse(content=json_safe_deep(response))


@app.get("/compare/status/{job_id}")
def get_compare_status(job_id: str, current_user=Depends(get_current_user)):
    job = compare_job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="No se encontró el job solicitado.")

    payload = {
        "job_id": job_id,
        "step": job.get("step"),
        "progress": job.get("progress", 0),
        "done": job.get("done", False),
        "error": job.get("error"),
    }

    if job.get("done") and not job.get("error"):
        payload["result"] = job.get("result")

    return JSONResponse(content=json_safe_deep(payload))


@app.post("/report", dependencies=[Depends(get_current_user)])
async def generate_report(request: Request):
    """Recibe el resultado del análisis y devuelve un PDF ejecutivo."""
    payload = await request.json()
    analysis = payload.get("analysis")

    if not analysis:
        raise HTTPException(status_code=400, detail="No se recibió información de análisis para generar el reporte.")

    try:
        pdf_buffer = build_executive_report(analysis)
    except Exception as exc:
        logging.error(f"❌ Error creando el reporte PDF: {exc}")
        raise HTTPException(status_code=500, detail="No se pudo generar el reporte ejecutivo.")

    headers = {
        "Content-Disposition": "attachment; filename=Reporte_InformeBF.pdf"
    }
    return StreamingResponse(pdf_buffer, media_type="application/pdf", headers=headers)


@app.post("/report/email", dependencies=[Depends(get_current_user)])
async def email_report(payload: EmailReportPayload):
    if not payload.analysis:
        raise HTTPException(status_code=400, detail="No se recibió información de análisis para generar el reporte.")

    if not payload.email:
        raise HTTPException(status_code=400, detail="Debes indicar un correo de destino.")

    try:
        pdf_buffer = build_executive_report(payload.analysis)
        send_report_email(payload.email, pdf_buffer)
    except HTTPException:
        raise
    except Exception as exc:
        logging.error(f"❌ Error al enviar el reporte por correo: {exc}")
        raise HTTPException(status_code=500, detail="No se pudo enviar el reporte por correo.")

    return {"detail": "Reporte enviado correctamente por correo."}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=HOST,
        port=PORT,
        reload=ENV == "development",
    )
