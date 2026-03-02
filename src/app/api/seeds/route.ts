import { NextResponse } from "next/server";
import { getRouteUser } from "@/lib/auth";
import { insertSeedSong, deleteSeedSong } from "@/lib/store";
import { lookupSeedSong, extractYouTubeVideoId, getVideoDetails } from "@/lib/youtube-music";

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
  const auth = await getRouteUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  try {
    const { query } = await request.json();
    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 });
    }

    let title: string;
    let artist: string;
    const input = query.trim();

    // Check if the input is a YouTube link
    const videoId = extractYouTubeVideoId(input);

    if (videoId) {
      // Resolve directly from video ID — no search needed
      const details = await getVideoDetails(videoId);
      if (details) {
        ({ title, artist } = parseYouTubeTitle(details.title, details.channelTitle));
      } else {
        // API quota exceeded or unavailable — try scraping the oEmbed endpoint
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
      // Free-text search — look up on YouTube
      const lookup = await lookupSeedSong(input, "");
      if (lookup) {
        ({ title, artist } = parseYouTubeTitle(lookup.resolvedTitle, lookup.resolvedArtist));
      } else {
        title = input;
        artist = "";
      }
    }

    const seed = await insertSeedSong(user.id, title, artist);
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
  const auth = await getRouteUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  const { id } = await request.json();
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Seed ID is required" }, { status: 400 });
  }

  await deleteSeedSong(id, user.id);
  return NextResponse.json({ deleted: true });
}
