import { getRouteUser } from "@/lib/auth";
import { generateRecommendations } from "@/lib/dedalus/recommendations";
import { searchYTMusic } from "@/lib/youtube-music";
import {
  getListeningHistory,
  getPreferences,
  getSubscription,
  getTodayRecommendationCount,
  insertRecommendations,
} from "@/lib/store";
import { PLANS } from "@/lib/stripe";
import { NextResponse } from "next/server";

export async function POST() {
  const auth = await getRouteUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  try {
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

    // Get user data
    const [history, preferences] = await Promise.all([
      getListeningHistory(user.id, 200),
      getPreferences(user.id),
    ]);

    if (history.length === 0) {
      return NextResponse.json(
        {
          error:
            "No listening history found. Please sync your YouTube Music first.",
        },
        { status: 400 }
      );
    }

    const defaultPrefs = preferences || {
      id: "",
      user_id: user.id,
      favorite_genres: [],
      mood: "balanced",
      discovery_level: 50,
      exclude_artists: [],
      created_at: "",
      updated_at: "",
    };

    // Generate AI recommendations
    const aiRecs = await generateRecommendations(history, defaultPrefs);

    // Search YouTube Music for video IDs
    const enrichedRecs = await Promise.all(
      aiRecs.map(async (rec) => {
        let video_id: string | null = null;
        let thumbnail_url: string | null = null;

        try {
          const results = await searchYTMusic(
            user.id,
            `${rec.title} ${rec.artist}`,
            "songs",
            1
          );
          if (results.length > 0) {
            video_id = results[0].videoId || null;
            thumbnail_url = results[0].thumbnails?.[0]?.url || null;
          }
        } catch {
          // Search failed, still save the recommendation without video_id
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
    console.error("Generate recommendations error:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}
