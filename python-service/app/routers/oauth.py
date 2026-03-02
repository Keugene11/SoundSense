import asyncio
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ytmusicapi import OAuthCredentials

router = APIRouter()


@router.post("/oauth/device-code")
async def get_device_code():
    """Start the OAuth device flow — returns a user code and verification URL."""
    client_id = os.environ.get("YTMUSIC_OAUTH_CLIENT_ID")
    client_secret = os.environ.get("YTMUSIC_OAUTH_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise HTTPException(
            status_code=500,
            detail="OAuth client credentials not configured on the server",
        )

    try:
        credentials = OAuthCredentials(client_id=client_id, client_secret=client_secret)
        code = credentials.get_code()
        return {
            "device_code": code["device_code"],
            "user_code": code["user_code"],
            "verification_url": code["verification_url"],
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start device flow: {str(e)}",
        )


class TokenRequest(BaseModel):
    device_code: str


@router.post("/oauth/token")
async def exchange_token(request: TokenRequest):
    """Poll Google for the OAuth token after user completes device flow.

    This is a blocking call — it waits until the user authorises or the code expires.
    """
    client_id = os.environ.get("YTMUSIC_OAUTH_CLIENT_ID")
    client_secret = os.environ.get("YTMUSIC_OAUTH_CLIENT_SECRET")

    if not client_id or not client_secret:
        raise HTTPException(
            status_code=500,
            detail="OAuth client credentials not configured on the server",
        )

    try:
        credentials = OAuthCredentials(client_id=client_id, client_secret=client_secret)
        # token_from_code blocks until user authorises — run in a thread
        token = await asyncio.to_thread(
            credentials.token_from_code, request.device_code
        )
        return {"oauth_tokens": token}
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Token exchange failed: {str(e)}",
        )
