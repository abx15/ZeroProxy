import uuid
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app.utils.auth import verify_internal_key
from app.schemas.face import FaceRegisterRequest, FaceRegisterResponse
from app.services.face_service import face_service
from app.models.face_embedding import FaceEmbedding
from app.utils.image_utils import decode_base64_image, validate_image_size

router = APIRouter(prefix="/face", tags=["Face Registration"])


@router.post("/register", response_model=FaceRegisterResponse)
async def register_face(
    request: FaceRegisterRequest,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_internal_key),
):
    """
    Register employee face.
    - Accepts base64 image
    - Detects face using InsightFace
    - Generates 512-dim embedding
    - Saves to PostgreSQL
    - Handles re-registration (update existing)
    """

    # 1. Decode base64 image to numpy array
    img_array = decode_base64_image(request.image_base64)

    # 2. Validate image dimensions
    validate_image_size(img_array, min_width=112, min_height=112)

    # 3. Get face embedding
    embedding, quality_score = face_service.get_embedding(img_array)

    # 4. Check if user already has a registered face
    existing = db.query(FaceEmbedding).filter(
        FaceEmbedding.user_id == request.user_id
    ).first()

    if existing:
        # UPDATE existing embedding
        existing.embedding = face_service.embedding_to_list(embedding)
        existing.quality_score = quality_score
        existing.is_active = True
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)

        return FaceRegisterResponse(
            success=True,
            message="Face re-registered successfully.",
            user_id=request.user_id,
            quality_score=round(quality_score, 4),
            registered_at=existing.registered_at.isoformat(),
        )

    # 5. Create new embedding record
    new_embedding = FaceEmbedding(
        id=str(uuid.uuid4()),
        user_id=request.user_id,
        company_id=request.company_id,
        embedding=face_service.embedding_to_list(embedding),
        model_version="buffalo_l",
        quality_score=quality_score,
        is_active=True,
    )

    db.add(new_embedding)
    db.commit()
    db.refresh(new_embedding)

    return FaceRegisterResponse(
        success=True,
        message="Face registered successfully.",
        user_id=request.user_id,
        quality_score=round(quality_score, 4),
        registered_at=new_embedding.registered_at.isoformat(),
    )


@router.delete("/register/{user_id}", tags=["Face Registration"])
async def delete_face_registration(
    user_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_internal_key),
):
    """Deactivate face registration for a user (soft delete)"""

    record = db.query(FaceEmbedding).filter(
        FaceEmbedding.user_id == user_id
    ).first()

    if not record:
        raise HTTPException(
            status_code=404,
            detail="No face registration found for this user."
        )

    record.is_active = False
    db.commit()

    return {
        "success": True,
        "message": f"Face registration deactivated for user {user_id}",
    }


@router.get("/register/{user_id}/status", tags=["Face Registration"])
async def get_registration_status(
    user_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_internal_key),
):
    """Check if a user has registered their face"""

    record = db.query(FaceEmbedding).filter(
        FaceEmbedding.user_id == user_id,
        FaceEmbedding.is_active == True,
    ).first()

    if not record:
        return {
            "user_id": user_id,
            "registered": False,
            "message": "No active face registration found.",
        }

    return {
        "user_id": user_id,
        "registered": True,
        "quality_score": round(record.quality_score or 0, 4),
        "model_version": record.model_version,
        "registered_at": record.registered_at.isoformat(),
    }


@router.get("/register/company/{company_id}", tags=["Face Registration"])
async def get_company_registrations(
    company_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_internal_key),
):
    """Get all face registrations for a company"""

    records = db.query(FaceEmbedding).filter(
        FaceEmbedding.company_id == company_id,
        FaceEmbedding.is_active == True,
    ).all()

    return {
        "company_id": company_id,
        "total_registered": len(records),
        "users": [
            {
                "user_id": r.user_id,
                "quality_score": round(r.quality_score or 0, 4),
                "registered_at": r.registered_at.isoformat(),
            }
            for r in records
        ],
    }
