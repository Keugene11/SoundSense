import os

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

LASTFM_API_KEY = os.getenv("LASTFM_API_KEY", "")
LASTFM_BASE_URL = "https://ws.audioscrobbler.com/2.0/"


async def _lastfm_request(params: dict) -> dict:
    if not LASTFM_API_KEY:
        raise HTTPException(
            status_code=500, detail="LASTFM_API_KEY not configured"
        )

    params.update({"api_key": LASTFM_API_KEY, "format": "json"})

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(LASTFM_BASE_URL, params=params)
        if resp.status_code != 200:
            raise HTTPException(
                status_code=resp.status_code,
                detail=f"Last.fm API error: {resp.text}",
            )
        data = resp.json()
        if "error" in data:
            raise HTTPException(
                status_code=400,
                detail=f"Last.fm error {data['error']}: {data.get('message', '')}",
            )
        return data


@router.get("/lastfm/similar-tracks")
async def similar_tracks(
    artist: str = Query(..., min_length=1),
    track: str = Query(..., min_length=1),
    limit: int = Query(default=30, ge=1, le=100),
):
    """Get similar tracks from Last.fm."""
    data = await _lastfm_request(
        {"method": "track.getSimilar", "artist": artist, "track": track, "limit": limit}
    )

    similar = data.get("similartracks", {}).get("track", [])
    return {
        "tracks": [
            {
                "title": t.get("name", ""),
                "artist": t.get("artist", {}).get("name", ""),
                "match_score": float(t.get("match", 0)),
                "url": t.get("url", ""),
            }
            for t in similar
        ]
    }


@router.get("/lastfm/similar-artists")
async def similar_artists(
    artist: str = Query(..., min_length=1),
    limit: int = Query(default=20, ge=1, le=100),
):
    """Get similar artists from Last.fm."""
    data = await _lastfm_request(
        {"method": "artist.getSimilar", "artist": artist, "limit": limit}
    )

    similar = data.get("similarartists", {}).get("artist", [])
    return {
        "artists": [
            {
                "name": a.get("name", ""),
                "match_score": float(a.get("match", 0)),
                "url": a.get("url", ""),
            }
            for a in similar
        ]
    }
