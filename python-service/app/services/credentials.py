import os

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()


class CredentialService:
    def __init__(self):
        supabase_url = os.environ.get("SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

        if not supabase_url or not supabase_key:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment"
            )

        self.client: Client = create_client(supabase_url, supabase_key)

    def get_credentials(self, user_id: str) -> dict | None:
        """Fetch YouTube Music OAuth tokens for a user from the database."""
        response = (
            self.client.table("yt_music_credentials")
            .select("oauth_tokens")
            .eq("user_id", user_id)
            .single()
            .execute()
        )

        if response.data:
            return response.data["oauth_tokens"]

        return None

    def store_credentials(self, user_id: str, oauth_tokens: dict) -> None:
        """Upsert YouTube Music OAuth tokens for a user into the database."""
        self.client.table("yt_music_credentials").upsert(
            {"user_id": user_id, "oauth_tokens": oauth_tokens},
            on_conflict="user_id",
        ).execute()
