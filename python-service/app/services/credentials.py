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
        """Fetch YouTube Music auth headers for a user from the database."""
        response = (
            self.client.table("yt_music_credentials")
            .select("auth_headers")
            .eq("user_id", user_id)
            .single()
            .execute()
        )

        if response.data:
            return response.data["auth_headers"]

        return None

    def store_credentials(self, user_id: str, auth_headers: dict) -> None:
        """Upsert YouTube Music auth headers for a user into the database."""
        self.client.table("yt_music_credentials").upsert(
            {"user_id": user_id, "auth_headers": auth_headers},
            on_conflict="user_id",
        ).execute()
