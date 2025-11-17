# backend/auth.py
from fastapi import APIRouter, HTTPException, Form
from datetime import timedelta, datetime
import jwt
import os
import hashlib
from dotenv import load_dotenv

# Cargar variables del entorno
load_dotenv()

router = APIRouter()

# Configuración del token
SECRET_KEY = os.getenv("SECRET_KEY", "DEV_SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 120))

# -----------------------------
# BASE DE DATOS SIMULADA
# -----------------------------
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

fake_users_db = {
    "admin": {
        "username": "admin",
        "full_name": "Administrador del Sistema",
        "hashed_password": hash_password("1234"),
    }
}

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hash_password(plain_password) == hashed_password

def authenticate_user(username: str, password: str):
    user = fake_users_db.get(username)
    if not user or not verify_password(password, user["hashed_password"]):
        return None
    return user

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


# -----------------------------
# ENDPOINT: LOGIN (POST)
# -----------------------------
@router.post("/login")
async def login(username: str = Form(...), password: str = Form(...)):
    user = authenticate_user(username, password)
    if not user:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"]},
        expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user["full_name"],
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


# -----------------------------
# ENDPOINT DE PRUEBA (GET)
# -----------------------------
@router.get("/check")
def check_status():
    """Prueba rápida para confirmar que el router /auth está activo"""
    return {"status": "ok", "message": "Ruta /auth activa"}
