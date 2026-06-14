# pyrefly: ignore [missing-import]
from sqlalchemy import Column, String, DateTime, Boolean, Text, Float, Integer
# pyrefly: ignore [missing-import]
from sqlalchemy.dialects.postgresql import ARRAY
# pyrefly: ignore [missing-import]
from sqlalchemy.sql import func
from app.database import Base

class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"

    id = Column(String, primary_key=True)           # UUID from NestJS
    user_id = Column(String, nullable=False, unique=True, index=True)
    company_id = Column(String, nullable=False, index=True)
    embedding = Column(ARRAY(Float), nullable=False) # 512-dim InsightFace vector
    model_version = Column(String, default="buffalo_l")
    quality_score = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True)
    registered_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<FaceEmbedding user_id={self.user_id}>"
