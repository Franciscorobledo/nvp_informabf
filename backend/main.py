from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import pandas as pd
import io
import logging
import jwt
import os
import numpy as np
from datetime import datetime
import base64
import textwrap
import zipfile
from typing import List
from dotenv import load_dotenv

from utils.file_utils import validate_file
from analysis import analyze_file, detect_column_types
from auth import get_current_user, router as auth_router
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

# ==============================
# CONFIGURACIÓN GLOBAL
# ==============================
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "DEV_SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ENV = os.getenv("ENV", "development")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
ALLOW_ONRENDER_WILDCARD = os.getenv("ALLOW_ONRENDER_WILDCARD", "true").lower() in {"1", "true", "yes"}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

app = FastAPI(title="InformeBF - Intelligent Data Visualizer")

# ==============================
# CONFIGURACIÓN DE CORS
# ==============================
# Permite definir múltiples orígenes en la variable FRONTEND_URL separados por comas
dynamic_origins = [origin.strip() for origin in FRONTEND_URL.split(",") if origin.strip()]

allowed_origins = list({
    *dynamic_origins,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:1000",
    # Variantes de producción conocidas
    "https://nvp-informabf.onrender.com",
    "https://nvp-informabf-front.onrender.com",
    "https://nvp.informabf.onrender.com",
    "https://nvp.informabf-front.onrender.com",
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


def read_dataframes(upload: UploadFile, content: bytes) -> list[pd.DataFrame]:
    """Lee un archivo subido (csv, xlsx o zip) y devuelve una lista de DataFrames."""
    ext = os.path.splitext(upload.filename)[1].lower()

    def _read_csv(buffer):
        return pd.read_csv(buffer)

    def _read_excel(buffer):
        return pd.read_excel(buffer, engine="openpyxl")

    if ext in {".csv", ".xlsx"}:
        buffer = io.BytesIO(content)
        reader = _read_excel if ext == ".xlsx" else _read_csv
        return [reader(buffer)]

    if ext == ".zip":
        try:
            dataframes = []
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                for name in archive.namelist():
                    lower_name = name.lower()
                    if lower_name.endswith("/"):
                        continue
                    if lower_name.endswith(".csv"):
                        with archive.open(name) as f:
                            dataframes.append(_read_csv(f))
                    elif lower_name.endswith(".xlsx"):
                        with archive.open(name) as f:
                            dataframes.append(_read_excel(f))

            if not dataframes:
                raise HTTPException(
                    status_code=400,
                    detail="El ZIP no contiene archivos .csv o .xlsx válidos.",
                )
            return dataframes
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=f"No se pudo leer el archivo comprimido: {exc}",
            )

    raise HTTPException(
        status_code=400, detail="Formato no soportado (.csv, .xlsx o .zip)"
    )


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


def build_executive_report(analysis_data: dict) -> io.BytesIO:
    """Genera un PDF ejecutivo a partir del análisis enviado desde el frontend."""
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

    c.setTitle("InformeBF - Reporte ejecutivo")
    c.setFont("Helvetica-Bold", 18)
    c.drawString(margin, y, "InformeBF - Reporte ejecutivo")
    y -= 24
    c.setFont("Helvetica", 11)
    c.drawString(margin, y, f"Generado: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
    y -= 30

    # Resumen
    c.setFont("Helvetica-Bold", 14)
    c.drawString(margin, y, "Resumen estadístico")
    y -= 20
    summary = analysis_data.get("summary", {})
    if not summary:
        c.setFont("Helvetica", 11)
        c.drawString(margin, y, "No se recibieron estadísticas para este dataset.")
        y -= 20
    else:
        for column, stats in summary.items():
            ensure_space(30)
            c.setFont("Helvetica-Bold", 11)
            c.drawString(margin, y, f"• {column}")
            y -= 14
            c.setFont("Helvetica", 10)
            if isinstance(stats, dict):
                for key, value in stats.items():
                    line = f"{key}: {value}"
                    y = add_wrapped_text(c, line, margin + 14, y, width=85)
            else:
                y = add_wrapped_text(c, stats, margin + 14, y, width=85)
            y -= 8

    # Insights
    ensure_space(60)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(margin, y, "Insights automáticos")
    y -= 18
    ai_summary = analysis_data.get("ai_summary") or "No se recibieron insights de IA."
    y = add_wrapped_text(c, ai_summary, margin, y, width=90)
    y -= 10

    # Gráficos
    graphs = analysis_data.get("graphs", [])
    if graphs:
        ensure_space(40)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(margin, y, "Visualizaciones destacadas")
        y -= 20
        for graph in graphs:
            image_bytes = clean_base64_image(graph.get("image"))
            if not image_bytes:
                continue
            title = graph.get("column") or "Gráfico"
            ensure_space(60)
            c.setFont("Helvetica-Bold", 11)
            c.drawString(margin, y, title)
            y -= 16
            try:
                img = ImageReader(io.BytesIO(image_bytes))
                img_width, img_height = img.getSize()
                max_width = width - (margin * 2)
                render_width = min(max_width, img_width)
                scale = render_width / img_width
                render_height = img_height * scale
                if y - render_height < margin:
                    c.showPage()
                    c.setFont("Helvetica-Bold", 11)
                    y = height - margin
                    c.drawString(margin, y, title)
                    y -= 16
                c.drawImage(
                    img,
                    margin,
                    y - render_height,
                    width=render_width,
                    height=render_height,
                    preserveAspectRatio=True,
                )
                y -= render_height + 20
            except Exception as err:
                logging.error(f"No se pudo añadir un gráfico al PDF: {err}")

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer

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
        dataframes.extend(read_dataframes(upload, content))

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
# ENDPOINT DE ANÁLISIS COMPLETO
# ==============================
@app.post("/upload", dependencies=[Depends(get_current_user)])
async def upload_file(
    files: List[UploadFile] = File(...),
    date_field: str = Form(None),
    metric_field: str = Form(None),
    segment_field: str = Form(None)
):
    if not files:
        raise HTTPException(status_code=400, detail="No se recibió ningún archivo para analizar.")

    logging.info(f"📊 Analizando {len(files)} archivo(s) enviados")

    dataframes = []
    for upload in files:
        if not validate_file(upload.filename):
            raise HTTPException(status_code=400, detail="Formato no soportado (.csv, .xlsx o .zip)")

        content = await upload.read()
        dataframes.extend(read_dataframes(upload, content))

    try:
        df = pd.concat(dataframes, ignore_index=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo combinar la información: {e}")

    try:
        result = analyze_file(
            df,
            date_field=date_field,
            metric_field=metric_field,
            segment_by=segment_field
        )

        # 🔹 Normalizar todo para JSON seguro
        safe_sample = df.head(10).applymap(json_safe).to_dict(orient="records")
        response = json_safe_deep({
            "summary": result.get("summary", {}),
            "sample": safe_sample,
            "graphs": result.get("graphs", []),
            "ai_summary": result.get("ai_summary", "No se generó resumen automático.")
        })

        logging.info("✅ Análisis completado correctamente.")
        return JSONResponse(content=response)

    except Exception as e:
        logging.error(f"❌ Error en el análisis: {e}")
        raise HTTPException(status_code=500, detail=f"Error en el análisis: {e}")


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
