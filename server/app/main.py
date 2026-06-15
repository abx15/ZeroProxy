import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime

from app.config import settings
from app.database import test_connection, Base, engine
from app.routers import health, face_register, face_verify, liveness
from app.services.face_service import face_service
from app.services.liveness_service import liveness_service

# ─── Lifespan (startup + shutdown) ───────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("ZeroProxy AI Service starting...")

    # Test DB connection
    test_connection()

    # Create tables if not exist
    Base.metadata.create_all(bind=engine)
    print("Database tables verified")

    # Load InsightFace model
    try:
        face_service.load_model()
    except Exception as e:
        print(f"Face model loading failed: {e}")
        print("   Service will start but face endpoints won't work until model loads.")

    # Load MediaPipe Liveness model
    try:
        liveness_service.load_model()
    except Exception as e:
        print(f"Liveness model loading failed: {e}")

    yield

    # Shutdown
    print("ZeroProxy AI Service shutting down...")

# ─── FastAPI App ──────────────────────────────────────────
app = FastAPI(
    title="ZeroProxy AI Service",
    description="Face Recognition + Liveness Detection API for ZeroProxy",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:3000", "http://localhost:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Request ID Middleware ────────────────────────────────
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

# ─── Global Exception Handler ────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "Internal server error",
            "detail": str(exc) if settings.ENVIRONMENT == "development" else None,
            "timestamp": datetime.utcnow().isoformat(),
        },
    )

# ─── Routers ─────────────────────────────────────────────
app.include_router(health.router)
app.include_router(face_register.router)
app.include_router(face_verify.router)
app.include_router(liveness.router)

# ─── Root ─────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "service": "ZeroProxy AI Service",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "health": "/health",
    }
# Reload trigger
