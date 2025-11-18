from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
import pandas as pd
import io
import logging
import jwt
import os
from dotenv import load_dotenv

from utils.file_utils import validate_file
from analysis import analyze_file, detect_column_types
from auth import router as auth_router  # Importación del router de autenticación

# -----------------------------
# CONFIGURACIÓN GLOBAL
# -----------------------------
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "DEV_SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ENV = os.getenv("ENV", "development")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

security = HTTPBearer()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

# -----------------------------
# CREACIÓN DE LA APP
# -----------------------------
app = FastAPI(title="Intelligent Data Analyzer")

# -----------------------------
# CONFIGURACIÓN CORS
# -----------------------------
allowed_origins = [
    FRONTEND_URL,  # dinámico desde el entorno
    "http://localhost:5173",
    "http://localhost:3000",
    "https://nvp-informabf-front.onrender.com",
    "https://nvp-informabf-front-wxdb.onrender.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.info(f"🚀 Backend iniciado en modo: {ENV}")
logging.info(f"🌐 Orígenes permitidos: {allowed_origins}")

# -----------------------------
# INCLUSIÓN DE ROUTER AUTH
# -----------------------------
app.include_router(auth_router, prefix="/auth", tags=["Autenticación"])

# -----------------------------
# VERIFICACIÓN DE TOKEN
# -----------------------------
def verify_token(credentials=Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido o mal formado")

# -----------------------------
# ENDPOINTS DE ANÁLISIS
# -----------------------------
@app.post("/upload/preview", dependencies=[Depends(verify_token)])
async def upload_preview(file: UploadFile = File(...)):
    """Analiza la estructura del archivo y devuelve columnas detectadas."""
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
    types = detect_column_types(df)
    sample = df.head(5).to_dict(orient="records")

    return {
        "columns": [{"name": c, "type": types[c]} for c in df.columns],
        "sample": sample
    }


@app.post("/upload", dependencies=[Depends(verify_token)])
async def upload_file(
    file: UploadFile = File(...),
    date_field: str = Form(None),
    metric_field: str = Form(None),
    segment_field: str = Form(None)
):
    """Analiza el archivo completo según la selección del usuario."""
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en el análisis: {e}")

    return result


# -----------------------------
# ENDPOINT RAÍZ
# -----------------------------
@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "🚀 Intelligent Data Analyzer API operativa",
        "environment": ENV,
        "frontend_allowed": FRONTEND_URL,
        "openai_key_detected": bool(OPENAI_API_KEY),
        "origins": allowed_origins
    }
