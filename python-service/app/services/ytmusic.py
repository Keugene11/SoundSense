import os

from ytmusicapi import OAuthCredentials, YTMusic


class YTMusicService:
    def __init__(self, oauth_tokens: dict):
        """Initialize YTMusic client with OAuth tokens.

        Args:
            oauth_tokens: Dictionary of OAuth token data from the device flow.
        """
        client_id = os.environ.get("YTMUSIC_OAUTH_CLIENT_ID")
        client_secret = os.environ.get("YTMUSIC_OAUTH_CLIENT_SECRET")

        oauth_credentials = OAuthCredentials(
            client_id=client_id, client_secret=client_secret
        )
        self.client = YTMusic(auth=oauth_tokens, oauth_credentials=oauth_credentials)

    def get_history(self) -> list[dict]:
        """Fetch the user's recently played tracks."""
        return self.client.get_history()

    def get_library_songs(self, limit: int = 100) -> list[dict]:
        """Fetch songs from the user's library."""
        return self.client.get_library_songs(limit=limit)

    def search(
        self, query: str, filter: str = "songs", limit: int = 10
    ) -> list[dict]:
        """Search YouTube Music."""
        return self.client.search(query, filter=filter, limit=limit)
