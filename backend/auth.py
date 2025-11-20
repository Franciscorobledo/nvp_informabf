from datetime import datetime, timedelta, timezone
import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Dict, Literal, Optional

import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, Form, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

# -----------------------------
# CONFIGURACIÓN
# -----------------------------
load_dotenv()

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "DEV_SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 120))
DEFAULT_ADMIN_PASSWORD = os.getenv("DEFAULT_ADMIN_PASSWORD", "Francisco8")
USERS_FILE = Path(__file__).with_name("users.json")

security = HTTPBearer()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

# -----------------------------
# UTILIDADES DE USUARIOS
# -----------------------------
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hash_password(plain_password) == hashed_password

def _normalize_record(username: str, record) -> dict:
    """Normaliza un registro de usuario para soportar esquemas previos."""
    if isinstance(record, dict):
        normalized = {
            "username": record.get("username", username),
            "full_name": record.get("full_name") or username,
            "hashed_password": record.get("hashed_password") or "",
            "role": record.get("role", "user"),
            "active": record.get("active", True),
            "created_at": record.get("created_at") or datetime.utcnow().isoformat(),
            "expires_at": record.get("expires_at"),
        }
        return normalized

    if isinstance(record, str):
        # Esquema anterior: {"username": "hashed_password"}
        return {
            "username": username,
            "full_name": username,
            "hashed_password": record,
            "role": "admin" if username == "admin" else "user",
            "active": True,
            "created_at": datetime.utcnow().isoformat(),
        }

    raise ValueError(f"Formato de usuario no soportado para '{username}'")


def _ensure_storage() -> None:
    """Garantiza la existencia del archivo de usuarios con el admin inicial."""
    if not USERS_FILE.exists():
        logging.info("Creando archivo de usuarios con cuenta de administrador por defecto")
        admin_record = {
            "username": "admin",
            "full_name": "Administrador del Sistema",
            "hashed_password": hash_password(DEFAULT_ADMIN_PASSWORD),
            "role": "admin",
            "active": True,
            "created_at": datetime.utcnow().isoformat(),
        }
        USERS_FILE.write_text(json.dumps({"admin": admin_record}, indent=2), encoding="utf-8")
        return

    try:
        data = json.loads(USERS_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="No se pudo leer el archivo de usuarios")

    admin_record = data.get("admin")
    if not admin_record:
        logging.warning("No se encontró el usuario admin, recreando entrada por defecto")
        data["admin"] = {
            "username": "admin",
            "full_name": "Administrador del Sistema",
            "hashed_password": hash_password(DEFAULT_ADMIN_PASSWORD),
            "role": "admin",
            "active": True,
            "created_at": datetime.utcnow().isoformat(),
        }
    else:
        normalized_admin = _normalize_record("admin", admin_record)
        normalized_admin["hashed_password"] = hash_password(DEFAULT_ADMIN_PASSWORD)
        data["admin"] = normalized_admin

    USERS_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def load_users() -> Dict[str, dict]:
    _ensure_storage()
    try:
        data = json.loads(USERS_FILE.read_text(encoding="utf-8"))
        return {username: _normalize_record(username, record) for username, record in data.items()}
    except Exception as exc:
        logging.error(f"Error al cargar usuarios: {exc}")
        raise HTTPException(status_code=500, detail="No se pudieron cargar los usuarios")


def save_users(users: Dict[str, dict]) -> None:
    USERS_FILE.write_text(json.dumps(users, indent=2), encoding="utf-8")


def _parse_expiration(raw_value: str | None) -> datetime | None:
    if not raw_value:
        return None

    try:
        return datetime.fromisoformat(raw_value)
    except ValueError:
        if raw_value.endswith("Z"):
            try:
                return datetime.fromisoformat(raw_value.replace("Z", "+00:00"))
            except ValueError:
                logging.warning("Formato de expiración inválido para usuario")
    return None


def _is_user_expired(user: dict) -> bool:
    expires_at = _parse_expiration(user.get("expires_at"))
    if not expires_at:
        return False

    # Asegura que la comparación entre fechas sea coherente incluso cuando
    # expires_at incluye información de zona horaria (p. ej. valores generados
    # desde el frontend con toISOString()).
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)
    return now > expires_at.astimezone(timezone.utc)


def authenticate_user(username: str, password: str):
    users = load_users()
    user = users.get(username)
    if not user:
        logging.warning(f"Intento de login fallido: usuario '{username}' no encontrado.")
        return None
    if not user.get("active", True):
        logging.warning(f"Intento de login fallido: cuenta desactivada para '{username}'.")
        raise HTTPException(status_code=403, detail="La cuenta está desactivada")
    if not verify_password(password, user["hashed_password"]):
        logging.warning(f"Intento de login fallido: contraseña incorrecta para '{username}'.")
        return None
    if _is_user_expired(user):
        logging.warning(f"Intento de login con cuenta expirada: '{username}'.")
        raise HTTPException(status_code=403, detail="La cuenta está expirada")
    logging.info(f"✅ Usuario autenticado: {username}")
    return user

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="El token ha expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = decode_access_token(credentials.credentials)
    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Token sin usuario válido")

    users = load_users()
    user = users.get(username)
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="La cuenta está desactivada")

    if _is_user_expired(user):
        raise HTTPException(status_code=403, detail="La cuenta está expirada")

    return user


def admin_required(current_user=Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Se requieren privilegios de administrador")
    return current_user


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=4)
    full_name: str | None = None
    role: Literal["admin", "user"] = "user"
    active: bool = True
    expires_at: datetime | None = None


