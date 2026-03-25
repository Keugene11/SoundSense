const LASTFM_API_KEY = process.env.LASTFM_API_KEY || "";
const LASTFM_BASE_URL = "https://ws.audioscrobbler.com/2.0/";

export interface LastfmTrack {
  title: string;
  artist: string;
  matchScore: number;
  url: string;
}

/**
 * Search Last.fm for a track by name. Returns real songs only — no ambient/nature content.
 * Great for resolving vague user input like "no one noticed" into "No One Noticed by The Marías".
 */
export async function searchTrack(
  query: string,
  limit = 5
): Promise<{ title: string; artist: string; listeners: number }[]> {
  try {
    const data = await lastfmRequest({
      method: "track.search",
      track: query,
      limit: String(limit),
    });

    const results = (data.results as Record<string, unknown>)?.trackmatches as Record<string, unknown> | undefined;
    const tracks = (results?.track ?? []) as Array<Record<string, unknown>>;

    return tracks.map((t) => ({
      title: (t.name as string) || "",
      artist: (t.artist as string) || "",
      listeners: parseInt((t.listeners as string) || "0", 10),
    }));
  } catch {
    return [];
  }
}

async function lastfmRequest(params: Record<string, string>): Promise<Record<string, unknown>> {
  if (!LASTFM_API_KEY) {
    throw new Error("LASTFM_API_KEY not configured");
  }

  const searchParams = new URLSearchParams({
    ...params,
    api_key: LASTFM_API_KEY,
    format: "json",
  });

  const res = await fetch(`${LASTFM_BASE_URL}?${searchParams}`, {
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Last.fm API error: ${res.statusText}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`Last.fm error ${data.error}: ${data.message || ""}`);
  }
  return data;
}

export async function getSimilarTracks(
  artist: string,
  track: string,
  limit = 30
): Promise<LastfmTrack[]> {
  const data = await lastfmRequest({
    method: "track.getSimilar",
    artist,
    track,
    limit: String(limit),
  });

  const similar = (data.similartracks as Record<string, unknown>)?.track;
  if (!Array.isArray(similar)) return [];

  return similar.map((t: Record<string, unknown>) => ({
    title: (t.name as string) || "",
    artist: ((t.artist as Record<string, unknown>)?.name as string) || "",
    matchScore: parseFloat(String(t.match || 0)),
    url: (t.url as string) || "",
  }));
}

export async function getSimilarArtists(
  artist: string,
  limit = 20
): Promise<{ name: string; matchScore: number }[]> {
  const data = await lastfmRequest({
    method: "artist.getSimilar",
    artist,
    limit: String(limit),
  });

  const similar = (data.similarartists as Record<string, unknown>)?.artist;
  if (!Array.isArray(similar)) return [];

  return similar.map((a: Record<string, unknown>) => ({
    name: (a.name as string) || "",
    matchScore: parseFloat(String(a.match || 0)),
  }));
}

export async function verifyTrackExists(
  artist: string,
  track: string
): Promise<{ exists: boolean; listeners: number }> {
  try {
    const data = await lastfmRequest({
      method: "track.getInfo",
      artist,
      track,
    });

    const trackData = data.track as Record<string, unknown> | undefined;
    if (!trackData) return { exists: false, listeners: 0 };

    return {
      exists: true,
      listeners: parseInt(String(trackData.listeners || 0), 10),
    };
  } catch {
    return { exists: true, listeners: 0 };
  }
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\b(official|video|audio|lyrics|lyric|hd|hq|remaster(ed)?|ft\.?|feat\.?|music video)\b/gi, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalize(a).split(" ").filter(Boolean));
  const tokensB = new Set(normalize(b).split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) overlap++;
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

export async function verifyRecommendation(
  rec: { title: string; artist: string },
  youtubeResultTitle: string | null
): Promise<{ verified: boolean; verificationScore: number }> {
  let ytScore = 0;
  if (youtubeResultTitle) {
    const recStr = `${rec.title} ${rec.artist}`;
    ytScore = Math.max(
      titleSimilarity(recStr, youtubeResultTitle),
      titleSimilarity(rec.title, youtubeResultTitle)
    );
  }

  const lastfm = await verifyTrackExists(rec.artist, rec.title);
  const lastfmScore = lastfm.exists ? (lastfm.listeners > 100 ? 1.0 : 0.6) : 0;

  const verificationScore = Math.max(ytScore, lastfmScore);
  return {
    verified: verificationScore >= 0.35,
    verificationScore,
  };
}

export async function getArtistTopTags(
  artist: string,
  limit = 5
): Promise<string[]> {
  try {
    const data = await lastfmRequest({
      method: "artist.getTopTags",
      artist,
      autocorrect: "1",
    });

    const tags = (data.toptags as Record<string, unknown>)?.tag;
    if (!Array.isArray(tags)) return [];

    return tags
      .slice(0, limit)
      .map((t: Record<string, unknown>) => (t.name as string) || "")
      .filter((name) => name.length > 0 && name.toLowerCase() !== "seen live");
  } catch {
    return [];
  }
}

export async function getTrackTopTags(
  artist: string,
  track: string,
  limit = 5
): Promise<string[]> {
  try {
    const data = await lastfmRequest({
      method: "track.getTopTags",
      artist,
      track,
      autocorrect: "1",
    });

    const tags = (data.toptags as Record<string, unknown>)?.tag;
    if (!Array.isArray(tags)) return [];

    return tags
      .slice(0, limit)
      .map((t: Record<string, unknown>) => (t.name as string) || "")
      .filter((name) => name.length > 0 && name.toLowerCase() !== "seen live");
  } catch {
    return [];
  }
}

export async function getGenreTagsForSeeds(
  seeds: { title: string; artist: string }[]
): Promise<string[]> {
  const results = await Promise.allSettled(
    seeds.flatMap((seed) => [
      seed.artist ? getArtistTopTags(seed.artist, 5) : Promise.resolve([]),
      seed.title && seed.artist
        ? getTrackTopTags(seed.artist, seed.title, 5)
        : Promise.resolve([]),
    ])
  );

  const seen = new Set<string>();
  const tags: string[] = [];
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const tag of result.value) {
      const lower = tag.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        tags.push(tag);
      }
    }
  }
  return tags;
}

export async function getCandidatesForSeeds(
  seeds: { title: string; artist: string }[]
): Promise<LastfmTrack[]> {
  const results = await Promise.allSettled(
    seeds.map((seed) => getSimilarTracks(seed.artist, seed.title, 50))
  );

  const seen = new Set<string>();
  const seedKeys = new Set(
    seeds.map((s) => `${s.title.toLowerCase()}|${s.artist.toLowerCase()}`)
  );

  const seedArtists = new Set(
    seeds.flatMap((s) =>
      s.artist
        .split(/(?:,\s*|\s+(?:feat\.?|ft\.?|x|&|and|with|y)\s+)/i)
        .map((a) => a.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  const candidates: LastfmTrack[] = [];

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const track of result.value) {
      const key = `${track.title.toLowerCase()}|${track.artist.toLowerCase()}`;
      if (seen.has(key) || seedKeys.has(key)) continue;

      const trackArtists = track.artist
        .split(/(?:,\s*|\s+(?:feat\.?|ft\.?|x|&|and|with|y)\s+)/i)
        .map((a) => a.trim().toLowerCase());
      if (trackArtists.some((a) => seedArtists.has(a))) continue;

      seen.add(key);
      candidates.push(track);
    }
  }

  candidates.sort((a, b) => b.matchScore - a.matchScore);
  return candidates;
}
