import { dedalus } from "./client";
import type { ListeningHistoryEntry, UserPreferences } from "@/types/database";

interface AIRecommendation {
  title: string;
  artist: string;
  album?: string;
  reason: string;
  confidence_score: number;
}

const SYSTEM_PROMPT =
  "You are a music curator who gives genuinely good, non-obvious recommendations. You have encyclopedic knowledge of music across all genres and eras. You never recommend generic popular songs unless they are a perfect fit.";

async function callAI(prompt: string, count: number): Promise<AIRecommendation[]> {
  const response = await dedalus.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    temperature: 0.65,
    max_tokens: 3000,
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("No response from AI");

  const cleaned = content.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
  const recommendations: AIRecommendation[] = JSON.parse(cleaned);

  return recommendations.slice(0, count);
}

export async function generateRecommendations(
  history: ListeningHistoryEntry[],
  preferences: UserPreferences,
  count: number = 10
): Promise<AIRecommendation[]> {
  const recentTracks = history.slice(0, 50).map((t) => ({
    title: t.title,
    artist: t.artist,
    album: t.album,
  }));

  const artistCounts: Record<string, number> = {};
  for (const track of history.slice(0, 200)) {
    if (track.artist) {
      artistCounts[track.artist] = (artistCounts[track.artist] || 0) + 1;
    }
  }
  const topArtists = Object.entries(artistCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }));

  const prompt = `Based on the user's listening history and preferences, suggest ${count} songs they would enjoy.

## User Preferences
- Favorite genres: ${preferences.favorite_genres.length > 0 ? preferences.favorite_genres.join(", ") : "Not specified"}
- Mood: ${preferences.mood}
- Discovery level: ${preferences.discovery_level}/100 (0=very familiar, 100=very adventurous)
- Excluded artists: ${preferences.exclude_artists.length > 0 ? preferences.exclude_artists.join(", ") : "None"}

## Top Artists (by play count)
${topArtists.map((a) => `- ${a.name} (${a.count} plays)`).join("\n")}

## Recent Listening History
${recentTracks.map((t) => `- "${t.title}" by ${t.artist}${t.album ? ` (${t.album})` : ""}`).join("\n")}

## Instructions
- Suggest ${count} songs the user would likely enjoy
- Mix familiar artists with new discoveries based on discovery_level
- Do NOT recommend songs already in their history
- Do NOT recommend songs by excluded artists
- Each song MUST actually exist
- For each recommendation, reference specific musical qualities
- Assign a confidence score from 0.0 to 1.0

Respond with a JSON array of objects: title (string), artist (string), album (string, optional), reason (string, 1-2 sentences), confidence_score (number 0-1).

Return ONLY the JSON array, no other text.`;

  return callAI(prompt, count);
}

export async function generateFromSeeds(
  seeds: { title: string; artist: string }[],
  count: number = 10
): Promise<AIRecommendation[]> {
  const seedList = seeds
    .map((s) => `- "${s.title}"${s.artist ? ` by ${s.artist}` : ""}`)
    .join("\n");

  const prompt = `A user wants recommendations based on these seed songs:

${seedList}

## Your Analysis Process
1. Identify the common threads: genre, subgenre, tempo, mood, era, instrumentation, vocal style, lyrical themes, production style
2. Consider the sonic palette — are these songs dark, upbeat, melancholic, aggressive, dreamy, etc.?
3. Think about what makes someone love THESE specific songs, not just the artists in general

## Recommendation Rules
- Recommend ${count} songs. Prioritize QUALITY over variety — every pick should be a genuine "if you love those songs, you'll love this" recommendation
- Include a mix of: well-known tracks the user may have missed, deep cuts from related artists, and lesser-known artists in the same sonic space
- NEVER recommend the seed songs or obvious greatest hits that everyone already knows (e.g. don't recommend "Bohemian Rhapsody" or "Stairway to Heaven" unless the seeds are truly obscure)
- Match the ENERGY and MOOD of the seeds, not just the genre. If seeds are chill indie, don't recommend upbeat pop
- Each song MUST actually exist — do not invent fake songs or artists
- The reason should reference specific musical qualities shared with the seeds (e.g. "similar dreamy synth textures" not "you might like this artist")
- Confidence score: 0.9+ = perfect match, 0.7-0.9 = strong match, 0.5-0.7 = adventurous pick

Respond with a JSON array of objects: title (string), artist (string), album (string, optional), reason (string, 1-2 sentences referencing specific musical qualities), confidence_score (number 0-1).

Return ONLY the JSON array, no other text.`;

  return callAI(prompt, count);
}
