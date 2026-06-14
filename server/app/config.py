# pyrefly: ignore [missing-import]
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    PORT: int = 8000
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str

    # Backend
    BACKEND_URL: str = "http://localhost:3001"

    # Face recognition
    FACE_MATCH_THRESHOLD: float = 0.5
    MAX_IMAGE_SIZE_MB: int = 5
    ALLOWED_IMAGE_TYPES: str = "image/jpeg,image/png,image/webp"

    # Verification settings
    STRICT_THRESHOLD: float = 0.6
    LENIENT_THRESHOLD: float = 0.4
    MAX_VERIFICATION_ATTEMPTS: int = 3

    @property
    def allowed_image_types_list(self) -> List[str]:
        return self.ALLOWED_IMAGE_TYPES.split(",")

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
