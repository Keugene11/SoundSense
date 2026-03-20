import { getSessionUserId } from "@/lib/session";
import { getProfile, getPreferences } from "@/lib/store";
import { SettingsClient } from "./client";

export default async function SettingsPage() {
  const userId = await getSessionUserId();

  let profile = null;
  let preferences = null;
  try {
    [profile, preferences] = await Promise.all([
      getProfile(userId),
      getPreferences(userId),
    ]);
  } catch {
    // DB query failed — continue with defaults
  }

  const safeProfile = profile ?? {
    id: userId,
    email: null,
    display_name: null,
    avatar_url: null,
    youtube_music_connected: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <SettingsClient
      profile={safeProfile}
      preferences={preferences}
    />
  );
}
