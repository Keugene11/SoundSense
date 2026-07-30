export const runtime = "nodejs";

import { getSessionUserId } from "@/lib/session";
import { generateFromSeeds } from "@/lib/anthropic/recommendations";
import { getCandidatesForSeeds, verifyTrackExists, titleSimilarity, getGenreTagsForSeeds, searchTrack, getSimilarArtistsLFM, getArtistTopTracks } from "@/lib/lastfm";
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
  const videoId = extractYouTubeVideoId(query);
  if (videoId) {
    const details = await getVideoDetails(videoId);
    if (details) {
      return parseYouTubeTitle(details.title, details.channelTitle);
    }
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

  const byMatch = query.match(/^(.+?)\s+(?:by|[-–—])\s+(.+)$/i);
  const parsedTitle = byMatch ? byMatch[1].trim() : query;
  const parsedArtist = byMatch ? byMatch[2].trim() : "";

  const searchQuery = parsedArtist ? `${parsedTitle} ${parsedArtist}` : parsedTitle;
  const lastfmResults = await searchTrack(searchQuery, 5).catch(() => []);
  if (lastfmResults.length > 0) {
    const best = lastfmResults.reduce((a, b) => (b.listeners > a.listeners ? b : a));
    return { title: best.title, artist: best.artist };
  }

  const lookup = await lookupSeedSong(parsedTitle, parsedArtist);
  if (lookup) {
    return parseYouTubeTitle(lookup.resolvedTitle, lookup.resolvedArtist);
  }

  return { title: parsedTitle, artist: parsedArtist };
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId();
    const body = await req.json();

    let seeds: { title: string; artist: string }[];

    if (body.query && typeof body.query === "string") {
      const resolved = await resolveSeed(body.query.trim());
      seeds = [resolved];
    } else if (Array.isArray(body.seeds) && body.seeds.length > 0) {
      seeds = body.seeds.slice(0, 1);
    } else {
      return NextResponse.json({ error: "Provide a song name or YouTube URL" }, { status: 400 });
    }

    const liked: string[] = Array.isArray(body.liked) ? body.liked.slice(0, 50) : [];
    const disliked: string[] = Array.isArray(body.disliked) ? body.disliked.slice(0, 50) : [];

    const seedArtists = [...new Set(seeds.map((s) => s.artist).filter(Boolean))];

    // Phase 1: all external data in parallel, with timeouts so slow APIs don't block
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
      Promise.race([
        getSimilarArtistsTD(seedArtists),
        new Promise<string[]>((r) => setTimeout(() => r([]), 4000)),
      ]).catch(() => [] as string[]),
      Promise.race([
        getSimilarArtistsLB(seedArtists),
        new Promise<string[]>((r) => setTimeout(() => r([]), 4000)),
      ]).catch(() => [] as string[]),
      Promise.race([
        getGenreTagsForSeeds(seeds),
        new Promise<string[]>((r) => setTimeout(() => r([]), 4000)),
      ]).catch(() => [] as string[]),
    ]);

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

    if (lastfmCandidates.length === 0 && similarArtists.length === 0 && seedArtists.length > 0) {
      const fallbackResults = await Promise.all(
        seedArtists.map(async (artist) => {
          const [lfmSimilar, topTracks] = await Promise.all([
            getSimilarArtistsLFM(artist, 15).catch(() => []),
            getArtistTopTracks(artist, 10).catch(() => []),
          ]);
          return { lfmSimilar, topTracks };
        })
      );

      for (const { lfmSimilar, topTracks } of fallbackResults) {
        for (const name of lfmSimilar) {
          const lower = name.toLowerCase();
          if (!seenArtists.has(lower) && !seedArtistLower.has(lower)) {
            seenArtists.add(lower);
            similarArtists.push(name);
          }
        }
        for (const t of topTracks) {
          if (!seedArtistLower.has(t.artist.toLowerCase())) {
            lastfmCandidates.push({ title: t.title, artist: t.artist, matchScore: 0.3, url: "" });
          }
        }
      }
    }

    // Phase 2: AI generation
    const aiRecs = await generateFromSeeds(
      enrichedSeeds,
      10,
      { previouslyRecommended: disliked, recentListens: [], topArtists: [], preferences: null },
      lastfmCandidates.length > 0 ? lastfmCandidates : undefined,
      similarArtists.length > 0 ? similarArtists : undefined,
      genreTags.length > 0 ? genreTags : undefined,
      liked.length > 0 ? liked : undefined,
      disliked.length > 0 ? disliked : undefined
    );

    // Phase 3: Stream each rec to the client as soon as it's verified
    const encoder = new TextEncoder();
    type DbRec = {
      user_id: string;
      title: string;
      artist: string;
      album: string | null;
      video_id: string;
      thumbnail_url: string | null;
      reason: string;
      confidence_score: number;
      status: "pending";
    };
    const dbRecs: DbRec[] = [];

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // First chunk: resolved seed so the UI can show the real song name
          const resolvedSeed = enrichedSeeds[0];
          controller.enqueue(encoder.encode(JSON.stringify({
            _type: "seed",
            title: resolvedSeed?.title ?? seeds[0]?.title ?? "",
            artist: resolvedSeed?.artist ?? seeds[0]?.artist ?? "",
          }) + "\n"));

          let sentCount = 0;

          await Promise.all(
            aiRecs.map(async (rec) => {
              const searchQuery = `${rec.title} ${rec.artist}`;
              const [ytResult, lastfm] = await Promise.all([
                searchYouTubeRace(searchQuery, rec.title, rec.artist).catch(() => null),
                verifyTrackExists(rec.artist, rec.title).catch(() => ({ exists: false, listeners: 0 })),
              ]);

              if (!ytResult?.videoId) return;

              let ytScore = 0;
              if (ytResult.resultTitle) {
                const recStr = `${rec.title} ${rec.artist}`;
                ytScore = Math.max(
                  titleSimilarity(recStr, ytResult.resultTitle),
                  titleSimilarity(rec.title, ytResult.resultTitle)
                );
              }
              const lastfmScore = lastfm.exists ? (lastfm.listeners > 100 ? 1.0 : 0.6) : 0;
              const verificationScore = Math.max(ytScore, lastfmScore);

              const verified = verificationScore >= 0.35;
              if (!verified && sentCount >= 5) return;

              const row: DbRec = {
                user_id: userId,
                title: rec.title,
                artist: rec.artist,
                album: rec.album || null,
                video_id: ytResult.videoId,
                thumbnail_url: ytResult.thumbnail || null,
                reason: rec.reason,
                confidence_score: rec.confidence_score,
                status: "pending",
              };
              dbRecs.push(row);
              sentCount++;

              controller.enqueue(encoder.encode(JSON.stringify({
                ...row,
                id: `stream-${sentCount}-${Date.now()}`,
                created_at: new Date().toISOString(),
              }) + "\n"));
            })
          );
        } finally {
          if (dbRecs.length > 0) {
            insertRecommendations(dbRecs).catch(console.error);
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Discover recommendations error:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}
