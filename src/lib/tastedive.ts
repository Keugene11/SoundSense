const TASTEDIVE_API_KEY = process.env.TASTEDIVE_API_KEY;

/**
 * Get similar artists from TasteDive API.
 * Returns artist names for use as wildcard inspiration in AI prompts.
 * Gracefully returns [] if API key is unset or request fails.
 */
export async function getSimilarArtistsTD(
  artistNames: string[]
): Promise<string[]> {
  if (!TASTEDIVE_API_KEY || artistNames.length === 0) return [];

  const query = artistNames.slice(0, 5).join(", ");
  const params = new URLSearchParams({
    q: query,
    type: "music",
    limit: "20",
    k: TASTEDIVE_API_KEY,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(
      `https://tastedive.com/api/similar?${params}`,
      { signal: controller.signal }
    );
    if (!res.ok) return [];

    const data = (await res.json()) as {
      similar?: { results?: { name: string; type: string }[] };
    };

    const results = data.similar?.results ?? [];
    // Filter to music results and dedupe against input artists
    const inputLower = new Set(artistNames.map((a) => a.toLowerCase()));
    return results
      .filter((r) => r.type === "music" && !inputLower.has(r.name.toLowerCase()))
      .map((r) => r.name);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
