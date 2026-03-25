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
 * Simple token-overlap similarity for matching YouTube results to expected songs.
 */
function tokenSimilarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  const tokensA = new Set(normalize(a).split(" ").filter(Boolean));
  const tokensB = new Set(normalize(b).split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  for (const t of tokensA) if (tokensB.has(t)) overlap++;
  return overlap / Math.max(tokensA.size, tokensB.size);
}

/**
 * Search YouTube via the Data API v3 (requires YOUTUBE_API_KEY env var).
 * Scores all results against the expected title+artist and picks the best match.
 * Returns { videoId, thumbnail, resultTitle } or null.
 */
export async function searchYouTubeDirect(
  query: string,
  expectedTitle?: string,
  expectedArtist?: string
): Promise<{ videoId: string; thumbnail: string | null; resultTitle: string } | null> {
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
    const items = (data.items ?? []).filter((item: { snippet: { title: string } }) => {
      const title = item.snippet.title.toLowerCase();
      return !title.includes("#short") && !title.includes("shorts");
    });

    if (items.length === 0) return null;

    // Score each result against what we expect
    const expected = expectedTitle && expectedArtist
      ? `${expectedTitle} ${expectedArtist}`
      : query;

    let bestItem = items[0];
    let bestScore = 0;

    for (const item of items) {
      const ytTitle = item.snippet.title;
      const ytChannel = item.snippet.channelTitle || "";
      const combined = `${ytTitle} ${ytChannel}`;
      const score = Math.max(
        tokenSimilarity(expected, combined),
        tokenSimilarity(expected, ytTitle),
        expectedTitle ? tokenSimilarity(expectedTitle, ytTitle) : 0
      );
      if (score > bestScore) {
        bestScore = score;
        bestItem = item;
      }
    }

    return {
      videoId: bestItem.id.videoId,
      resultTitle: bestItem.snippet.title,
      thumbnail:
        bestItem.snippet.thumbnails?.medium?.url ||
        bestItem.snippet.thumbnails?.default?.url ||
        `https://i.ytimg.com/vi/${bestItem.id.videoId}/mqdefault.jpg`,
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
 *
 * Races YouTube API and scrape+oEmbed in parallel for speed.
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
  const query = artist ? `${title} ${artist}` : title;

  // Race both methods in parallel — prefer API result (has description)
  const apiPromise: Promise<{
    resolvedTitle: string;
    resolvedArtist: string;
    description: string;
  } | null> = apiKey
    ? fetch(
        `https://www.googleapis.com/youtube/v3/search?${new URLSearchParams({
          part: "snippet",
          q: `${query} official audio`,
          type: "video",
          videoCategoryId: "10",
          maxResults: "3",
          key: apiKey,
        })}`,
        { signal: AbortSignal.timeout(5000) }
      )
        .then(async (res) => {
          if (!res.ok) return null;
          const data = await res.json();
          if (data.error) return null;
          const item = data.items?.[0];
          if (!item) return null;
          return {
            resolvedTitle: item.snippet.title as string,
            resolvedArtist: item.snippet.channelTitle as string,
            description: (item.snippet.description?.slice(0, 200) || "") as string,
          };
        })
        .catch(() => null)
    : Promise.resolve(null);

  const scrapePromise: Promise<{
    resolvedTitle: string;
    resolvedArtist: string;
    description: string;
  } | null> = searchYouTubeScrape(query)
    .then(async (scrapeResult) => {
      if (!scrapeResult) return null;
      const oembed = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${scrapeResult.videoId}&format=json`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (!oembed.ok) return null;
      const data = await oembed.json();
      return {
        resolvedTitle: (data.title || title) as string,
        resolvedArtist: (data.author_name || artist) as string,
        description: "",
      };
    })
    .catch(() => null);

  const [apiResult, scrapeResult] = await Promise.all([apiPromise, scrapePromise]);
  return apiResult || scrapeResult;
}

interface YouTubeSearchResult {
  videoId: string;
  thumbnail: string | null;
  resultTitle: string | null;
}

/**
 * Race all available YouTube search methods in parallel.
 * Passes expected title/artist for smarter result picking.
 * Returns the best result, preferring YTMusicPublic (has title metadata for verification).
 */
export async function searchYouTubeRace(
  query: string,
  expectedTitle?: string,
  expectedArtist?: string
): Promise<YouTubeSearchResult | null> {
  const ytMusicP: Promise<YouTubeSearchResult | null> = searchYTMusicPublic(query, "songs", 1)
    .then(({ results }: { results: Record<string, unknown>[] }) => {
      if (results.length > 0 && results[0].videoId) {
        return {
          videoId: results[0].videoId as string,
          thumbnail: ((results[0].thumbnails as { url: string }[])?.[0]?.url || null) as string | null,
          resultTitle: ((results[0].title || results[0].name) as string) || null,
        };
      }
      return null;
    })
    .catch(() => null);

  const ytDirectP: Promise<YouTubeSearchResult | null> = searchYouTubeDirect(query, expectedTitle, expectedArtist)
    .then((r) =>
      r ? { videoId: r.videoId, thumbnail: r.thumbnail, resultTitle: r.resultTitle } : null
    )
    .catch(() => null);

  const ytScrapeP: Promise<YouTubeSearchResult | null> = searchYouTubeScrape(query)
    .then((r) =>
      r ? { videoId: r.videoId, thumbnail: r.thumbnail, resultTitle: null } : null
    )
    .catch(() => null);

  // Wait for all to settle, prefer YTMusic (has title for verification)
  const [ytMusic, ytDirect, ytScrape] = await Promise.all([ytMusicP, ytDirectP, ytScrapeP]);
  return ytMusic || ytDirect || ytScrape;
}

/**
 * Search YouTube by scraping the results page — no API key or quota needed.
 * Returns the first video ID and thumbnail, or null.
 */
export async function searchYouTubeScrape(
  query: string
): Promise<{ videoId: string; thumbnail: string | null } | null> {
  try {
    const q = encodeURIComponent(`${query} official audio`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(
      `https://www.youtube.com/results?search_query=${q}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!res.ok) return null;

    const html = await res.text();
    const matches = html.match(/"videoId":"([\w-]{11})"/g);
    if (!matches) return null;

    // Deduplicate and take the first
    const ids = [...new Set(matches.map((m) => m.match(/"([\w-]{11})"/)?.[1]))].filter(Boolean) as string[];
    if (ids.length === 0) return null;

    const videoId = ids[0];
    return {
      videoId,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    };
  } catch {
    return null;
  }
}

/**
 * Extract a YouTube video ID from various URL formats.
 * Returns null if the string isn't a YouTube link.
 */
export function extractYouTubeVideoId(input: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|music\.youtube\.com\/watch\?.*v=)([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Get video details (title, channel) from a YouTube video ID
 * using the Data API v3.
 */
export async function getVideoDetails(
  videoId: string
): Promise<{ title: string; channelTitle: string } | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({
      part: "snippet",
      id: videoId,
      key: apiKey,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${params}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) {
      console.error("YouTube videos API error:", res.status);
      return null;
    }

    const data = await res.json();
    if (data.error) {
      console.error("YouTube API error:", data.error.message);
      return null;
    }

    const item = data.items?.[0];
    if (!item) return null;

    return {
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
    };
  } catch {
    return null;
  }
}

/**
 * Extract a YouTube playlist ID from a URL.
 * Handles youtube.com/playlist?list=, music.youtube.com/playlist?list=,
 * and watch URLs with &list= parameter.
 * Returns null if no playlist ID found, or if it's the special "LM" (Liked Music) private playlist.
 */
export function extractYouTubePlaylistId(input: string): string | null {
  const match = input.match(
    /(?:youtube\.com|music\.youtube\.com)\/(?:playlist\?|watch\?.*&)list=([\w-]+)/
  );
  if (!match) return null;
  const listId = match[1];
  // "LM" is the private Liked Music playlist — requires OAuth, can't access via API
  if (listId === "LM") return null;
  return listId;
}

/**
 * Fetch all items from a YouTube playlist using the Data API.
 * Falls back to oEmbed for individual videos if the API quota is exceeded.
 * Returns up to `max` items (default 10 to match seed limit).
 */
export async function getPlaylistItems(
  playlistId: string,
  max: number = 10
): Promise<{ title: string; channelTitle: string }[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      part: "snippet",
      playlistId,
      maxResults: String(Math.min(max, 50)),
      key: apiKey,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) {
      console.error("YouTube playlistItems API error:", res.status);
      return [];
    }

    const data = await res.json();
    if (data.error) {
      console.error("YouTube API error:", data.error.message);
      return [];
    }

    return (data.items ?? [])
      .slice(0, max)
      .map((item: { snippet: { title: string; videoOwnerChannelTitle?: string; channelTitle?: string } }) => ({
        title: item.snippet.title,
        channelTitle: item.snippet.videoOwnerChannelTitle || item.snippet.channelTitle || "",
      }));
  } catch (e) {
    console.error("Playlist fetch failed:", e);
    return [];
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
