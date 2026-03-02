const PYTHON_SERVICE_URL =
  process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

export interface LastfmTrack {
  title: string;
  artist: string;
  matchScore: number;
  url: string;
}

interface LastfmSimilarTracksResponse {
  tracks: { title: string; artist: string; match_score: number; url: string }[];
}

interface LastfmSimilarArtistsResponse {
  artists: { name: string; match_score: number; url: string }[];
}

async function fetchLastfm<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${PYTHON_SERVICE_URL}${path}`, {
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || "Last.fm service error");
    }
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function getSimilarTracks(
  artist: string,
  track: string,
  limit = 30
): Promise<LastfmTrack[]> {
  const params = new URLSearchParams({ artist, track, limit: String(limit) });
  const data = await fetchLastfm<LastfmSimilarTracksResponse>(
    `/api/lastfm/similar-tracks?${params}`
  );
  return data.tracks.map((t) => ({
    title: t.title,
    artist: t.artist,
    matchScore: t.match_score,
    url: t.url,
  }));
}

export async function getSimilarArtists(
  artist: string,
  limit = 20
): Promise<{ name: string; matchScore: number }[]> {
  const params = new URLSearchParams({ artist, limit: String(limit) });
  const data = await fetchLastfm<LastfmSimilarArtistsResponse>(
    `/api/lastfm/similar-artists?${params}`
  );
  return data.artists.map((a) => ({
    name: a.name,
    matchScore: a.match_score,
  }));
}

interface TrackInfoResponse {
  exists: boolean;
  track: { title: string; artist: string; listeners: number; playcount: number; url: string } | null;
}

/**
 * Check if a track exists on Last.fm. Returns existence + listener count.
 */
export async function verifyTrackExists(
  artist: string,
  track: string
): Promise<{ exists: boolean; listeners: number }> {
  try {
    const params = new URLSearchParams({ artist, track });
    const data = await fetchLastfm<TrackInfoResponse>(
      `/api/lastfm/track-info?${params}`
    );
    return {
      exists: data.exists,
      listeners: data.track?.listeners ?? 0,
    };
  } catch {
    // If the service is down, assume it exists (don't block recs)
    return { exists: true, listeners: 0 };
  }
}

/**
 * Normalize a string for fuzzy comparison: lowercase, strip punctuation,
 * remove common suffixes like "(Official Video)", "ft.", "feat.", etc.
 */
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

/**
 * Check how similar two strings are (0 = no match, 1 = identical).
 * Uses token overlap (Jaccard-like) which handles word reordering.
 */
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

/**
 * Verify a recommendation is real by checking:
 * 1. YouTube result title similarity (did YouTube find the actual song?)
 * 2. Last.fm track existence (does Last.fm know this song?)
 * Returns a confidence that the song is real (0-1).
 */
export async function verifyRecommendation(
  rec: { title: string; artist: string },
  youtubeResultTitle: string | null
): Promise<{ verified: boolean; verificationScore: number }> {
  // Check YouTube title similarity
  let ytScore = 0;
  if (youtubeResultTitle) {
    const recStr = `${rec.title} ${rec.artist}`;
    ytScore = Math.max(
      titleSimilarity(recStr, youtubeResultTitle),
      titleSimilarity(rec.title, youtubeResultTitle)
    );
  }

  // Check Last.fm existence
  const lastfm = await verifyTrackExists(rec.artist, rec.title);
  const lastfmScore = lastfm.exists ? (lastfm.listeners > 100 ? 1.0 : 0.6) : 0;

  // A rec is verified if either source confirms it strongly
  const verificationScore = Math.max(ytScore, lastfmScore);
  return {
    verified: verificationScore >= 0.35,
    verificationScore,
  };
}

export async function getCandidatesForSeeds(
  seeds: { title: string; artist: string }[]
): Promise<LastfmTrack[]> {
  const results = await Promise.allSettled(
    seeds.map((seed) => getSimilarTracks(seed.artist, seed.title, 30))
  );

  const seen = new Set<string>();
  const seedKeys = new Set(
    seeds.map((s) => `${s.title.toLowerCase()}|${s.artist.toLowerCase()}`)
  );

  // Build a set of all seed artists (splitting collabs) so we can exclude them
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

      // Skip tracks by seed artists
      const trackArtists = track.artist
        .split(/(?:,\s*|\s+(?:feat\.?|ft\.?|x|&|and|with|y)\s+)/i)
        .map((a) => a.trim().toLowerCase());
      if (trackArtists.some((a) => seedArtists.has(a))) continue;

      seen.add(key);
      candidates.push(track);
    }
  }

  // Sort by match score descending
  candidates.sort((a, b) => b.matchScore - a.matchScore);
  return candidates;
}
