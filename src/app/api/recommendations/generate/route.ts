import { getRouteUser } from "@/lib/auth";
import { generateRecommendations } from "@/lib/dedalus/recommendations";
import { getSimilarTracks, verifyTrackExists, titleSimilarity } from "@/lib/lastfm";
import { searchYTMusic } from "@/lib/youtube-music";
import { getSimilarArtistsTD } from "@/lib/tastedive";
import { getSimilarArtistsLB } from "@/lib/listenbrainz";
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
    // Fetch rate limits + user data in a single parallel batch
    const [subscription, todayCount, history, preferences] = await Promise.all([
      getSubscription(user.id),
      getTodayRecommendationCount(user.id),
      getListeningHistory(user.id, 200),
      getPreferences(user.id),
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

    // Fetch Last.fm similar tracks + similar artists from TasteDive/ListenBrainz
    const recentSeeds = history
      .filter((t) => t.artist && t.title)
      .slice(0, 5);
    const seedArtists = [...new Set(recentSeeds.map((t) => t.artist!))];

    const lastfmCandidates: { title: string; artist: string; matchScore: number }[] = [];
    const similarArtists: string[] = [];

    // Run Last.fm candidates + TasteDive + ListenBrainz in parallel
    const [lastfmResult, tdArtists, lbArtists] = await Promise.all([
      Promise.allSettled(
        recentSeeds.map((t) => getSimilarTracks(t.artist!, t.title, 20))
      ).catch(() => [] as PromiseSettledResult<{ title: string; artist: string; matchScore: number; url: string }[]>[]),
      getSimilarArtistsTD(seedArtists),
      getSimilarArtistsLB(seedArtists),
    ]);

    // Process Last.fm candidates
    try {
      const seen = new Set<string>();
      const historyKeys = new Set(
        history.map((t) => `${t.title.toLowerCase()}|${(t.artist || "").toLowerCase()}`)
      );
      for (const result of lastfmResult) {
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
      console.warn("Last.fm candidate processing failed, continuing without:", e);
    }

    // Merge + dedupe similar artists from TasteDive and ListenBrainz
    {
      const seenArtists = new Set<string>();
      for (const name of [...tdArtists, ...lbArtists]) {
        const lower = name.toLowerCase();
        if (!seenArtists.has(lower)) {
          seenArtists.add(lower);
          similarArtists.push(name);
        }
      }
    }

    // Generate AI recommendations
    const aiRecs = await generateRecommendations(
      history,
      defaultPrefs,
      10,
      lastfmCandidates.length > 0 ? lastfmCandidates : undefined,
      similarArtists.length > 0 ? similarArtists : undefined
    );

    // Search YouTube Music and verify songs — run all verification sources concurrently per rec
    const enrichedRecs = await Promise.all(
      aiRecs.map(async (rec) => {
        const searchQuery = `${rec.title} ${rec.artist}`;

        // Run YouTube search and Last.fm verification concurrently
        const [ytResult, lastfm] = await Promise.all([
          searchYTMusic(user.id, searchQuery, "songs", 1)
            .then((results: Record<string, unknown>[]) => {
              if (results.length > 0 && results[0].videoId) {
                return {
                  videoId: results[0].videoId as string,
                  thumbnail: ((results[0].thumbnails as { url: string }[])?.[0]?.url || null) as string | null,
                  resultTitle: ((results[0].title || results[0].name) as string) || null,
                };
              }
              return null;
            })
            .catch(() => null),
          verifyTrackExists(rec.artist, rec.title),
        ]);

        // Compute verification score
        let ytScore = 0;
        if (ytResult?.resultTitle) {
          const recStr = `${rec.title} ${rec.artist}`;
          ytScore = Math.max(
            titleSimilarity(recStr, ytResult.resultTitle),
            titleSimilarity(rec.title, ytResult.resultTitle)
          );
        }
        const lastfmScore = lastfm.exists ? (lastfm.listeners > 100 ? 1.0 : 0.6) : 0;
        const verificationScore = Math.max(ytScore, lastfmScore);

        return {
          user_id: user.id,
          title: rec.title,
          artist: rec.artist,
          album: rec.album || null,
          video_id: ytResult?.videoId || null,
          thumbnail_url: ytResult?.thumbnail || null,
          reason: rec.reason,
          confidence_score: rec.confidence_score,
          status: "pending" as const,
          _verified: verificationScore >= 0.35,
          _verificationScore: verificationScore,
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
