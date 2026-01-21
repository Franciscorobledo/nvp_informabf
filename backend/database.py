import logging
import os
from urllib.parse import urlparse

from sqlalchemy import create_engine, inspect, text
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


def ensure_schema() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

    if "users" not in table_names:
        Base.metadata.create_all(bind=engine)
        return

    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    columns_to_add = {
        "full_name": "VARCHAR",
        "role": "VARCHAR",
        "is_active": "BOOLEAN",
        "subscription_status": "VARCHAR",
        "current_plan_id": "INTEGER",
        "expires_at": "TIMESTAMP",
        "created_at": "TIMESTAMP",
    }

    with engine.begin() as connection:
        for column, column_type in columns_to_add.items():
            if column in existing_columns:
                continue
            if engine.dialect.name == "postgresql":
                statement = (
                    f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {column} {column_type}"
                )
            else:
                statement = f"ALTER TABLE users ADD COLUMN {column} {column_type}"
            logging.warning("Agregando columna faltante users.%s", column)
            connection.execute(text(statement))

        if "role" in existing_columns or "role" in columns_to_add:
            connection.execute(
                text("UPDATE users SET role = 'user' WHERE role IS NULL")
            )
        if "is_active" in existing_columns or "is_active" in columns_to_add:
            connection.execute(
                text("UPDATE users SET is_active = 1 WHERE is_active IS NULL")
            )
        if "subscription_status" in existing_columns or "subscription_status" in columns_to_add:
            connection.execute(
                text("UPDATE users SET subscription_status = 'none' WHERE subscription_status IS NULL")
            )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
