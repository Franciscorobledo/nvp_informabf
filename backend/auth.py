from fastapi import APIRouter, HTTPException, Form
from datetime import timedelta, datetime
import jwt
import os
import hashlib
import logging
from dotenv import load_dotenv

# -----------------------------
# CONFIGURACIÓN
# -----------------------------
load_dotenv()

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "DEV_SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 120))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

# -----------------------------
# BASE DE DATOS SIMULADA
# -----------------------------
def hash_password(password: str) -> str:
    """Devuelve el hash SHA256 de una contraseña."""
    return hashlib.sha256(password.encode()).hexdigest()

fake_users_db = {
    "admin": {
        "username": "admin",
        "full_name": "Administrador del Sistema",
        "hashed_password": hash_password("1234"),
    }
}

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si la contraseña en texto plano coincide con el hash almacenado."""
    return hash_password(plain_password) == hashed_password

def authenticate_user(username: str, password: str):
    """Valida las credenciales contra la base simulada."""
    user = fake_users_db.get(username)
    if not user:
        logging.warning(f"Intento de login fallido: usuario '{username}' no encontrado.")
        return None
    if not verify_password(password, user["hashed_password"]):
        logging.warning(f"Intento de login fallido: contraseña incorrecta para '{username}'.")
        return None
    logging.info(f"✅ Usuario autenticado: {username}")
    return user

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Genera un token JWT con tiempo de expiración."""
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
    """Autenticación básica que devuelve un token JWT."""
    user = authenticate_user(username, password)
    if not user:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user["username"], "user": user["full_name"]},
        expires_delta=access_token_expires
    )

    logging.info(f"🔐 Token generado para usuario: {username}")

    return {
        "access_token": access_token,
        "token": access_token,  # compatibilidad con frontend
        "token_type": "bearer",
        "user": user["full_name"],
        "username": user["username"],
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "status": "success",
        "message": f"Inicio de sesión exitoso para {user['username']}"
    }

# -----------------------------
# ENDPOINT DE PRUEBA (GET)
# -----------------------------
@router.get("/check")
def check_status():
    """Verifica que el router de autenticación está operativo."""
    return {
        "status": "ok",
        "message": "Ruta /auth activa y funcional",
        "algorithm": ALGORITHM,
        "expires_in_minutes": ACCESS_TOKEN_EXPIRE_MINUTES
    }
