import { getRouteUser } from "@/lib/auth";
import { generateFromSeeds } from "@/lib/dedalus/recommendations";
import { searchYTMusicPublic, searchYouTubeDirect } from "@/lib/youtube-music";
import {
  getSubscription,
  getTodayRecommendationCount,
  insertRecommendations,
} from "@/lib/store";
import { PLANS } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const auth = await getRouteUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  try {
    const body = await req.json();
    const seeds: { title: string; artist: string }[] = body.seeds;

    if (!Array.isArray(seeds) || seeds.length === 0 || seeds.length > 10) {
      return NextResponse.json(
        { error: "Provide between 1 and 10 seed songs" },
        { status: 400 }
      );
    }

    // Check rate limits
    const [subscription, todayCount] = await Promise.all([
      getSubscription(user.id),
      getTodayRecommendationCount(user.id),
    ]);

    const plan = subscription?.plan || "free";
    const limit = PLANS[plan].recommendations_per_day;

    if (todayCount >= limit) {
      return NextResponse.json(
        {
          error: "Daily recommendation limit reached",
          limit,
          used: todayCount,
          upgrade: plan === "free",
        },
        { status: 429 }
      );
    }

    // Generate AI recommendations from seeds
    const aiRecs = await generateFromSeeds(seeds);

    // Search YouTube Music for video IDs (unauthenticated)
    const enrichedRecs = await Promise.all(
      aiRecs.map(async (rec) => {
        let video_id: string | null = null;
        let thumbnail_url: string | null = null;

        const searchQuery = `${rec.title} ${rec.artist}`;

        // Try Python service first, fall back to direct YouTube search
        try {
          const { results } = await searchYTMusicPublic(searchQuery, "songs", 1);
          if (results.length > 0) {
            video_id = results[0].videoId || null;
            thumbnail_url = results[0].thumbnails?.[0]?.url || null;
          }
        } catch {
          // Python service unavailable — fall back to direct search
        }

        if (!video_id) {
          try {
            const result = await searchYouTubeDirect(searchQuery);
            if (result) {
              video_id = result.videoId;
              thumbnail_url = result.thumbnail;
            }
          } catch {
            // All search methods failed
          }
        }

        return {
          user_id: user.id,
          title: rec.title,
          artist: rec.artist,
          album: rec.album || null,
          video_id,
          thumbnail_url,
          reason: rec.reason,
          confidence_score: rec.confidence_score,
          status: "pending" as const,
        };
      })
    );

    const saved = await insertRecommendations(enrichedRecs);

    return NextResponse.json({ recommendations: saved });
  } catch (error) {
    console.error("Discover recommendations error:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}
