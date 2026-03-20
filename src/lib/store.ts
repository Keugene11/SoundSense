import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Profile,
  ListeningHistoryEntry,
  Recommendation,
  UserPreferences,
  SeedSong,
  SyncLog,
} from "@/types/database";

function db() {
  return createAdminClient();
}

// --- Profiles ---

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await db()
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return data;
}

export async function upsertProfile(
  profile: Partial<Profile> & { id: string }
): Promise<Profile> {
  const { data, error } = await db()
    .from("profiles")
    .upsert(profile)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// --- Listening History ---

export async function getListeningHistory(
  userId: string,
  limit = 50,
  offset = 0
): Promise<ListeningHistoryEntry[]> {
  const { data, error } = await db()
    .from("listening_history")
    .select("*")
    .eq("user_id", userId)
    .order("played_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data ?? [];
}

export async function upsertListeningHistory(
  entries: Omit<ListeningHistoryEntry, "id" | "synced_at">[]
): Promise<void> {
  const { error } = await db()
    .from("listening_history")
    .upsert(entries, { onConflict: "user_id,video_id,played_at" });
  if (error) throw error;
}

export async function getTopArtists(
  userId: string,
  limit = 10
): Promise<{ artist: string; count: number }[]> {
  const { data, error } = await db()
    .from("listening_history")
    .select("artist")
    .eq("user_id", userId)
    .not("artist", "is", null);
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    if (row.artist) counts[row.artist] = (counts[row.artist] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([artist, count]) => ({ artist, count }));
}

// --- Recommendations ---

export async function getRecommendations(
  userId: string,
  status?: Recommendation["status"]
): Promise<Recommendation[]> {
  let query = db()
    .from("recommendations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function insertRecommendations(
  recs: Omit<Recommendation, "id" | "created_at">[]
): Promise<Recommendation[]> {
  const { data, error } = await db()
    .from("recommendations")
    .insert(recs)
    .select();
  if (error) throw error;
  return data ?? [];
}

export async function getTodayRecommendationCount(
  userId: string
): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count, error } = await db()
    .from("recommendations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfDay.toISOString());
  if (error) throw error;
  return count ?? 0;
}

// --- User Preferences ---

export async function getPreferences(
  userId: string
): Promise<UserPreferences | null> {
  const { data } = await db()
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .single();
  return data;
}

export async function upsertPreferences(
  prefs: Partial<UserPreferences> & { user_id: string }
): Promise<UserPreferences> {
  const { data, error } = await db()
    .from("user_preferences")
    .upsert(prefs)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// --- Seed Songs ---

export async function getSeedSongs(userId: string): Promise<SeedSong[]> {
  const { data, error } = await db()
    .from("seed_songs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function insertSeedSong(
  userId: string,
  title: string,
  artist: string
): Promise<SeedSong> {
  const { data, error } = await db()
    .from("seed_songs")
    .insert({ user_id: userId, title, artist })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSeedSong(
  id: string,
  userId: string
): Promise<void> {
  const { error } = await db()
    .from("seed_songs")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

// --- Sync Log ---

export async function createSyncLog(userId: string): Promise<SyncLog> {
  const { data, error } = await db()
    .from("sync_log")
    .insert({ user_id: userId, status: "running" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSyncLog(
  id: string,
  updates: Partial<SyncLog>
): Promise<void> {
  const { error } = await db()
    .from("sync_log")
    .update(updates)
    .eq("id", id);
  if (error) throw error;
}

export async function getLatestSync(userId: string): Promise<SyncLog | null> {
  const { data } = await db()
    .from("sync_log")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .single();
  return data;
}
