from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from app.database import get_db
from app.schemas.face import HealthResponse
from app.config import settings
from app.services.face_service import face_service
from app.services.liveness_service import liveness_service

router = APIRouter(prefix="/health", tags=["Health"])

@router.get("", response_model=HealthResponse)
async def health_check(db: Session = Depends(get_db)):
    # Check DB connection
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "disconnected"

    both_models_loaded = face_service.is_loaded() and liveness_service.is_loaded()

    return HealthResponse(
        status="ok" if db_status == "connected" else "degraded",
        service="ZeroProxy AI Service",
        version="1.0.0",
        environment=settings.ENVIRONMENT,
        database=db_status,
        models_loaded=both_models_loaded,
        timestamp=datetime.utcnow().isoformat(),
    )

@router.get("/ping")
async def ping():
    return {"pong": True, "timestamp": datetime.utcnow().isoformat()}