class RoleUpdate(BaseModel):
    role: Literal["admin", "user"]


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[Literal["admin", "user"]] = None
    active: Optional[bool] = None
    expires_at: Optional[datetime] = None


class PasswordUpdate(BaseModel):
    password: str = Field(..., min_length=4)


# -----------------------------
# ENDPOINT: LOGIN
# -----------------------------
@router.post("/login")
async def login(request: Request):
    """
    Este endpoint acepta tanto JSON como FormData.
    """
    try:
        content_type = request.headers.get("content-type", "")
        username = None
        password = None

        if "application/json" in content_type:
            data = await request.json()
            username = data.get("username")
            password = data.get("password")

        elif "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
            form = await request.form()
            username = form.get("username")
            password = form.get("password")

        if not username or not password:
            raise HTTPException(status_code=400, detail="Faltan credenciales (username o password)")

        user = authenticate_user(username, password)
        if not user:
            raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={
                "sub": user["username"],
                "user": user.get("full_name") or user["username"],
                "role": user.get("role", "user"),
            },
            expires_delta=access_token_expires,
        )

        logging.info(f"🔐 Token generado para usuario: {username}")

        return {
            "access_token": access_token,
            "token": access_token,
            "token_type": "bearer",
            "user": user.get("full_name") or user["username"],
            "username": user["username"],
            "role": user.get("role", "user"),
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "status": "success",
            "message": f"Inicio de sesión exitoso para {user['username']}"
        }

    except HTTPException:
        # Reenvía las excepciones controladas (401, 400, etc.)
        raise
    except Exception as e:
        logging.error(f"❌ Error inesperado en /auth/login: {e}")
        raise HTTPException(status_code=500, detail="Error interno en el login")


# -----------------------------
# ENDPOINTS DE USUARIOS
# -----------------------------
@router.get("/users", dependencies=[Depends(admin_required)])
def list_users():
    users = load_users()
    sanitized = [
        {
            "username": user["username"],
            "full_name": user.get("full_name"),
            "role": user.get("role", "user"),
            "active": user.get("active", True),
            "created_at": user.get("created_at"),
            "expires_at": user.get("expires_at"),
        }
        for user in users.values()
    ]
    return {"users": sanitized}


@router.post("/users", dependencies=[Depends(admin_required)])
def create_user(user: UserCreate):
    users = load_users()
    if user.username in users:
        raise HTTPException(status_code=400, detail="El usuario ya existe")

    users[user.username] = {
        "username": user.username,
        "full_name": user.full_name or user.username,
        "hashed_password": hash_password(user.password),
        "role": user.role,
        "active": user.active,
        "created_at": datetime.utcnow().isoformat(),
        "expires_at": user.expires_at.isoformat() if user.expires_at else None,
    }
    save_users(users)
    return {"status": "success", "message": f"Usuario {user.username} creado"}


@router.put("/users/{username}", dependencies=[Depends(admin_required)])
def update_user(username: str, user_update: UserUpdate, current_user=Depends(get_current_user)):
    users = load_users()
    user = users.get(username)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if username == "admin" and current_user["username"] != "admin":
        raise HTTPException(status_code=403, detail="Solo el administrador principal puede editar su cuenta")

    if user_update.role and username == "admin" and user_update.role != "admin":
        raise HTTPException(status_code=400, detail="El rol del admin no puede modificarse")

    if user_update.full_name is not None:
        user["full_name"] = user_update.full_name
    if user_update.role is not None:
        user["role"] = user_update.role
    if user_update.active is not None:
        user["active"] = user_update.active
    if user_update.expires_at is not None:
        user["expires_at"] = user_update.expires_at.isoformat()

    users[username] = user
    save_users(users)
    return {"status": "success", "message": f"Usuario {username} actualizado"}


@router.post("/users/{username}/password", dependencies=[Depends(admin_required)])
def update_user_password(username: str, password_update: PasswordUpdate, current_user=Depends(get_current_user)):
    users = load_users()
    user = users.get(username)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if username == "admin" and current_user["username"] != "admin":
        raise HTTPException(status_code=403, detail="Solo el administrador principal puede cambiar su contraseña")

    if not user.get("active", True):
        raise HTTPException(status_code=400, detail="No se puede cambiar contraseña de un usuario desactivado")

    user["hashed_password"] = hash_password(password_update.password)
    users[username] = user
    save_users(users)
    return {"status": "success", "message": f"Contraseña de {username} actualizada"}


@router.delete("/users/{username}", dependencies=[Depends(admin_required)])
def delete_user(username: str):
    users = load_users()
    if username == "admin":
        raise HTTPException(status_code=400, detail="No se puede eliminar al administrador principal")

    if username not in users:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    users.pop(username)
    save_users(users)
    return {"status": "success", "message": f"Usuario {username} eliminado"}


@router.get("/me")
def get_profile(current_user=Depends(get_current_user)):
    return {
        "username": current_user["username"],
        "full_name": current_user.get("full_name"),
        "role": current_user.get("role", "user"),
    }


# -----------------------------
# ENDPOINT DE PRUEBA
# -----------------------------
@router.get("/check")
def check_status():
    return {
        "status": "ok",
        "message": "Ruta /auth activa y funcional",
        "algorithm": ALGORITHM,
        "expires_in_minutes": ACCESS_TOKEN_EXPIRE_MINUTES
    }
