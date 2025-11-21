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
from typing import List
from dotenv import load_dotenv
from pydantic import BaseModel, EmailStr
import smtplib
from email.message import EmailMessage

from utils.file_utils import validate_file
from analysis import analyze_file, detect_column_types
from auth import admin_required, get_current_user, router as auth_router
from ai_module import check_openai_status
from utils.dataframe_loader import read_dataframes
from utils.openai_keys import get_openai_api_key, persist_openai_api_key
from utils.openai_monitor import get_usage_snapshot
from usage_api import router as usage_router
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

# ==============================
# CONFIGURACIÓN GLOBAL
# ==============================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOTENV_PATH = os.path.join(BASE_DIR, ".env")
load_dotenv(dotenv_path=DOTENV_PATH, override=False)

SECRET_KEY = os.getenv("SECRET_KEY", "DEV_SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ENV = os.getenv("ENV", "development")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
ALLOW_ONRENDER_WILDCARD = os.getenv("ALLOW_ONRENDER_WILDCARD", "true").lower() in {"1", "true", "yes"}
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


class OpenAITokenPayload(BaseModel):
    api_key: str


class EmailReportPayload(BaseModel):
    analysis: dict
    email: EmailStr

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
app.include_router(usage_router)

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
        dataframes.extend(read_dataframes(upload, content))

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
# ENDPOINT DE ANÁLISIS COMPLETO
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

    logging.info(f"📊 Analizando {len(files)} archivo(s) enviados")

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
        dataframes.extend(read_dataframes(upload, content))

    if not dataframes:
        raise HTTPException(status_code=400, detail="No se pudo leer información de los archivos adjuntos.")

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
