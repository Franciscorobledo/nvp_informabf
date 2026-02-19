from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Credential(Base):
    __tablename__ = "shorts_credentials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    youtube_client_secret: Mapped[str | None] = mapped_column(Text, nullable=True)
    youtube_refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    openai_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    tts_provider: Mapped[str] = mapped_column(String(32), default="openai")
    tts_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    pexels_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    pixabay_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class VideoJob(Base):
    __tablename__ = "shorts_video_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    topic: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32), default="queued")
    script: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    hashtags: Mapped[str | None] = mapped_column(String(255), nullable=True)
    video_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    audio_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
