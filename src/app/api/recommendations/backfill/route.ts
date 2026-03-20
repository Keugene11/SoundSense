import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { getRecommendations } from "@/lib/store";
import { searchYouTubeDirect, searchYouTubeScrape } from "@/lib/youtube-music";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const userId = await getSessionUserId();

    const recs = await getRecommendations(userId);
    const missing = recs.filter((r) => !r.video_id);

    if (missing.length === 0) {
      return NextResponse.json({ message: "All recommendations have video IDs", updated: 0 });
    }

    const supabase = createAdminClient();
    let updated = 0;

    for (const rec of missing) {
      const query = `${rec.title} ${rec.artist}`;
      const result = await searchYouTubeDirect(query) || await searchYouTubeScrape(query);
      if (result) {
        const { error } = await supabase
          .from("recommendations")
          .update({
            video_id: result.videoId,
            thumbnail_url: result.thumbnail,
          })
          .eq("id", rec.id)
          .eq("user_id", userId);

        if (!error) updated++;
      }
    }

    return NextResponse.json({ message: `Backfilled ${updated}/${missing.length} recommendations`, updated });
  } catch (error) {
    console.error("Backfill error:", error);
    return NextResponse.json(
      { error: "Failed to backfill recommendations" },
      { status: 500 }
    );
  }
}
