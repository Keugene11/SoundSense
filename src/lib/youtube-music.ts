const PYTHON_SERVICE_URL =
  process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

async function fetchService(path: string, options?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${PYTHON_SERVICE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || "Python service error");
    }
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function getHistory(userId: string) {
  return fetchService(`/api/history/${userId}`);
}

export async function getLibrary(userId: string, limit = 100) {
  return fetchService(`/api/library/${userId}?limit=${limit}`);
}

export async function searchYTMusic(
  userId: string,
  query: string,
  filter = "songs",
  limit = 10
) {
  const params = new URLSearchParams({ q: query, filter, limit: String(limit) });
  return fetchService(`/api/search/${userId}?${params}`);
}

export async function searchYTMusicPublic(
  query: string,
  filter = "songs",
  limit = 10
) {
  const params = new URLSearchParams({ q: query, filter, limit: String(limit) });
  return fetchService(`/api/search-public?${params}`);
}

/**
 * Search YouTube via the Data API v3 (requires YOUTUBE_API_KEY env var).
 * Returns { videoId, thumbnail } or null.
 */
export async function searchYouTubeDirect(
  query: string
): Promise<{ videoId: string; thumbnail: string | null } | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn("YOUTUBE_API_KEY not set — cannot search YouTube");
    return null;
  }

  try {
    const params = new URLSearchParams({
      part: "snippet",
      q: `${query} official audio`,
      type: "video",
      videoCategoryId: "10", // Music category
      maxResults: "5",
      key: apiKey,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) {
      console.error("YouTube API error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const items = data.items ?? [];

    // Skip Shorts and pick the first real music video/audio
    const item = items.find((item: { snippet: { title: string } }) => {
      const title = item.snippet.title.toLowerCase();
      return !title.includes("#short") && !title.includes("shorts");
    }) ?? items[0];

    if (!item) return null;

    return {
      videoId: item.id.videoId,
      thumbnail:
        item.snippet.thumbnails?.medium?.url ||
        item.snippet.thumbnails?.default?.url ||
        `https://i.ytimg.com/vi/${item.id.videoId}/mqdefault.jpg`,
    };
  } catch (e) {
    console.error("YouTube search failed:", e);
    return null;
  }
}

/**
 * Look up a seed song on YouTube to get the real title, channel name,
 * and description. This helps the AI understand what the song actually is
 * instead of guessing from the user's text input.
 */
export async function lookupSeedSong(
  title: string,
  artist: string
): Promise<{
  resolvedTitle: string;
  resolvedArtist: string;
  description: string;
} | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  try {
    const query = artist ? `${title} ${artist}` : title;
    const searchParams = new URLSearchParams({
      part: "snippet",
      q: `${query} official audio`,
      type: "video",
      videoCategoryId: "10",
      maxResults: "3",
      key: apiKey,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${searchParams}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const item = data.items?.[0];
    if (!item) return null;

    return {
      resolvedTitle: item.snippet.title,
      resolvedArtist: item.snippet.channelTitle,
      description: item.snippet.description?.slice(0, 200) || "",
    };
  } catch {
    return null;
  }
}

export async function startDeviceFlow() {
  return fetchService("/api/oauth/device-code", { method: "POST" });
}

export async function completeDeviceFlow(deviceCode: string) {
  return fetchService("/api/oauth/token", {
    method: "POST",
    body: JSON.stringify({ device_code: deviceCode }),
  });
}
