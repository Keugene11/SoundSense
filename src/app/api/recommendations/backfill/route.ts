import { NextResponse } from "next/server";
import { getRouteUser } from "@/lib/auth";
import { getRecommendations } from "@/lib/store";
import { searchYouTubeDirect, searchYouTubeScrape } from "@/lib/youtube-music";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const auth = await getRouteUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  const recs = await getRecommendations(user.id);
  const missing = recs.filter((r) => !r.video_id);

  if (missing.length === 0) {
    return NextResponse.json({ message: "All recommendations have video IDs", updated: 0 });
  }

  const supabase = await createClient();
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
        .eq("user_id", user.id);

      if (!error) updated++;
    }
  }

  return NextResponse.json({ message: `Backfilled ${updated}/${missing.length} recommendations`, updated });
}
