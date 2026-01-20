import logging
import os
from urllib.parse import urlparse

from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")
FORCE_SQLITE = os.getenv("FORCE_SQLITE", "false").lower() in {"1", "true", "yes"}

def _create_sqlite_engine():
    return create_engine(
        "sqlite:///./informebf_local.db",
        connect_args={"check_same_thread": False},
    )


def _create_database_engine():
    if not DATABASE_URL or FORCE_SQLITE:
        if FORCE_SQLITE:
            logging.warning("FORCE_SQLITE habilitado: usando SQLite local temporalmente.")
        return _create_sqlite_engine()

    # Render entrega DATABASE_URL con el esquema legacy "postgres://" y, en algunos
    # casos, sin el parámetro sslmode. SQLAlchemy requiere el esquema moderno y el
    # motor de Render exige SSL, por lo que normalizamos ambos aquí.
    normalized_url = DATABASE_URL
    if normalized_url.startswith("postgres://"):
        normalized_url = normalized_url.replace("postgres://", "postgresql://", 1)

    connect_args = {}
    parsed = urlparse(normalized_url)
    if parsed.scheme.startswith("postgresql") and "sslmode=" not in (parsed.query or ""):
        connect_args["sslmode"] = "require"

    engine = create_engine(normalized_url, connect_args=connect_args or {})

    try:
        with engine.connect():
            pass
    except OperationalError as exc:
        logging.error("No se pudo conectar a la base de datos remota: %s", exc)
        logging.warning("Usando SQLite local temporalmente para pruebas.")
        return _create_sqlite_engine()

    return engine


engine = _create_database_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
