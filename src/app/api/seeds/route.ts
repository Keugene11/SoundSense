import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { insertSeedSong, deleteSeedSong } from "@/lib/store";
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

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
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

      const seeds = [];
      for (const item of items) {
        const { title, artist } = parseYouTubeTitle(item.title, item.channelTitle);
        const seed = await insertSeedSong(userId, title, artist);
        seeds.push(seed);
      }

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
      const lookup = await lookupSeedSong(input, "");
      if (lookup) {
        ({ title, artist } = parseYouTubeTitle(lookup.resolvedTitle, lookup.resolvedArtist));
      } else {
        title = input;
        artist = "";
      }
    }

    const seed = await insertSeedSong(userId, title, artist);
    return NextResponse.json({ seed });
  } catch (error) {
    console.error("Seeds POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add seed song" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await getSessionUserId();
    const { id } = await request.json();
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Seed ID is required" }, { status: 400 });
    }

    await deleteSeedSong(id, userId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Seeds DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete seed" },
      { status: 500 }
    );
  }
}
