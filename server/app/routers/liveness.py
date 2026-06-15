import base64
import numpy as np
from fastapi import APIRouter, HTTPException, Depends
from typing import List

from app.schemas.face import LivenessCheckRequest, LivenessResponse, LivenessSingleRequest
from app.services.liveness_service import liveness_service
from app.utils.image_utils import decode_base64_image
from app.utils.auth import verify_internal_key

router = APIRouter(prefix="/liveness", tags=["Liveness Detection"])


@router.post("/check", response_model=LivenessResponse)
async def check_liveness(
    request: LivenessCheckRequest,
    _: bool = Depends(verify_internal_key),
):
    """
    Check if person is real (live) or a spoof (photo/video).

    Send 3-10 frames captured from camera.
    System analyzes:
    - Eye blink detection (EAR < 0.25)
    - Head movement tracking
    - Natural facial micro-movements

    Frontend should capture frames over 2-3 seconds.
    """

    if len(request.frames) < 3:
        raise HTTPException(
            status_code=400,
            detail="Minimum 3 frames required for liveness check."
        )

    if len(request.frames) > 10:
        raise HTTPException(
            status_code=400,
            detail="Maximum 10 frames allowed per liveness check."
        )

    # Analyze each frame
    frame_analyses = []
    for idx, frame_b64 in enumerate(request.frames):
        try:
            img_array = decode_base64_image(frame_b64)
            analysis = liveness_service.analyze_frame(img_array)
            frame_analyses.append(analysis)
        except HTTPException:
            # If one frame fails, add empty result
            frame_analyses.append({"face_detected": False})
        except Exception:
            frame_analyses.append({"face_detected": False})

    # Check liveness from all frames
    result = liveness_service.check_liveness_from_frames(frame_analyses)

    return LivenessResponse(
        success=True,
        is_live=result["is_live"],
        message=result["reason"],
        confidence=result["confidence"],
    )


@router.post("/check/detailed", tags=["Liveness Detection"])
async def check_liveness_detailed(
    request: LivenessCheckRequest,
    _: bool = Depends(verify_internal_key),
):
    """
    Same as /check but returns full frame-by-frame analysis.
    Useful for debugging and fine-tuning threshold.
    """
    frame_analyses = []
    for idx, frame_b64 in enumerate(request.frames):
        try:
            img_array = decode_base64_image(frame_b64)
            analysis = liveness_service.analyze_frame(img_array)
            analysis["frame_index"] = idx
            frame_analyses.append(analysis)
        except Exception as e:
            frame_analyses.append({
                "frame_index": idx,
                "face_detected": False,
                "error": str(e),
            })

    result = liveness_service.check_liveness_from_frames(frame_analyses)

    return {
        "success": True,
        "is_live": result["is_live"],
        "confidence": result["confidence"],
        "score": result["score"],
        "reason": result["reason"],
        "details": result["details"],
        "frame_analyses": frame_analyses,
    }


@router.post("/check/single", tags=["Liveness Detection"])
async def check_single_frame(
    request: LivenessSingleRequest,
    _: bool = Depends(verify_internal_key),
):
    """
    Analyze a single frame — returns EAR and head pose.
    For testing/debugging only.
    """
    img_array = decode_base64_image(request.image_base64)
    analysis = liveness_service.analyze_frame(img_array)

    if not analysis["face_detected"]:
        raise HTTPException(
            status_code=400,
            detail="No face detected in the image."
        )

    return {
        "success": True,
        "face_detected": analysis["face_detected"],
        "left_ear": analysis["left_ear"],
        "right_ear": analysis["right_ear"],
        "avg_ear": analysis["avg_ear"],
        "eye_closed": analysis["eye_closed"],
        "head_pose": analysis["head_pose"],
        "interpretation": {
            "ear_note": "EAR < 0.25 means eye is closed (blink)",
            "current_status": "Eyes closed" if analysis["eye_closed"] else "Eyes open",
        },
    }


@router.get("/info", tags=["Liveness Detection"])
async def get_liveness_info(
    _: bool = Depends(verify_internal_key),
):
    """Get liveness detection configuration and thresholds"""
    return {
        "model": "MediaPipe FaceMesh",
        "model_loaded": liveness_service.is_loaded(),
        "required_frames": {"min": 3, "max": 10, "recommended": 5},
        "thresholds": {
            "blink_ear": 0.25,
            "ear_variance": 0.08,
            "head_movement_x": 0.01,
            "head_movement_y": 0.01,
            "natural_variance_std": 0.01,
        },
        "scoring": {
            "blink_detected": 50,
            "head_moved": 30,
            "natural_variance": 20,
            "pass_score": 50,
        },
        "frontend_guide": {
            "capture_duration": "2-3 seconds",
            "frame_interval_ms": 500,
            "recommended_frames": 5,
            "instructions_to_show_user": [
                "Look directly at camera",
                "Blink naturally",
                "Slightly move your head left or right",
            ],
        },
    }
