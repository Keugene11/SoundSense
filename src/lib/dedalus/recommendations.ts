import { dedalus } from "./client";
import type { ListeningHistoryEntry, UserPreferences } from "@/types/database";

interface AIRecommendation {
  title: string;
  artist: string;
  album?: string;
  reason: string;
  confidence_score: number;
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

  const prompt = `You are a music recommendation engine. Based on the user's listening history and preferences, suggest ${count} songs they would enjoy.

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
- For each recommendation, provide a brief reason why they'd enjoy it
- Assign a confidence score from 0.0 to 1.0

Respond with a JSON array of objects with these fields:
- title (string)
- artist (string)
- album (string, optional)
- reason (string, 1-2 sentences)
- confidence_score (number 0-1)

Return ONLY the JSON array, no other text.`;

  const response = await dedalus.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.8,
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("No response from AI");

  const cleaned = content.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
  const recommendations: AIRecommendation[] = JSON.parse(cleaned);

  return recommendations.slice(0, count);
}
