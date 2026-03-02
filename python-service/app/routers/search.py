from fastapi import APIRouter, HTTPException, Query
from ytmusicapi import YTMusic

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

    oauth_tokens = credential_service.get_credentials(user_id)
    if not oauth_tokens:
        raise HTTPException(
            status_code=404,
            detail="No YouTube Music credentials found for this user",
        )

    try:
        ytmusic_service = YTMusicService(oauth_tokens)
        results = ytmusic_service.search(query=q, filter=filter, limit=limit)
        return {"results": results}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to search: {str(e)}",
        )


@router.get("/search-public")
async def search_public(
    q: str = Query(..., min_length=1, description="Search query"),
    filter: str = Query(default="songs", description="Result type filter"),
    limit: int = Query(default=10, ge=1),
):
    """Search YouTube Music without authentication."""
    try:
        ytmusic = YTMusic()
        results = ytmusic.search(q, filter=filter, limit=limit)
        return {"results": results}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to search: {str(e)}",
        )
