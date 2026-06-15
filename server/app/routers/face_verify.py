import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import numpy as np

from app.database import get_db
from app.schemas.face import FaceVerifyRequest, FaceVerifyResponse, FaceCompareRequest, FaceCompareResponse, FaceLoginCheckRequest
from app.services.face_service import face_service
from app.models.face_embedding import FaceEmbedding
from app.utils.auth import verify_internal_key
from app.utils.image_utils import decode_base64_image, validate_image_size, check_image_quality
from app.config import settings

router = APIRouter(prefix="/face", tags=["Face Verification"])


@router.post("/verify", response_model=FaceVerifyResponse)
async def verify_face(
    request: FaceVerifyRequest,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_internal_key),
):
    """
    Verify employee face at login time.
    - Accepts base64 image + user_id
    - Gets stored embedding from PostgreSQL
    - Compares with live face embedding
    - Returns verified: true/false with confidence score
    """
    start_time = time.time()

    # 1. Check if user has registered face
    stored_record = db.query(FaceEmbedding).filter(
        FaceEmbedding.user_id == request.user_id,
        FaceEmbedding.is_active == True,
    ).first()

    if not stored_record:
        raise HTTPException(
            status_code=404,
            detail="No face registration found for this user. Please register your face first."
        )

    # 2. Decode incoming image
    img_array = decode_base64_image(request.image_base64)

    # 3. Validate image size
    validate_image_size(img_array, min_width=112, min_height=112)

    # 4. Add image quality check
    quality_report = check_image_quality(img_array)
    if not quality_report["quality_ok"]:
        issues = []
        if quality_report["is_blurry"]:
            issues.append("image is blurry")
        if quality_report["is_too_dark"]:
            issues.append("image is too dark")
        if quality_report["is_too_bright"]:
            issues.append("image is too bright/overexposed")
        raise HTTPException(
            status_code=400,
            detail=f"Image quality issues: {', '.join(issues)}. Please retake the photo."
        )

    # 5. Get embedding from live image
    live_embedding, quality_score = face_service.get_embedding(img_array)

    # 6. Get stored embedding from DB
    stored_embedding = face_service.list_to_embedding(stored_record.embedding)

    # 7. Calculate similarity score
    similarity = face_service.calculate_similarity(live_embedding, stored_embedding)

    # 8. Get threshold from config
    threshold = settings.FACE_MATCH_THRESHOLD  # default 0.5

    # 9. Decision
    is_verified = similarity >= threshold

    elapsed_ms = round((time.time() - start_time) * 1000, 2)

    if is_verified:
        return FaceVerifyResponse(
            success=True,
            verified=True,
            message="Face verified successfully. Welcome!",
            user_id=request.user_id,
            confidence=round(similarity, 4),
            threshold=threshold,
        )
    else:
        return FaceVerifyResponse(
            success=True,
            verified=False,
            message=f"Face verification failed. Similarity score ({similarity:.4f}) below threshold ({threshold}).",
            user_id=request.user_id,
            confidence=round(similarity, 4),
            threshold=threshold,
        )


@router.post("/verify/batch", tags=["Face Verification"])
async def verify_face_batch(
    requests: list[FaceVerifyRequest],
    db: Session = Depends(get_db),
    _: bool = Depends(verify_internal_key),
):
    """
    Verify multiple faces at once.
    Useful for bulk attendance marking.
    Max 10 requests per batch.
    """
    if len(requests) > 10:
        raise HTTPException(
            status_code=400,
            detail="Max 10 faces per batch request."
        )

    results = []
    for req in requests:
        try:
            # Reuse single verify logic
            stored_record = db.query(FaceEmbedding).filter(
                FaceEmbedding.user_id == req.user_id,
                FaceEmbedding.is_active == True,
            ).first()

            if not stored_record:
                results.append({
                    "user_id": req.user_id,
                    "verified": False,
                    "message": "No face registration found.",
                    "confidence": None,
                })
                continue

            img_array = decode_base64_image(req.image_base64)
            live_embedding, _ = face_service.get_embedding(img_array)
            stored_embedding = face_service.list_to_embedding(stored_record.embedding)
            similarity = face_service.calculate_similarity(live_embedding, stored_embedding)
            is_verified = similarity >= settings.FACE_MATCH_THRESHOLD

            results.append({
                "user_id": req.user_id,
                "verified": is_verified,
                "confidence": round(similarity, 4),
                "message": "Verified" if is_verified else "Not verified",
            })

        except HTTPException as e:
            results.append({
                "user_id": req.user_id,
                "verified": False,
                "message": e.detail,
                "confidence": None,
            })

    return {
        "success": True,
        "total": len(results),
        "verified_count": sum(1 for r in results if r["verified"]),
        "results": results,
    }


