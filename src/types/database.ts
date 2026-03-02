export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  youtube_music_connected: boolean;
  created_at: string;
  updated_at: string;
}

export interface YTMusicCredentials {
  id: string;
  user_id: string;
  auth_headers: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface ListeningHistoryEntry {
  id: string;
  user_id: string;
  video_id: string;
  title: string;
  artist: string | null;
  album: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  played_at: string | null;
  synced_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  favorite_genres: string[];
  mood: string;
  discovery_level: number;
  exclude_artists: string[];
  created_at: string;
  updated_at: string;
}

export interface Recommendation {
  id: string;
  user_id: string;
  title: string;
  artist: string;
  album: string | null;
  video_id: string | null;
  thumbnail_url: string | null;
  reason: string | null;
  confidence_score: number | null;
  status: "pending" | "liked" | "disliked" | "saved";
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: "free" | "pro";
  status: "active" | "canceled" | "past_due" | "trialing";
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncLog {
  id: string;
  user_id: string;
  status: "pending" | "running" | "completed" | "failed";
  tracks_synced: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}
