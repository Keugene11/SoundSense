from fastapi import APIRouter, HTTPException, Query

from app.services.credentials import CredentialService
from app.services.ytmusic import YTMusicService

router = APIRouter()


@router.get("/library/{user_id}")
async def get_library_songs(user_id: str, limit: int = Query(default=100, ge=1)):
    """Fetch songs from a user's YouTube Music library."""
    credential_service = CredentialService()

    auth_headers = credential_service.get_credentials(user_id)
    if not auth_headers:
        raise HTTPException(
            status_code=404,
            detail="No YouTube Music credentials found for this user",
        )

    try:
        ytmusic_service = YTMusicService(auth_headers)
        songs = ytmusic_service.get_library_songs(limit=limit)
        return {"songs": songs}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch library songs: {str(e)}",
        )
