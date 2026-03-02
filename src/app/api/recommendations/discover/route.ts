import { getRouteUser } from "@/lib/auth";
import { generateFromSeeds } from "@/lib/dedalus/recommendations";
import { searchYTMusicPublic, searchYouTubeDirect } from "@/lib/youtube-music";
import {
  getSubscription,
  getTodayRecommendationCount,
  getRecommendations,
  getPreferences,
  getListeningHistory,
  getTopArtists,
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

    // Fetch rate limits + all available context in parallel
    const [subscription, todayCount, allRecs, preferences, history, topArtists] =
      await Promise.all([
        getSubscription(user.id),
        getTodayRecommendationCount(user.id),
        getRecommendations(user.id),
        getPreferences(user.id),
        getListeningHistory(user.id, 100),
        getTopArtists(user.id, 20),
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

    // Build context from user's history
    const likedSongs = allRecs
      .filter((r) => r.status === "liked")
      .slice(0, 15)
      .map((r) => ({ title: r.title, artist: r.artist }));

    const dislikedSongs = allRecs
      .filter((r) => r.status === "disliked")
      .slice(0, 10)
      .map((r) => ({ title: r.title, artist: r.artist }));

    const previouslyRecommended = allRecs
      .slice(0, 50)
      .map((r) => `${r.title} - ${r.artist}`);

    const recentListens = history.slice(0, 30).map((t) => ({
      title: t.title,
      artist: t.artist || "Unknown",
    }));

    // Generate AI recommendations with full context
    const aiRecs = await generateFromSeeds(seeds, 10, {
      likedSongs,
      dislikedSongs,
      previouslyRecommended,
      recentListens,
      topArtists: topArtists.slice(0, 10),
      preferences: preferences
        ? {
            genres: preferences.favorite_genres,
            mood: preferences.mood,
            discoveryLevel: preferences.discovery_level,
            excludeArtists: preferences.exclude_artists,
          }
        : null,
    });

    // Search YouTube for video IDs
    const enrichedRecs = await Promise.all(
      aiRecs.map(async (rec) => {
        let video_id: string | null = null;
        let thumbnail_url: string | null = null;

        const searchQuery = `${rec.title} ${rec.artist}`;

        try {
          const { results } = await searchYTMusicPublic(searchQuery, "songs", 1);
          if (results.length > 0) {
            video_id = results[0].videoId || null;
            thumbnail_url = results[0].thumbnails?.[0]?.url || null;
          }
        } catch {
          // Python service unavailable
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
