from datetime import datetime, timedelta, timezone
import hashlib
import logging
import os
from typing import Literal, Optional

import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models import DeletedUser, User

# -----------------------------
# CONFIGURACIÓN
# -----------------------------
load_dotenv()

router = APIRouter()

SECRET_KEY = os.getenv("SECRET_KEY", "DEV_SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))
DEFAULT_ADMIN_PASSWORD = os.getenv("DEFAULT_ADMIN_PASSWORD", "Francisco8")

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


def ensure_default_admin(db: Session) -> None:
    existing = db.query(User).count()
    if existing:
        return

    logging.info("Creando usuario administrador por defecto")
    admin = User(
        username="admin",
        full_name="Administrador del Sistema",
        hashed_password=hash_password(DEFAULT_ADMIN_PASSWORD),
        role="admin",
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db.add(admin)
    db.commit()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def list_users(db: Session) -> list[User]:
    return db.query(User).order_by(User.username).all()


def create_user(db: Session, user: "UserCreate") -> User:
    if get_user_by_username(db, user.username):
        raise HTTPException(status_code=400, detail="El usuario ya existe")

    db_user = User(
        username=user.username,
        full_name=user.full_name or user.username,
        hashed_password=hash_password(user.password),
        role=user.role,
        is_active=user.active,
        expires_at=user.expires_at,
        created_at=datetime.utcnow(),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user_record(db: Session, target: User, user_update: "UserUpdate", actor: User) -> User:
    if target.username == "admin" and actor.username != "admin":
        raise HTTPException(status_code=403, detail="Solo el administrador principal puede editar su cuenta")

    if user_update.role and target.username == "admin" and user_update.role != "admin":
        raise HTTPException(status_code=400, detail="El rol del admin no puede modificarse")

    if user_update.full_name is not None:
        target.full_name = user_update.full_name
    if user_update.role is not None:
        target.role = user_update.role
    if user_update.active is not None:
        target.is_active = user_update.active
    if user_update.expires_at is not None:
        target.expires_at = user_update.expires_at

    db.add(target)
    db.commit()
    db.refresh(target)
    return target


def delete_user_record(db: Session, target: User, actor: User) -> None:
    if target.username == "admin":
        raise HTTPException(status_code=400, detail="No se puede eliminar al administrador principal")

    snapshot = {
        "username": target.username,
        "full_name": target.full_name,
        "role": target.role,
        "created_at": target.created_at,
        "expires_at": target.expires_at,
    }

    db.delete(target)
    db.commit()

    deleted = DeletedUser(
        **snapshot,
        deleted_at=datetime.utcnow(),
        deleted_by=actor.username,
    )
    db.add(deleted)
    db.commit()


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


def _is_user_expired(user: User) -> bool:
    if not user.expires_at:
        return False

    expires_at = user.expires_at

    # Algunas importaciones históricas guardaron la fecha como str, lo que rompía el login
    # de usuarios no-admin al evaluar tzinfo. Normalizamos antes de comparar.
    if isinstance(expires_at, str):
        parsed = _parse_expiration(expires_at)
        if not parsed:
            logging.warning("Formato de expiración inválido para usuario %s", user.username)
            return False
        expires_at = parsed

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)
    return now > expires_at.astimezone(timezone.utc)


def _get_user_status(db: Session, username: str) -> dict:
    user = get_user_by_username(db, username)
    if user:
        if _is_user_expired(user):
            status = "expired"
        elif not user.is_active:
            status = "inactive"
        else:
            status = "active"

        return {
            "status": status,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
            "active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "expires_at": user.expires_at.isoformat() if user.expires_at else None,
            "message": "Cuenta vigente" if status == "active" else "Cuenta no usable sin intervención",
        }

    deleted_entry = (
        db.query(DeletedUser)
        .filter(DeletedUser.username == username)
        .order_by(DeletedUser.deleted_at.desc())
        .first()
    )
    if deleted_entry:
        return {
            "status": "deleted",
            "username": deleted_entry.username,
            "full_name": deleted_entry.full_name,
            "role": deleted_entry.role,
            "deleted_at": deleted_entry.deleted_at.isoformat() if deleted_entry.deleted_at else None,
            "deleted_by": deleted_entry.deleted_by,
            "created_at": deleted_entry.created_at.isoformat() if deleted_entry.created_at else None,
            "expires_at": deleted_entry.expires_at.isoformat() if deleted_entry.expires_at else None,
            "message": "Registro encontrado en historial de eliminaciones",
        }

    return {
        "status": "missing",
        "username": username,
        "message": "No se encontró la cuenta ni historial de eliminación",
    }


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    user = get_user_by_username(db, username)
    if not user:
        logging.warning("Intento de login fallido: usuario '%s' no encontrado.", username)
        return None
    if not user.is_active:
        logging.warning("Intento de login fallido: cuenta desactivada para '%s'.", username)
        raise HTTPException(status_code=403, detail="La cuenta está desactivada")
    if not verify_password(password, user.hashed_password):
        logging.warning("Intento de login fallido: contraseña incorrecta para '%s'.", username)
        return None
    if _is_user_expired(user):
        logging.warning("Intento de login con cuenta expirada: '%s'.", username)
        raise HTTPException(status_code=403, detail="La cuenta está expirada")
    logging.info("✅ Usuario autenticado: %s", username)
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
        raise HTTPException(
            status_code=401,
            detail="El token ha expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail="Token inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    payload = decode_access_token(credentials.credentials)
    username = payload.get("sub")
    if not username:
        raise HTTPException(
            status_code=401,
            detail="Token sin usuario válido",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user_by_username(db, username)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Usuario no encontrado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="La cuenta está desactivada")

    if _is_user_expired(user):
        raise HTTPException(status_code=403, detail="La cuenta está expirada")

    return user


def admin_required(current_user=Depends(get_current_user)):
    if current_user.role != "admin":
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
async def login(request: Request, db: Session = Depends(get_db)):
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

        user = authenticate_user(db, username, password)
        if not user:
            raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={
                "sub": user.username,
                "user": user.full_name or user.username,
                "role": user.role,
            },
            expires_delta=access_token_expires,
        )

        logging.info("🔐 Token generado para usuario: %s", username)

        return {
            "access_token": access_token,
            "token": access_token,
            "token_type": "bearer",
            "user": user.full_name or user.username,
            "username": user.username,
            "role": user.role,
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            "status": "success",
            "message": f"Inicio de sesión exitoso para {user.username}",
        }

    except HTTPException:
        raise
    except Exception as e:
        logging.error("❌ Error inesperado en /auth/login: %s", e)
        raise HTTPException(status_code=500, detail="Error interno en el login")


# -----------------------------
# ENDPOINTS DE USUARIOS
# -----------------------------
@router.get("/users", dependencies=[Depends(admin_required)])
def list_users_endpoint(db: Session = Depends(get_db)):
    users = list_users(db)
    sanitized = [
        {
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
            "active": user.is_active,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "expires_at": user.expires_at.isoformat() if user.expires_at else None,
        }
        for user in users
    ]
    return {"users": sanitized}


@router.get("/users/{username}/status", dependencies=[Depends(admin_required)])
def get_user_status(username: str, db: Session = Depends(get_db)):
    """Permite validar rápidamente si un usuario fue eliminado o solo está inactivo."""
    return _get_user_status(db, username)


@router.post("/users", dependencies=[Depends(admin_required)])
def create_user_endpoint(user: UserCreate, db: Session = Depends(get_db)):
    created = create_user(db, user)
    return {"status": "success", "message": f"Usuario {created.username} creado"}


@router.put("/users/{username}", dependencies=[Depends(admin_required)])
def update_user_endpoint(
    username: str,
    user_update: UserUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = get_user_by_username(db, username)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    update_user_record(db, user, user_update, current_user)
    return {"status": "success", "message": f"Usuario {username} actualizado"}


@router.post("/users/{username}/password", dependencies=[Depends(admin_required)])
def update_user_password(
    username: str,
    password_update: PasswordUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user = get_user_by_username(db, username)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if username == "admin" and current_user.username != "admin":
        raise HTTPException(status_code=403, detail="Solo el administrador principal puede cambiar su contraseña")

    if not user.is_active:
        raise HTTPException(status_code=400, detail="No se puede cambiar contraseña de un usuario desactivado")

    user.hashed_password = hash_password(password_update.password)
    db.add(user)
    db.commit()
    return {"status": "success", "message": f"Contraseña de {username} actualizada"}


@router.delete("/users/{username}", dependencies=[Depends(admin_required)])
def delete_user(username: str, current_user=Depends(admin_required), db: Session = Depends(get_db)):
    user = get_user_by_username(db, username)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    delete_user_record(db, user, current_user)
    return {"status": "success", "message": f"Usuario {username} eliminado"}


@router.get("/users/deleted", dependencies=[Depends(admin_required)])
def list_deleted_users(db: Session = Depends(get_db)):
    deleted_users = (
        db.query(DeletedUser)
        .order_by(DeletedUser.deleted_at.desc())
        .all()
    )
    return {
        "deleted_users": [
            {
                "username": entry.username,
                "full_name": entry.full_name,
                "role": entry.role,
                "active": False,
                "created_at": entry.created_at.isoformat() if entry.created_at else None,
                "expires_at": entry.expires_at.isoformat() if entry.expires_at else None,
                "deleted_at": entry.deleted_at.isoformat() if entry.deleted_at else None,
                "deleted_by": entry.deleted_by,
            }
            for entry in deleted_users
        ]
    }


@router.get("/me")
def get_profile(current_user=Depends(get_current_user)):
    return {
        "username": current_user.username,
        "full_name": current_user.full_name,
        "role": current_user.role,
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
