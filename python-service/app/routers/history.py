from fastapi import APIRouter, HTTPException

from app.services.credentials import CredentialService
from app.services.ytmusic import YTMusicService

router = APIRouter()


@router.get("/history/{user_id}")
async def get_history(user_id: str):
    """Fetch a user's YouTube Music listening history."""
    credential_service = CredentialService()

    oauth_tokens = credential_service.get_credentials(user_id)
    if not oauth_tokens:
        raise HTTPException(
            status_code=404,
            detail="No YouTube Music credentials found for this user",
        )

    try:
        ytmusic_service = YTMusicService(oauth_tokens)
        history = ytmusic_service.get_history()
        return {"history": history}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch history: {str(e)}",
        )
