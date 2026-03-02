import { getRouteUser } from "@/lib/auth";
import { generateRecommendations } from "@/lib/dedalus/recommendations";
import { getSimilarTracks, verifyRecommendation } from "@/lib/lastfm";
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

    // Fetch Last.fm similar tracks for recent listens as candidates
    let lastfmCandidates: { title: string; artist: string; matchScore: number }[] = [];
    try {
      // Pick up to 5 recent tracks with known artists to use as seeds
      const recentSeeds = history
        .filter((t) => t.artist && t.title)
        .slice(0, 5);
      const trackResults = await Promise.allSettled(
        recentSeeds.map((t) => getSimilarTracks(t.artist!, t.title, 20))
      );
      const seen = new Set<string>();
      const historyKeys = new Set(
        history.map((t) => `${t.title.toLowerCase()}|${(t.artist || "").toLowerCase()}`)
      );
      for (const result of trackResults) {
        if (result.status !== "fulfilled") continue;
        for (const track of result.value) {
          const key = `${track.title.toLowerCase()}|${track.artist.toLowerCase()}`;
          if (!seen.has(key) && !historyKeys.has(key)) {
            seen.add(key);
            lastfmCandidates.push(track);
          }
        }
      }
      lastfmCandidates.sort((a, b) => b.matchScore - a.matchScore);
    } catch (e) {
      console.warn("Last.fm candidate fetch failed, continuing without:", e);
    }

    // Generate AI recommendations
    const aiRecs = await generateRecommendations(
      history,
      defaultPrefs,
      10,
      lastfmCandidates.length > 0 ? lastfmCandidates : undefined
    );

    // Search YouTube Music for video IDs and verify songs are real
    const enrichedRecs = await Promise.all(
      aiRecs.map(async (rec) => {
        let video_id: string | null = null;
        let thumbnail_url: string | null = null;
        let ytResultTitle: string | null = null;

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
            ytResultTitle = results[0].title || results[0].name || null;
          }
        } catch {
          // Search failed
        }

        const verification = await verifyRecommendation(
          { title: rec.title, artist: rec.artist },
          ytResultTitle
        );

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
          _verified: verification.verified,
          _verificationScore: verification.verificationScore,
        };
      })
    );

    // Filter to verified songs, sorted by verification then AI confidence
    const verifiedRecs = enrichedRecs
      .filter((rec) => rec._verified && rec.video_id !== null)
      .sort((a, b) => b._verificationScore - a._verificationScore || b.confidence_score - a.confidence_score)
      .slice(0, 10)
      .map(({ _verified, _verificationScore, ...rec }) => rec);

    if (verifiedRecs.length < enrichedRecs.length) {
      console.warn(`Dropped ${enrichedRecs.length - verifiedRecs.length} recommendation(s) that failed verification`);
    }

    const finalRecs = verifiedRecs.length >= 5
      ? verifiedRecs
      : enrichedRecs
          .filter((r) => r.video_id !== null)
          .slice(0, 10)
          .map(({ _verified, _verificationScore, ...rec }) => rec);

    const saved = await insertRecommendations(finalRecs);

    return NextResponse.json({ recommendations: saved });
  } catch (error) {
    console.error("Generate recommendations error:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}
