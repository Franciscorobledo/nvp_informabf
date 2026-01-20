from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    LargeBinary,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="user", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    subscription_status = Column(String, default="none", nullable=False)
    current_plan_id = Column(
        Integer, ForeignKey("subscription_plans.id", ondelete="SET NULL"), nullable=True
    )
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    api_usage = relationship("ApiUsage", back_populates="user", cascade="all, delete-orphan")
    mercadolibre_credentials = relationship(
        "MercadoLibreCredential",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    ml_connections = relationship(
        "MLUserConnection",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    subscriptions = relationship(
        "Subscription",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="Subscription.created_at.desc()",
    )
    current_plan = relationship(
        "SubscriptionPlan",
        foreign_keys=[current_plan_id],
        back_populates="users",
    )


class DeletedUser(Base):
    __tablename__ = "deleted_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    role = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    deleted_by = Column(String, nullable=True)


class ApiUsage(Base):
    __tablename__ = "api_usage"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    username = Column(String, nullable=True, index=True)
    model = Column(String, nullable=True)
    action = Column(String, nullable=True)
    prompt_tokens = Column(Integer, default=0, nullable=False)
    completion_tokens = Column(Integer, default=0, nullable=False)
    total_tokens = Column(Integer, default=0, nullable=False)
    cost_usd = Column(Float, default=0.0, nullable=False)
    source = Column(String, nullable=True)
    files = Column(
        JSONB().with_variant(SQLiteJSON, "sqlite"),
        nullable=True,
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="api_usage")

    @property
    def owner(self) -> Optional[str]:
        if self.user:
            return self.user.username
        return self.username


class MercadoLibreCredential(Base):
    __tablename__ = "mercadolibre_credentials"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_name = Column(String, default="Principal", nullable=False)
    client_id = Column(String, nullable=False)
    client_secret_encrypted = Column(String, nullable=False)
    redirect_uri = Column(String, nullable=False)
    country_code = Column(String, nullable=False)
    webhook_url = Column(String, nullable=True)
    seller_id = Column(String, nullable=True)
    nickname = Column(String, nullable=True)
    access_token_encrypted = Column(String, nullable=True)
    refresh_token_encrypted = Column(String, nullable=True)
    access_token_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="mercadolibre_credentials")


class MLApp(Base):
    __tablename__ = "ml_apps"

    id = Column(Integer, primary_key=True, index=True)
    alias = Column(String, unique=True, nullable=False)
    site_id = Column(String, nullable=False)
    client_id = Column(String, nullable=False)
    client_secret_encrypted = Column(String, nullable=False)
    redirect_uri = Column(String, nullable=False)
    webhook_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    connections = relationship(
        "MLUserConnection",
        back_populates="app",
        cascade="all, delete-orphan",
    )


class MLUserConnection(Base):
    __tablename__ = "ml_user_connections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    app_id = Column(Integer, ForeignKey("ml_apps.id", ondelete="CASCADE"), nullable=False)
    seller_id = Column(String, nullable=True)
    nickname = Column(String, nullable=True)
    access_token_encrypted = Column(String, nullable=True)
    refresh_token_encrypted = Column(String, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    app = relationship("MLApp", back_populates="connections")
    user = relationship("User", back_populates="ml_connections")


class AppLog(Base):
    __tablename__ = "app_logs"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    source = Column(String(50), default="backend", nullable=False, index=True)
    level = Column(String(20), default="INFO", nullable=False, index=True)
    message = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    user = Column(String, nullable=True)
    path = Column(String, nullable=True)


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    alias = Column(String, unique=True, nullable=False, index=True)
    price_monthly = Column(Float, nullable=False)
    currency = Column(String, default="CLP", nullable=False)
    description = Column(Text, nullable=True)
    features = Column(
        JSONB().with_variant(SQLiteJSON, "sqlite"),
        nullable=True,
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    subscriptions = relationship("Subscription", back_populates="plan")
    users = relationship("User", back_populates="current_plan")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plan_id = Column(Integer, ForeignKey("subscription_plans.id", ondelete="SET NULL"), nullable=True)
    status = Column(String, default="pending", nullable=False)
    provider = Column(String, default="mercadopago", nullable=False)
    mp_preapproval_id = Column(String, nullable=True)
    mp_init_point = Column(String, nullable=True)
    started_at = Column(DateTime, nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="subscriptions")
    plan = relationship("SubscriptionPlan", back_populates="subscriptions")


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    contact_email = Column(String, nullable=True)
    timezone = Column(String, default="UTC", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    bots = relationship("Bot", back_populates="client", cascade="all, delete-orphan")
    reservations = relationship(
        "Reservation",
        back_populates="client",
        cascade="all, delete-orphan",
    )


class Bot(Base):
    __tablename__ = "bots"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    system_prompt = Column(Text, nullable=False)
    slack_channel_id = Column(String, nullable=False, index=True)
    slack_team_id = Column(String, nullable=True, index=True)
    slack_bot_user_id = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    openai_model = Column(String, default="gpt-4o-mini", nullable=False)
    openai_temperature = Column(Float, default=0.2, nullable=False)
    google_calendar_id = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    client = relationship("Client", back_populates="bots")
    services = relationship("Service", back_populates="bot", cascade="all, delete-orphan")
    reservations = relationship("Reservation", back_populates="bot", cascade="all, delete-orphan")
    conversation_states = relationship(
        "ConversationState",
        back_populates="bot",
        cascade="all, delete-orphan",
    )
    slack_events = relationship(
        "SlackEventLog",
        back_populates="bot",
        cascade="all, delete-orphan",
    )


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    bot_id = Column(Integer, ForeignKey("bots.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    bot = relationship("Bot", back_populates="services")
    reservations = relationship("Reservation", back_populates="service")


class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    bot_id = Column(Integer, ForeignKey("bots.id", ondelete="CASCADE"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="SET NULL"), nullable=True)
    slack_user_id = Column(String, nullable=False)
    slack_channel_id = Column(String, nullable=False)
    customer_name = Column(String, nullable=True)
    status = Column(String, default="confirmed", nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    google_event_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    client = relationship("Client", back_populates="reservations")
    bot = relationship("Bot", back_populates="reservations")
    service = relationship("Service", back_populates="reservations")


class ConversationState(Base):
    __tablename__ = "conversation_states"

    id = Column(Integer, primary_key=True, index=True)
    bot_id = Column(Integer, ForeignKey("bots.id", ondelete="CASCADE"), nullable=False)
    slack_user_id = Column(String, nullable=False, index=True)
    state = Column(String, default="idle", nullable=False)
    collected_data = Column(
        JSONB().with_variant(SQLiteJSON, "sqlite"),
        nullable=True,
    )
    last_message_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    bot = relationship("Bot", back_populates="conversation_states")


class SlackEventLog(Base):
    __tablename__ = "slack_event_logs"

    id = Column(Integer, primary_key=True, index=True)
    bot_id = Column(Integer, ForeignKey("bots.id", ondelete="SET NULL"), nullable=True)
    event_id = Column(String, nullable=True, index=True)
    event_type = Column(String, nullable=True)
    payload = Column(
        JSONB().with_variant(SQLiteJSON, "sqlite"),
        nullable=True,
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    bot = relationship("Bot", back_populates="slack_events")


class UserSalesDataset(Base):
    __tablename__ = "user_sales_datasets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    dataframe_parquet = Column(LargeBinary, nullable=False)
    column_mapping_json = Column(
        JSONB().with_variant(SQLiteJSON, "sqlite"), nullable=True
    )
    source = Column(String, default="files", nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class UserStockDataset(Base):
    __tablename__ = "user_stock_datasets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    dataframe_parquet = Column(LargeBinary, nullable=False)
    column_mapping_json = Column(
        JSONB().with_variant(SQLiteJSON, "sqlite"), nullable=True
    )
    source = Column(String, default="files", nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
