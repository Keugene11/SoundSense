import { getRouteUser } from "@/lib/auth";
import { getHistory } from "@/lib/youtube-music";
import {
  createSyncLog,
  updateSyncLog,
  upsertListeningHistory,
} from "@/lib/store";
import { NextResponse } from "next/server";

export async function POST() {
  const auth = await getRouteUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  const syncLog = await createSyncLog(user.id);

  try {
    const history = await getHistory(user.id);

    const entries = history.map(
      (track: {
        videoId: string;
        title: string;
        artists?: { name: string }[];
        album?: { name: string };
        thumbnails?: { url: string }[];
        duration_seconds?: number;
        played?: string;
      }) => ({
        user_id: user.id,
        video_id: track.videoId,
        title: track.title,
        artist: track.artists?.map((a) => a.name).join(", ") || null,
        album: track.album?.name || null,
        thumbnail_url: track.thumbnails?.[0]?.url || null,
        duration_seconds: track.duration_seconds || null,
        played_at: track.played || new Date().toISOString(),
      })
    );

    await upsertListeningHistory(entries);

    await updateSyncLog(syncLog.id, {
      status: "completed",
      tracks_synced: entries.length,
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      synced: entries.length,
      sync_id: syncLog.id,
    });
  } catch (error) {
    await updateSyncLog(syncLog.id, {
      status: "failed",
      error_message: error instanceof Error ? error.message : "Unknown error",
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json(
      { error: "Sync failed" },
      { status: 500 }
    );
  }
}
