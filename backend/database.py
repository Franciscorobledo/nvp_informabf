import os
from urllib.parse import urlparse

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")

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
else:
    engine = create_engine(
        "sqlite:///./informebf_local.db",
        connect_args={"check_same_thread": False},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
