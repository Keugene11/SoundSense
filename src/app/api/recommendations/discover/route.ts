import { getSessionUserId } from "@/lib/session";
import { generateFromSeeds } from "@/lib/anthropic/recommendations";
import { getCandidatesForSeeds, verifyTrackExists, titleSimilarity, getGenreTagsForSeeds } from "@/lib/lastfm";
import { searchYouTubeRace, lookupSeedSong, extractYouTubeVideoId, getVideoDetails } from "@/lib/youtube-music";
import { getSimilarArtistsTD } from "@/lib/tastedive";
import { getSimilarArtistsLB } from "@/lib/listenbrainz";
import { insertRecommendations } from "@/lib/store";
import { NextRequest, NextResponse } from "next/server";

function parseYouTubeTitle(rawTitle: string, rawArtist: string) {
  const ytTitle = rawTitle
    .replace(/\s*\(Official.*?\)/gi, "")
    .replace(/\s*\[Official.*?\]/gi, "")
    .replace(/\s*\|.*$/, "")
    .replace(/\s*official\s*(audio|video|music\s*video|lyric\s*video)/gi, "")
    .trim();

  const channelArtist = rawArtist
    .replace(/\s*-\s*Topic$/, "")
    .replace(/\s*VEVO$/i, "")
    .trim();

  const dashParts = ytTitle.split(" - ");
  if (dashParts.length >= 2) {
    return { title: dashParts.slice(1).join(" - ").trim(), artist: dashParts[0].trim() };
  }
  return { title: ytTitle, artist: channelArtist };
}

async function resolveSeed(query: string): Promise<{ title: string; artist: string }> {
  // Try YouTube URL first
  const videoId = extractYouTubeVideoId(query);
  if (videoId) {
    const details = await getVideoDetails(videoId);
    if (details) {
      return parseYouTubeTitle(details.title, details.channelTitle);
    }
    // Fallback to oEmbed
    try {
      const oembed = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (oembed.ok) {
        const data = await oembed.json();
        return parseYouTubeTitle(data.title || query, data.author_name || "");
      }
    } catch {}
    return { title: query, artist: "" };
  }

  // Free text — try YouTube lookup
  const lookup = await lookupSeedSong(query, "");
  if (lookup) {
    return parseYouTubeTitle(lookup.resolvedTitle, lookup.resolvedArtist);
  }

  // Last resort: split on " - " or " by "
  const byMatch = query.match(/^(.+?)\s+(?:by|[-–—])\s+(.+)$/i);
  if (byMatch) {
    return { title: byMatch[1].trim(), artist: byMatch[2].trim() };
  }

  return { title: query, artist: "" };
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    const body = await req.json();

    // Accept either { query: "..." } or { seeds: [...] }
    let seeds: { title: string; artist: string }[];

    if (body.query && typeof body.query === "string") {
      const resolved = await resolveSeed(body.query.trim());
      seeds = [resolved];
    } else if (Array.isArray(body.seeds) && body.seeds.length > 0) {
      seeds = body.seeds.slice(0, 1);
    } else {
      return NextResponse.json({ error: "Provide a song name or YouTube URL" }, { status: 400 });
    }

    // Phase 1: Enrich seeds + get candidates in parallel
    const seedArtists = [...new Set(seeds.map((s) => s.artist).filter(Boolean))];

    const [enrichedSeeds, lastfmCandidates, tdArtists, lbArtists, genreTags] = await Promise.all([
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
      getCandidatesForSeeds(seeds).catch(() => [] as { title: string; artist: string; matchScore: number }[]),
      getSimilarArtistsTD(seedArtists).catch(() => [] as string[]),
      getSimilarArtistsLB(seedArtists).catch(() => [] as string[]),
      getGenreTagsForSeeds(seeds).catch(() => [] as string[]),
    ]);

    // Dedupe similar artists
    const seedArtistLower = new Set(seedArtists.map((a) => a.toLowerCase()));
    const seenArtists = new Set<string>();
    const similarArtists: string[] = [];
    for (const name of [...tdArtists, ...lbArtists]) {
      const lower = name.toLowerCase();
      if (!seenArtists.has(lower) && !seedArtistLower.has(lower)) {
        seenArtists.add(lower);
        similarArtists.push(name);
      }
    }

    // Phase 2: AI generation
    const aiRecs = await generateFromSeeds(
      enrichedSeeds,
      10,
      { previouslyRecommended: [], recentListens: [], topArtists: [], preferences: null },
      lastfmCandidates.length > 0 ? lastfmCandidates : undefined,
      similarArtists.length > 0 ? similarArtists : undefined,
      genreTags.length > 0 ? genreTags : undefined
    );

    // Phase 3: YouTube search + verification
    const enrichedRecs = await Promise.all(
      aiRecs.map(async (rec) => {
        const searchQuery = `${rec.title} ${rec.artist}`;

        const [ytResult, lastfm] = await Promise.all([
          searchYouTubeRace(searchQuery),
          verifyTrackExists(rec.artist, rec.title),
        ]);

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
          user_id: userId,
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

    // Filter to verified songs
    const verifiedRecs = enrichedRecs
      .filter((rec) => rec._verified && rec.video_id !== null)
      .sort((a, b) => b._verificationScore - a._verificationScore || b.confidence_score - a.confidence_score)
      .slice(0, 10)
      .map(({ _verified, _verificationScore, ...rec }) => rec);

    const finalRecs = verifiedRecs.length >= 5
      ? verifiedRecs
      : enrichedRecs
          .filter((r) => r.video_id !== null)
          .slice(0, 10)
          .map(({ _verified, _verificationScore, ...rec }) => rec);

    // Try to save to DB but don't fail if it errors
    try {
      const saved = await insertRecommendations(finalRecs);
      return NextResponse.json({ recommendations: saved });
    } catch {
      // DB save failed — return unsaved recs with temp IDs
      const unsaved = finalRecs.map((r, i) => ({
        ...r,
        id: `temp-${i}`,
        created_at: new Date().toISOString(),
      }));
      return NextResponse.json({ recommendations: unsaved });
    }
  } catch (error) {
    console.error("Discover recommendations error:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}