@router.post("/compare", response_model=FaceCompareResponse, tags=["Face Verification"])
async def compare_two_faces(
    request: FaceCompareRequest,
    _: bool = Depends(verify_internal_key),
):
    """
    Compare two face images directly.
    Useful for testing similarity scores.
    Does not require DB lookup.
    """
    # Decode both images
    img1 = decode_base64_image(request.image1_base64)
    img2 = decode_base64_image(request.image2_base64)

    # Get embeddings
    embedding1, quality1 = face_service.get_embedding(img1)
    embedding2, quality2 = face_service.get_embedding(img2)

    # Calculate similarity
    similarity = face_service.calculate_similarity(embedding1, embedding2)
    threshold = settings.FACE_MATCH_THRESHOLD

    return FaceCompareResponse(
        success=True,
        similarity=round(similarity, 4),
        threshold=threshold,
        same_person=similarity >= threshold,
        quality_scores={
            "image1": round(quality1, 4),
            "image2": round(quality2, 4),
        },
        interpretation=_interpret_similarity(similarity),
    )


def _interpret_similarity(score: float) -> str:
    if score >= 0.8:
        return "Very high confidence — definitely same person"
    elif score >= 0.6:
        return "High confidence — likely same person"
    elif score >= 0.5:
        return "Above threshold — same person (borderline)"
    elif score >= 0.3:
        return "Below threshold — likely different person"
    else:
        return "Very low similarity — different person"


@router.get("/verify/threshold", tags=["Face Verification"])
async def get_threshold_info(
    _: bool = Depends(verify_internal_key),
):
    """Get current threshold settings"""
    return {
        "current_threshold": settings.FACE_MATCH_THRESHOLD,
        "recommended_range": "0.4 - 0.6",
        "strict": settings.STRICT_THRESHOLD,
        "balanced": settings.FACE_MATCH_THRESHOLD,
        "lenient": settings.LENIENT_THRESHOLD,
        "note": "Higher threshold = more strict = fewer false accepts but more false rejects",
    }


@router.post("/login-check", tags=["Face Verification"])
async def face_login_check(
    request: FaceLoginCheckRequest,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_internal_key),
):
    """
    Combined endpoint — NestJS calls this for face login.
    Steps:
    1. Liveness check first (3+ frames)
    2. Face verification (single image)
    3. Returns combined result
    """
    from app.services.liveness_service import liveness_service
    from app.utils.image_utils import decode_base64_image
    from app.models.face_embedding import FaceEmbedding

    user_id = request.user_id
    image_base64 = request.image_base64
    liveness_frames = request.liveness_frames

    # Step 1: Liveness check
    if len(liveness_frames) < 3:
        return {
            "success": False,
            "step_failed": "liveness",
            "message": "Minimum 3 frames required for liveness check.",
            "verified": False,
            "is_live": False,
        }

    frame_analyses = []
    for frame_b64 in liveness_frames:
        try:
            img_array = decode_base64_image(frame_b64)
            analysis = liveness_service.analyze_frame(img_array)
            frame_analyses.append(analysis)
        except Exception:
            frame_analyses.append({"face_detected": False})

    liveness_result = liveness_service.check_liveness_from_frames(frame_analyses)

    if not liveness_result["is_live"]:
        return {
            "success": False,
            "step_failed": "liveness",
            "message": liveness_result["reason"],
            "verified": False,
            "is_live": False,
            "liveness_confidence": liveness_result["confidence"],
        }

    # Step 2: Face verification
    stored_record = db.query(FaceEmbedding).filter(
        FaceEmbedding.user_id == user_id,
        FaceEmbedding.is_active == True,
    ).first()

    if not stored_record:
        return {
            "success": False,
            "step_failed": "verification",
            "message": "No face registration found. Please register first.",
            "verified": False,
            "is_live": True,
        }

    try:
        img_array = decode_base64_image(image_base64)
        live_embedding, quality_score = face_service.get_embedding(img_array)
        stored_embedding = face_service.list_to_embedding(stored_record.embedding)
        similarity = face_service.calculate_similarity(live_embedding, stored_embedding)
        is_verified = similarity >= settings.FACE_MATCH_THRESHOLD
    except HTTPException as e:
        return {
            "success": False,
            "step_failed": "verification",
            "message": e.detail,
            "verified": False,
            "is_live": True,
        }

    return {
        "success": True,
        "step_failed": None,
        "message": "Face login successful." if is_verified else "Face does not match.",
        "verified": is_verified,
        "is_live": True,
        "confidence": round(similarity, 4),
        "threshold": settings.FACE_MATCH_THRESHOLD,
        "liveness_confidence": liveness_result["confidence"],
    }
