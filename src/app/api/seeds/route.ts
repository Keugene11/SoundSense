import { NextResponse } from "next/server";
import { getRouteUser } from "@/lib/auth";
import { insertSeedSong, deleteSeedSong } from "@/lib/store";
import { lookupSeedSong } from "@/lib/youtube-music";

export async function POST(request: Request) {
  const auth = await getRouteUser();
  if (auth.error) return auth.error;
  const { user } = auth;

  const { query } = await request.json();
  if (!query || typeof query !== "string" || !query.trim()) {
    return NextResponse.json({ error: "Search query is required" }, { status: 400 });
  }

  // Look up the song on YouTube to resolve actual title/artist
  const lookup = await lookupSeedSong(query.trim(), "");
  let title: string;
  let artist: string;

  if (lookup) {
    // Parse YouTube title — often "Artist - Title" or "Title" with channel as artist
    const ytTitle = lookup.resolvedTitle
      .replace(/\s*\(Official.*?\)/gi, "")
      .replace(/\s*\[Official.*?\]/gi, "")
      .replace(/\s*\|.*$/, "")
      .replace(/\s*official\s*(audio|video|music\s*video|lyric\s*video)/gi, "")
      .trim();

    const channelArtist = lookup.resolvedArtist
      .replace(/\s*-\s*Topic$/, "")
      .replace(/\s*VEVO$/i, "")
      .trim();

    // If YouTube title contains " - ", split it as "Artist - Title"
    const dashParts = ytTitle.split(" - ");
    if (dashParts.length >= 2) {
      artist = dashParts[0].trim();
      title = dashParts.slice(1).join(" - ").trim();
    } else {
      title = ytTitle;
      artist = channelArtist;
    }
  } else {
    // Fallback: use raw query as title
    title = query.trim();
    artist = "";
  }

  const seed = await insertSeedSong(user.id, title, artist);
  return NextResponse.json({ seed });
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
