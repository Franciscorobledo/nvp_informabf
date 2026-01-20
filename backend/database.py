import logging
import os
from urllib.parse import urlparse

from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")
LOCAL_DATABASE_URL = os.getenv("LOCAL_DATABASE_URL", "sqlite:///./informebf_local.db")
ENABLE_SQLITE_FALLBACK = os.getenv("ENABLE_SQLITE_FALLBACK", "true").lower() in {
    "1",
    "true",
    "yes",
    "on",
}
USING_SQLITE_FALLBACK = False


def _create_sqlite_engine():
    return create_engine(
        LOCAL_DATABASE_URL,
        connect_args={"check_same_thread": False},
    )

if DATABASE_URL:
    # Render entrega DATABASE_URL con el esquema legacy "postgres://" y, en algunos
    # casos, sin el parámetro sslmode. SQLAlchemy requiere el esquema moderno y el
    # motor de Render exige SSL, por lo que normalizamos ambos aquí.
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

    connect_args = {}
    parsed = urlparse(DATABASE_URL)
    if parsed.scheme.startswith("postgresql") and "sslmode=" not in (parsed.query or ""):
        connect_args["sslmode"] = "require"

    engine = create_engine(DATABASE_URL, connect_args=connect_args or {})
    if ENABLE_SQLITE_FALLBACK:
        try:
            with engine.connect():
                pass
        except OperationalError:
            logging.warning(
                "No se pudo conectar a la base de datos remota. "
                "Usando base local temporal (%s).",
                LOCAL_DATABASE_URL,
            )
            engine = _create_sqlite_engine()
            USING_SQLITE_FALLBACK = True
else:
    # Sin DATABASE_URL usamos SQLite local para permitir arranque sin base remota.
    engine = _create_sqlite_engine()
    USING_SQLITE_FALLBACK = True

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
