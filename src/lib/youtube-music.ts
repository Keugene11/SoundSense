const PYTHON_SERVICE_URL =
  process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

async function fetchService(path: string, options?: RequestInit) {
  const res = await fetch(`${PYTHON_SERVICE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "Python service error");
  }
  return res.json();
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

export async function validateCredentials(authHeaders: Record<string, string>) {
  return fetchService("/api/validate", {
    method: "POST",
    body: JSON.stringify({ auth_headers: authHeaders }),
  });
}
