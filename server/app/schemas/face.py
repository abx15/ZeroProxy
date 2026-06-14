# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# ─── Request Schemas ──────────────────────────────────────

class FaceRegisterRequest(BaseModel):
    user_id: str = Field(..., description="User UUID from NestJS backend")
    company_id: str = Field(..., description="Company UUID")
    image_base64: str = Field(..., description="Base64 encoded image (JPEG/PNG)")

class FaceVerifyRequest(BaseModel):
    user_id: str = Field(..., description="User UUID to verify against")
    image_base64: str = Field(..., description="Base64 encoded image")

class LivenessCheckRequest(BaseModel):
    frames: List[str] = Field(
        ...,
        min_length=3,
        max_length=10,
        description="List of 3-10 base64 encoded frames captured over 2-3 seconds"
    )

class LivenessSingleRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image to check")

# ─── Response Schemas ─────────────────────────────────────

class FaceRegisterResponse(BaseModel):
    success: bool
    message: str
    user_id: str
    quality_score: Optional[float] = None
    registered_at: Optional[str] = None

class FaceVerifyResponse(BaseModel):
    success: bool
    verified: bool
    message: str
    user_id: str
    confidence: Optional[float] = None
    threshold: float = 0.5

class LivenessResponse(BaseModel):
    success: bool
    is_live: bool
    message: str
    confidence: Optional[float] = None

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    environment: str
    database: str
    models_loaded: bool
    timestamp: str

class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    detail: Optional[str] = None

class FaceStatusResponse(BaseModel):
    user_id: str
    registered: bool
    message: Optional[str] = None
    quality_score: Optional[float] = None
    model_version: Optional[str] = None
    registered_at: Optional[str] = None

class CompanyRegistrationResponse(BaseModel):
    company_id: str
    total_registered: int
    users: list

class FaceCompareRequest(BaseModel):
    image1_base64: str = Field(..., description="First face image base64")
    image2_base64: str = Field(..., description="Second face image base64")

class FaceCompareResponse(BaseModel):
    success: bool
    similarity: float
    threshold: float
    same_person: bool
    quality_scores: dict
    interpretation: str

class BatchVerifyRequest(BaseModel):
    requests: List[FaceVerifyRequest] = Field(..., max_length=10)

class BatchVerifyResponse(BaseModel):
    success: bool
    total: int
    verified_count: int
    results: list
