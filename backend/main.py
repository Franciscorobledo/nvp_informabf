from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer
import pandas as pd
import io
import logging
import jwt
import os
import numpy as np
from datetime import datetime
from dotenv import load_dotenv

from utils.file_utils import validate_file
from analysis import analyze_file, detect_column_types
from auth import router as auth_router

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

security = HTTPBearer()

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
@app.post("/upload/preview", dependencies=[Depends(security)])
async def upload_preview(file: UploadFile = File(...)):
    logging.info(f"📂 Recibido archivo: {file.filename}")

    if not validate_file(file.filename):
        raise HTTPException(status_code=400, detail="Formato no soportado (.csv o .xlsx)")

    content = await file.read()
    buffer = io.BytesIO(content)

    try:
        df = (
            pd.read_excel(buffer, engine="openpyxl")
            if file.filename.endswith(".xlsx")
            else pd.read_csv(buffer)
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo leer el archivo: {e}")

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
@app.post("/upload", dependencies=[Depends(security)])
async def upload_file(
    file: UploadFile = File(...),
    date_field: str = Form(None),
    metric_field: str = Form(None),
    segment_field: str = Form(None)
):
    logging.info(f"📊 Analizando archivo {file.filename}")

    content = await file.read()
    buffer = io.BytesIO(content)

    try:
        df = (
            pd.read_excel(buffer, engine="openpyxl")
            if file.filename.endswith(".xlsx")
            else pd.read_csv(buffer)
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo leer el archivo: {e}")

    try:
        result = analyze_file(
            df,
            date_field=date_field,
            metric_field=metric_field,
            segment_by=segment_field
        )

        # 🔹 Normalizar todo para JSON seguro
        safe_sample = df.head(10).applymap(json_safe).to_dict(orient="records")
        response = {
            "summary": result.get("summary", {}),
            "sample": safe_sample,
            "graphs": result.get("graphs", []),
            "ai_summary": result.get("ai_summary", "No se generó resumen automático.")
        }

        logging.info("✅ Análisis completado correctamente.")
        return JSONResponse(content=response)

    except Exception as e:
        logging.error(f"❌ Error en el análisis: {e}")
        raise HTTPException(status_code=500, detail=f"Error en el análisis: {e}")
