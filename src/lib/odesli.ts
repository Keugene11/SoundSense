const ODESLI_API_KEY = process.env.ODESLI_API_KEY;

/**
 * Verify a song exists across streaming platforms via Odesli (song.link).
 * Runs AFTER YouTube search since it needs a videoId.
 * Returns existence + number of platforms the song is available on.
 */
export async function verifyViaOdesli(
  videoId: string
): Promise<{ exists: boolean; platformCount: number }> {
  const params = new URLSearchParams({
    url: `https://www.youtube.com/watch?v=${videoId}`,
  });
  if (ODESLI_API_KEY) params.set("key", ODESLI_API_KEY);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(
      `https://api.song.link/v1-alpha.1/links?${params}`,
      { signal: controller.signal }
    );
    if (!res.ok) return { exists: false, platformCount: 0 };

    const data = (await res.json()) as {
      linksByPlatform?: Record<string, unknown>;
    };

    const platforms = Object.keys(data.linksByPlatform ?? {});
    return {
      exists: platforms.length > 0,
      platformCount: platforms.length,
    };
  } catch {
    return { exists: false, platformCount: 0 };
  } finally {
    clearTimeout(timeout);
  }
}
