from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
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
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    api_usage = relationship("ApiUsage", back_populates="user", cascade="all, delete-orphan")


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
