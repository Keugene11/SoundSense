import { titleSimilarity } from "./lastfm";

const USER_AGENT = "SoundSense/1.0 (https://soundsense.app)";

/**
 * Verify a track exists on MusicBrainz by searching their recording database.
 * Rate limit: 1 req/sec — when fired in parallel, some will 503; those return gracefully.
 */
export async function verifyTrackMusicBrainz(
  artist: string,
  title: string
): Promise<{ exists: boolean; score: number }> {
  const query = `recording:"${title}" AND artist:"${artist}"`;
  const params = new URLSearchParams({
    query,
    fmt: "json",
    limit: "3",
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(
      `https://musicbrainz.org/ws/2/recording/?${params}`,
      {
        signal: controller.signal,
        headers: { "User-Agent": USER_AGENT },
      }
    );

    // 503s are expected due to rate limiting — fail gracefully
    if (!res.ok) return { exists: false, score: 0 };

    const data = (await res.json()) as {
      recordings?: {
        title: string;
        "artist-credit"?: { name: string }[];
        score: number;
      }[];
    };

    const recordings = data.recordings ?? [];
    if (recordings.length === 0) return { exists: false, score: 0 };

    // Find best match using titleSimilarity
    let bestScore = 0;
    for (const rec of recordings) {
      const recArtist = rec["artist-credit"]?.[0]?.name ?? "";
      const recStr = `${rec.title} ${recArtist}`;
      const queryStr = `${title} ${artist}`;
      const sim = titleSimilarity(queryStr, recStr);
      bestScore = Math.max(bestScore, sim);
    }

    return { exists: bestScore > 0.3, score: bestScore };
  } catch {
    return { exists: false, score: 0 };
  } finally {
    clearTimeout(timeout);
  }
}
