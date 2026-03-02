const MB_USER_AGENT = "SoundSense/1.0 (https://soundsense.app)";

/**
 * Look up MusicBrainz MBID for an artist by name.
 */
async function getArtistMBID(artistName: string): Promise<string | null> {
  const params = new URLSearchParams({
    query: `artist:"${artistName}"`,
    fmt: "json",
    limit: "1",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(
      `https://musicbrainz.org/ws/2/artist/?${params}`,
      {
        signal: controller.signal,
        headers: { "User-Agent": MB_USER_AGENT },
      }
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      artists?: { id: string; name: string; score: number }[];
    };
    const top = data.artists?.[0];
    return top && top.score >= 80 ? top.id : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Get similar artists from ListenBrainz for a given artist MBID.
 */
async function getSimilarFromLB(mbid: string): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(
      `https://api.listenbrainz.org/1/similar/artist/${mbid}`,
      {
        signal: controller.signal,
        headers: { "User-Agent": MB_USER_AGENT },
      }
    );
    if (!res.ok) return [];

    const data = (await res.json()) as {
      payload?: { artists?: { name: string; score: number }[] };
    };
    return (data.payload?.artists ?? []).map((a) => a.name);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Get similar artists from ListenBrainz.
 * Two-step: MusicBrainz MBID lookup -> ListenBrainz similar-artists query.
 * Caps at 3 artist lookups to respect MusicBrainz rate limit.
 * Returns similar artist names — merged with TasteDive results for AI prompt.
 */
export async function getSimilarArtistsLB(
  artistNames: string[]
): Promise<string[]> {
  if (artistNames.length === 0) return [];

  // Cap at 3 to respect MusicBrainz rate limit (1 req/sec)
  const capped = artistNames.slice(0, 3);
  const allSimilar: string[] = [];
  const inputLower = new Set(artistNames.map((a) => a.toLowerCase()));

  // Run sequentially to respect MusicBrainz rate limit
  for (const artist of capped) {
    const mbid = await getArtistMBID(artist);
    if (!mbid) continue;
    const similar = await getSimilarFromLB(mbid);
    allSimilar.push(...similar);
  }

  // Dedupe and remove input artists
  const seen = new Set<string>();
  return allSimilar.filter((name) => {
    const lower = name.toLowerCase();
    if (inputLower.has(lower) || seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}
