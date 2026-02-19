from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from api_clients.openai_client import OpenAIShortsClient
from api_clients.youtube_client import YouTubeUploadClient
from database.db import Base, db_session, engine
from database.models import Credential, VideoJob
from services.security_service import decrypt_value, encrypt_value
from services.tts_service import TTSService
from video_engine.shorts_builder import build_vertical_video, extract_keywords

app = FastAPI(title="YouTube Shorts Autopublisher")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)
Path("temp_media").mkdir(parents=True, exist_ok=True)
app.mount("/temp_media", StaticFiles(directory="temp_media"), name="temp_media")


class ConfigPayload(BaseModel):
    youtube_client_secret: str | None = None
    youtube_refresh_token: str | None = None
    openai_api_key: str | None = None
    tts_provider: str = Field(default="openai")
    tts_api_key: str | None = None
    pexels_api_key: str | None = None
    pixabay_api_key: str | None = None


class TopicPayload(BaseModel):
    topic: str | None = None


class CreateVideoPayload(BaseModel):
    topic: str


class UploadPayload(BaseModel):
    visibility: str = "private"


def _credential_record() -> Credential:
    with db_session() as db:
        rec = db.query(Credential).filter(Credential.id == 1).first()
        if not rec:
            rec = Credential(id=1)
            db.add(rec)
            db.flush()
        db.expunge(rec)
        return rec


def _get_openai_client() -> OpenAIShortsClient:
    cred = _credential_record()
    return OpenAIShortsClient(decrypt_value(cred.openai_api_key))


@app.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.post("/api/config")
def save_config(payload: ConfigPayload):
    with db_session() as db:
        rec = db.query(Credential).filter(Credential.id == 1).first() or Credential(id=1)
        rec.youtube_client_secret = encrypt_value(payload.youtube_client_secret)
        rec.youtube_refresh_token = encrypt_value(payload.youtube_refresh_token)
        rec.openai_api_key = encrypt_value(payload.openai_api_key)
        rec.tts_provider = payload.tts_provider
        rec.tts_api_key = encrypt_value(payload.tts_api_key)
        rec.pexels_api_key = encrypt_value(payload.pexels_api_key)
        rec.pixabay_api_key = encrypt_value(payload.pixabay_api_key)
        rec.updated_at = datetime.utcnow()
        db.add(rec)
    return {"saved": True}


@app.get("/api/config/status")
def config_status():
    cred = _credential_record()
    return {
        "youtube_configured": bool(cred.youtube_refresh_token),
        "openai_configured": bool(cred.openai_api_key),
        "tts_provider": cred.tts_provider,
    }


@app.post("/api/config/test")
def test_connections():
    client = _get_openai_client()
    topic = client.random_topic()
    return {"openai": bool(topic), "sample_topic": topic}


@app.post("/api/topic/random")
def random_topic():
    topic = _get_openai_client().random_topic()
    return {"topic": topic}


def _run_generation(job_id: int):
    with db_session() as db:
        job = db.query(VideoJob).filter(VideoJob.id == job_id).first()
        if not job:
            return
        try:
            job.status = "processing"
            db.flush()

            client = _get_openai_client()
            script = client.generate_script(job.topic)
            metadata = client.generate_metadata(script)

            with db_session() as cred_db:
                cred = cred_db.query(Credential).filter(Credential.id == 1).first()
                tts = TTSService(
                    provider=cred.tts_provider if cred else "openai",
                    api_key=decrypt_value(cred.tts_api_key) if cred else None,
                )

            audio_path = f"temp_media/job_{job_id}.mp3"
            video_path = f"temp_media/job_{job_id}.mp4"
            tts.synthesize_to_mp3(script, audio_path)
            build_vertical_video(script, audio_path, video_path)

            job.script = script
            job.title = metadata.get("title", "AI Shorts")
            job.description = metadata.get("description", script)
            job.hashtags = " ".join(metadata.get("hashtags", ["#Shorts"]))
            job.audio_path = audio_path
            job.video_path = video_path
            job.status = "completed"
        except Exception as exc:
            job.status = "failed"
            job.error_message = str(exc)


@app.post("/api/video/create")
def create_video(payload: CreateVideoPayload, background_tasks: BackgroundTasks):
    if len(payload.topic.strip()) < 3:
        raise HTTPException(status_code=400, detail="Topic must be at least 3 characters")

    with db_session() as db:
        job = VideoJob(topic=payload.topic.strip(), status="queued")
        db.add(job)
        db.flush()
        job_id = job.id

    background_tasks.add_task(_run_generation, job_id)
    return {"job_id": job_id, "status": "queued"}


@app.get("/api/video/{job_id}")
def get_video(job_id: int):
    with db_session() as db:
        job = db.query(VideoJob).filter(VideoJob.id == job_id).first()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return {
            "id": job.id,
            "topic": job.topic,
            "status": job.status,
            "script": job.script,
            "title": job.title,
            "description": job.description,
            "hashtags": job.hashtags,
            "keywords": extract_keywords(job.script or ""),
            "video_path": job.video_path,
            "error_message": job.error_message,
        }


@app.post("/api/video/{job_id}/publish")
def publish_to_youtube(job_id: int, payload: UploadPayload):
    with db_session() as db:
        job = db.query(VideoJob).filter(VideoJob.id == job_id).first()
        cred = db.query(Credential).filter(Credential.id == 1).first()
        if not job or not job.video_path:
            raise HTTPException(status_code=404, detail="Video not ready")

    yt = YouTubeUploadClient(decrypt_value(cred.youtube_refresh_token) if cred else None)
    result = yt.upload_short(
        video_path=job.video_path,
        title=job.title or "AI Shorts",
        description=f"{job.description or ''}\n\n{job.hashtags or '#Shorts'}",
        tags=["shorts", "education", "ai"],
        privacy_status=payload.visibility,
    )
    return {"published": True, **result}


@app.get("/api/history")
def history():
    with db_session() as db:
        jobs = db.query(VideoJob).order_by(VideoJob.created_at.desc()).limit(20).all()
        return [
            {
                "id": j.id,
                "topic": j.topic,
                "status": j.status,
                "created_at": j.created_at.isoformat(),
            }
            for j in jobs
        ]


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=True)
