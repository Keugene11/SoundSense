import json

from ytmusicapi import YTMusic


class YTMusicService:
    def __init__(self, auth_headers: dict):
        """Initialize YTMusic client with browser auth headers.

        Args:
            auth_headers: Dictionary of auth headers in ytmusicapi format.
        """
        headers_json = json.dumps(auth_headers)
        self.client = YTMusic(auth=headers_json)

    def get_history(self) -> list[dict]:
        """Fetch the user's recently played tracks."""
        return self.client.get_history()

    def get_library_songs(self, limit: int = 100) -> list[dict]:
        """Fetch songs from the user's library.

        Args:
            limit: Maximum number of songs to return.
        """
        return self.client.get_library_songs(limit=limit)

    def search(
        self, query: str, filter: str = "songs", limit: int = 10
    ) -> list[dict]:
        """Search YouTube Music.

        Args:
            query: Search query string.
            filter: Result type filter (songs, videos, albums, artists, playlists).
            limit: Maximum number of results to return.
        """
        return self.client.search(query, filter=filter, limit=limit)

    def validate(self) -> bool:
        """Validate that the auth headers are working by attempting to fetch history."""
        try:
            self.client.get_history()
            return True
        except Exception:
            return False
