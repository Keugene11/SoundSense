import { getSessionUserId } from "@/lib/session";
import { getHistory } from "@/lib/youtube-music";
import {
  createSyncLog,
  updateSyncLog,
  upsertListeningHistory,
} from "@/lib/store";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const userId = await getSessionUserId();
    const syncLog = await createSyncLog(userId);

    try {
      const history = await getHistory(userId);

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
          user_id: userId,
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
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Sync failed" },
      { status: 500 }
    );
  }
}
