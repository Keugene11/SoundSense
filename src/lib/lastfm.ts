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
  const timeout = setTimeout(() => controller.abort(), 10000);
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
  const candidates: LastfmTrack[] = [];

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const track of result.value) {
      const key = `${track.title.toLowerCase()}|${track.artist.toLowerCase()}`;
      if (seen.has(key) || seedKeys.has(key)) continue;
      seen.add(key);
      candidates.push(track);
    }
  }

  // Sort by match score descending
  candidates.sort((a, b) => b.matchScore - a.matchScore);
  return candidates;
}
