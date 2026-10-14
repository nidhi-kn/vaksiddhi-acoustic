"""Local API; model and preprocessing remain owned by demo.inference."""
from contextlib import asynccontextmanager
import logging
import os
from urllib.parse import urlsplit
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Lock
from time import perf_counter

import soundfile as sf
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from demo.inference import AcousticAnalyzer, AudioInputError

MAX_BYTES = 20 * 1024 * 1024
MAX_SECONDS = 120
lock = Lock()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app):
    app.state.analyzer = None
    try:
        app.state.analyzer = await run_in_threadpool(AcousticAnalyzer)
    except Exception:
        logger.exception("Model initialization failed")
    yield
    app.state.analyzer = None


def cors_origins():
    origins = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:5174", "http://127.0.0.1:5174",
    ]
    for origin in os.getenv("CORS_ORIGINS", "").split(","):
        origin = origin.strip()
        if not origin:
            continue
        parts = urlsplit(origin)
        if parts.scheme not in ("http", "https") or not parts.netloc or "*" in origin or parts.path or parts.query or parts.fragment or parts.username or parts.password:
            raise ValueError("CORS_ORIGINS must contain exact http(s) origins without paths or trailing slashes")
        origins.append(origin)
    return list(dict.fromkeys(origins))


app = FastAPI(title="Vak-Siddhi Acoustic API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=cors_origins(), allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


@app.get("/api/health")
def health():
    ready = getattr(app.state, "analyzer", None) is not None
    return {"status": "ready" if ready else "unavailable", "model_loaded": ready}


@app.get("/api/ready")
def readiness():
    status = health()
    return JSONResponse(status, status_code=200 if status["model_loaded"] else 503)


def analyze_path(path):
    try:
        try:
            info = sf.info(path)
        except (sf.LibsndfileError, ValueError) as exc:
            raise AudioInputError("Could not decode WAV audio.") from exc
        if info.format not in ("WAV", "WAVEX"):
            raise AudioInputError("The uploaded content must be WAV audio.")
        if info.frames <= 0 or info.duration > MAX_SECONDS or info.channels > 8:
            raise AudioInputError("Use non-empty WAV audio up to 120 seconds and 8 channels.")
        with lock:
            return app.state.analyzer.analyze(path)
    except (AudioInputError, RuntimeError) as exc:
        if isinstance(exc, AudioInputError):
            raise HTTPException(422, str(exc)) from exc
        raise


@app.post("/api/analyze")
async def analyze(file: UploadFile):
    try:
        if not file.filename or not file.filename.lower().endswith(".wav"):
            raise HTTPException(415, "Select a WAV file.")
        if getattr(app.state, "analyzer", None) is None:
            raise HTTPException(503, "Model unavailable. Check backend startup logs.")
        with TemporaryDirectory(prefix="vaksiddhi-") as directory:
            path = Path(directory) / "recording.wav"
            size = 0
            with path.open("wb") as output:
                while chunk := await file.read(65536):
                    size += len(chunk)
                    if size > MAX_BYTES:
                        raise HTTPException(413, "WAV must be 20 MiB or smaller.")
                    output.write(chunk)
            if not size:
                raise HTTPException(422, "Audio file is empty.")
            started = perf_counter()
            try:
                result = await run_in_threadpool(analyze_path, path)
            except HTTPException:
                raise
            except Exception as exc:
                logger.exception("Audio analysis failed")
                raise HTTPException(500, "Inference failed. Check backend logs and retry.") from exc
            result["audio_file"] = Path(file.filename.replace("\\", "/")).name
            result["processing_ms"] = round((perf_counter() - started) * 1000)
            result["acoustic"].pop("checkpoint", None)
            return result
    finally:
        await file.close()
