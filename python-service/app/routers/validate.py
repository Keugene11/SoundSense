from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.ytmusic import YTMusicService

router = APIRouter()


class ValidateRequest(BaseModel):
    auth_headers: dict


@router.post("/validate")
async def validate_credentials(request: ValidateRequest):
    """Validate YouTube Music auth headers without requiring a user ID."""
    try:
        ytmusic_service = YTMusicService(request.auth_headers)
        is_valid = ytmusic_service.validate()
        return {"valid": is_valid}
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid credentials: {str(e)}",
        )
