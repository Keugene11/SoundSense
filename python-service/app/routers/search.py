from fastapi import APIRouter, HTTPException, Query

from app.services.credentials import CredentialService
from app.services.ytmusic import YTMusicService

router = APIRouter()


@router.get("/search/{user_id}")
async def search(
    user_id: str,
    q: str = Query(..., min_length=1, description="Search query"),
    filter: str = Query(default="songs", description="Result type filter"),
    limit: int = Query(default=10, ge=1),
):
    """Search YouTube Music on behalf of a user."""
    credential_service = CredentialService()

    auth_headers = credential_service.get_credentials(user_id)
    if not auth_headers:
        raise HTTPException(
            status_code=404,
            detail="No YouTube Music credentials found for this user",
        )

    try:
        ytmusic_service = YTMusicService(auth_headers)
        results = ytmusic_service.search(query=q, filter=filter, limit=limit)
        return {"results": results}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to search: {str(e)}",
        )
