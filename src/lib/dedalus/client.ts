import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getDedalusClient() {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.DEDALUS_API_KEY!,
      baseURL: process.env.DEDALUS_BASE_URL || "https://api.dedaluslabs.ai/v1",
    });
  }
  return _client;
}

export const dedalus = new Proxy({} as OpenAI, {
  get(_, prop) {
    return (getDedalusClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
