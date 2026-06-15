from fastapi import Header, HTTPException
from app.config import settings

async def verify_internal_key(x_api_key: str = Header(...)):
    """
    Verify internal API key — only NestJS backend can call AI service.
    NestJS must send header: X-API-Key: <key>
    """
    if x_api_key != settings.INTERNAL_API_KEY:
        raise HTTPException(
            status_code=403,
            detail="Invalid API key. Access denied."
        )
    return True
