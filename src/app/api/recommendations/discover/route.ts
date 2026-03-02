import { getRouteUser } from "@/lib/auth";
import { generateFromSeeds } from "@/lib/dedalus/recommendations";
import { getCandidatesForSeeds, verifyTrackExists, titleSimilarity } from "@/lib/lastfm";
import { searchYouTubeRace, lookupSeedSong } from "@/lib/youtube-music";
import { getSimilarArtistsTD } from "@/lib/tastedive";
import { getSimilarArtistsLB } from "@/lib/listenbrainz";
import { verifyTrackMusicBrainz } from "@/lib/musicbrainz";
import { verifyViaOdesli } from "@/lib/odesli";
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

    // Phase 0: Rate limit check (fast — must pass before expensive work)
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

    // Phase 1: Run seed lookups, Last.fm candidates, similar artists, and DB context ALL in parallel
    const seedArtists = [...new Set(seeds.map((s) => s.artist).filter(Boolean))];
    const [enrichedSeeds, lastfmCandidates, tdArtists, lbArtists, allRecs, preferences, history, topArtists] =
      await Promise.all([
        Promise.all(
          seeds.map(async (seed) => {
            const lookup = await lookupSeedSong(seed.title, seed.artist);
            if (lookup) {
              return {
                title: seed.title,
                artist: seed.artist,
                youtubeTitle: lookup.resolvedTitle,
                youtubeArtist: lookup.resolvedArtist,
              };
            }
            return { title: seed.title, artist: seed.artist };
          })
        ),
        getCandidatesForSeeds(seeds).catch((e) => {
          console.warn("Last.fm candidate fetch failed, continuing without:", e);
          return [] as { title: string; artist: string; matchScore: number }[];
        }),
        getSimilarArtistsTD(seedArtists),
        getSimilarArtistsLB(seedArtists),
        getRecommendations(user.id),
        getPreferences(user.id),
        getListeningHistory(user.id, 100),
        getTopArtists(user.id, 20),
      ]);

    // Merge + dedupe similar artists from TasteDive and ListenBrainz
    const seenArtists = new Set<string>();
    const similarArtists: string[] = [];
    for (const name of [...tdArtists, ...lbArtists]) {
      const lower = name.toLowerCase();
      if (!seenArtists.has(lower)) {
        seenArtists.add(lower);
        similarArtists.push(name);
      }
    }

    // Build context from user's history
    const previouslyRecommended = allRecs
      .slice(0, 50)
      .map((r) => `${r.title} - ${r.artist}`);

    const recentListens = history.slice(0, 30).map((t) => ({
      title: t.title,
      artist: t.artist || "Unknown",
    }));

    // Phase 2: AI generation (needs seeds + candidates + context)
    const aiRecs = await generateFromSeeds(
      enrichedSeeds,
      10,
      {
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
      },
      lastfmCandidates.length > 0 ? lastfmCandidates : undefined,
      similarArtists.length > 0 ? similarArtists : undefined
    );

    // Phase 3: YouTube search + multi-source verification in parallel for each rec
    const enrichedRecs = await Promise.all(
      aiRecs.map(async (rec) => {
        const searchQuery = `${rec.title} ${rec.artist}`;

        // Run YouTube search, Last.fm, and MusicBrainz verification concurrently
        const [ytResult, lastfm, mb] = await Promise.all([
          searchYouTubeRace(searchQuery),
          verifyTrackExists(rec.artist, rec.title),
          verifyTrackMusicBrainz(rec.artist, rec.title),
        ]);

        // Odesli needs videoId, so it runs after YouTube search
        const odesliResult = ytResult?.videoId
          ? await verifyViaOdesli(ytResult.videoId)
          : { exists: false, platformCount: 0 };

        // Compute verification score from all sources
        let ytScore = 0;
        if (ytResult?.resultTitle) {
          const recStr = `${rec.title} ${rec.artist}`;
          ytScore = Math.max(
            titleSimilarity(recStr, ytResult.resultTitle),
            titleSimilarity(rec.title, ytResult.resultTitle)
          );
        }
        const lastfmScore = lastfm.exists ? (lastfm.listeners > 100 ? 1.0 : 0.6) : 0;
        const mbScore = mb.score;
        const odesliScore = odesliResult.platformCount >= 3 ? 1.0 : (odesliResult.exists ? 0.7 : 0);
        const verificationScore = Math.max(ytScore, lastfmScore, mbScore, odesliScore);

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

    // Filter to verified songs, sorted by verification confidence then AI confidence
    const verifiedRecs = enrichedRecs
      .filter((rec) => rec._verified && rec.video_id !== null)
      .sort((a, b) => b._verificationScore - a._verificationScore || b.confidence_score - a.confidence_score)
      .slice(0, 10)
      .map(({ _verified, _verificationScore, ...rec }) => rec);

    if (verifiedRecs.length < enrichedRecs.length) {
      const dropped = enrichedRecs.length - verifiedRecs.length;
      console.warn(`Dropped ${dropped} recommendation(s) that failed verification`);
    }
    if (verifiedRecs.length < 7) {
      console.warn(`Only ${verifiedRecs.length} verified recommendations — below target of 7`);
    }

    // Fall back to unverified if verification dropped everything
    const finalRecs = verifiedRecs.length >= 5
      ? verifiedRecs
      : enrichedRecs
          .filter((r) => r.video_id !== null)
          .slice(0, 10)
          .map(({ _verified, _verificationScore, ...rec }) => rec);

    const saved = await insertRecommendations(finalRecs);

    return NextResponse.json({ recommendations: saved });
  } catch (error) {
    console.error("Discover recommendations error:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}
