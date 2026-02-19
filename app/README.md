# YouTube Shorts Auto Publisher

FastAPI backend + React frontend workflow to generate, preview, and publish YouTube Shorts.

## Features
- Secure credential storage (Fernet encryption at rest).
- Topic + script + metadata generation with OpenAI.
- TTS pipeline (provider abstraction with local fallback).
- 9:16 MP4 generation (MoviePy + FFmpeg) with subtitles.
- YouTube upload endpoint.
- SQLite persistence (PostgreSQL-ready via `SHORTS_DATABASE_URL`).

## Run
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 10000
```

Frontend route:
- `http://localhost:5173/shorts-studio`
