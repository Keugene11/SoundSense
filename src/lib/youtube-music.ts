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

export async function startDeviceFlow() {
  return fetchService("/api/oauth/device-code", { method: "POST" });
}

export async function completeDeviceFlow(deviceCode: string) {
  return fetchService("/api/oauth/token", {
    method: "POST",
    body: JSON.stringify({ device_code: deviceCode }),
  });
}
