import { NextResponse } from "next/server";
import {
  lookupSeedSong,
  extractYouTubeVideoId,
  extractYouTubePlaylistId,
  getVideoDetails,
  getPlaylistItems,
} from "@/lib/youtube-music";

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

function makeSeed(title: string, artist: string) {
  return {
    id: crypto.randomUUID(),
    user_id: "anonymous",
    title,
    artist,
    created_at: new Date().toISOString(),
  };
}

export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 });
    }

    const input = query.trim();

    // Check if it's a playlist URL
    const playlistId = extractYouTubePlaylistId(input);
    if (playlistId) {
      const items = await getPlaylistItems(playlistId, 1);
      if (items.length === 0) {
        return NextResponse.json(
          { error: "Could not load playlist. It may be private or the API quota is exceeded." },
          { status: 400 }
        );
      }

      const seeds = items.map((item) => {
        const { title, artist } = parseYouTubeTitle(item.title, item.channelTitle);
        return makeSeed(title, artist);
      });

      return NextResponse.json({ seeds });
    }

    // Check if the input is a single YouTube link
    let title: string;
    let artist: string;
    const videoId = extractYouTubeVideoId(input);

    if (videoId) {
      const details = await getVideoDetails(videoId);
      if (details) {
        ({ title, artist } = parseYouTubeTitle(details.title, details.channelTitle));
      } else {
        try {
          const oembed = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
            { signal: AbortSignal.timeout(5000) }
          );
          if (oembed.ok) {
            const data = await oembed.json();
            ({ title, artist } = parseYouTubeTitle(data.title || videoId, data.author_name || ""));
          } else {
            title = videoId;
            artist = "";
          }
        } catch {
          title = videoId;
          artist = "";
        }
      }
    } else {
      // Free text — try YouTube lookup, fall back to raw input
      const lookup = await lookupSeedSong(input, "").catch(() => null);
      if (lookup) {
        ({ title, artist } = parseYouTubeTitle(lookup.resolvedTitle, lookup.resolvedArtist));
      } else {
        // Parse "Song by Artist" or "Artist - Song" patterns
        const byMatch = input.match(/^(.+?)\s+(?:by|[-–—])\s+(.+)$/i);
        if (byMatch) {
          title = byMatch[1].trim();
          artist = byMatch[2].trim();
        } else {
          title = input;
          artist = "";
        }
      }
    }

    return NextResponse.json({ seed: makeSeed(title, artist) });
  } catch (error) {
    console.error("Seeds POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to find song" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  // Seeds are client-side only now, no DB to delete from
  return NextResponse.json({ deleted: true });
}
