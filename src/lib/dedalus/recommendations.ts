import { dedalus } from "./client";
import type { ListeningHistoryEntry, UserPreferences } from "@/types/database";

interface AIRecommendation {
  title: string;
  artist: string;
  album?: string;
  reason: string;
  confidence_score: number;
}

interface SeedContext {
  likedSongs: { title: string; artist: string }[];
  dislikedSongs: { title: string; artist: string }[];
  previouslyRecommended: string[];
  recentListens: { title: string; artist: string }[];
  topArtists: { artist: string; count: number }[];
  preferences: {
    genres: string[];
    mood: string;
    discoveryLevel: number;
    excludeArtists: string[];
  } | null;
}

const SYSTEM_PROMPT = `You are a world-class music curator — think of yourself as the person behind the best "Discover Weekly" playlists. You have deep knowledge of:
- Music theory (chord progressions, time signatures, key signatures)
- Production techniques (lo-fi, overdriven, reverb-drenched, crisp, analog warmth)
- Genre genealogy (how genres evolved, split, and cross-pollinated)
- Artist networks (collaborators, influences, contemporaries, proteges)
- Cultural context (scenes, movements, eras, regional sounds)

You recommend songs that make people say "holy shit, how did you know I'd love this?" — not songs that make them say "oh yeah, I already know that one."

CRITICAL RULES:
- Every song you recommend MUST be a real song that actually exists. Never invent songs or artists.
- If you are not 100% certain a song exists, do NOT include it. It is better to recommend fewer songs than to recommend fake ones.
- Never recommend a song the user has already heard, liked, or been recommended before.
- Never recommend the seed songs themselves.`;

async function callAI(prompt: string, count: number): Promise<AIRecommendation[]> {
  const response = await dedalus.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    temperature: 0.5,
    max_tokens: 6000,
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("No response from AI");

  const cleaned = content.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
  const recommendations: AIRecommendation[] = JSON.parse(cleaned);

  // Sort by confidence and return up to requested count
  recommendations.sort((a, b) => b.confidence_score - a.confidence_score);
  return recommendations.slice(0, count);
}

export async function generateRecommendations(
  history: ListeningHistoryEntry[],
  preferences: UserPreferences,
  count: number = 10,
  candidates?: CandidateTrack[]
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

  const requestCount = 20; // Over-generate, verification will filter to final count

  let candidateSection = "";
  if (candidates?.length) {
    const candidateList = candidates
      .slice(0, 80)
      .map((c) => `- "${c.title}" by ${c.artist} (similarity: ${(c.matchScore * 100).toFixed(0)}%)`)
      .join("\n");
    candidateSection = `\n## Verified Similar Songs (from collaborative listening data)
These songs are confirmed similar based on REAL listener behavior on Last.fm.
You MUST select at least ${Math.min(Math.ceil(requestCount * 0.7), candidates.length)} of your recommendations from this list.
These are VERIFIED REAL songs — prioritize them heavily.
You may include up to 3 wildcards not on this list, but ONLY if you are 100% certain they are real songs with EXACT correct spelling.

${candidateList}
`;
  }

  const prompt = `Based on the user's listening history and preferences, suggest ${requestCount} songs they would enjoy.

## User Preferences
- Favorite genres: ${preferences.favorite_genres.length > 0 ? preferences.favorite_genres.join(", ") : "Not specified"}
- Mood: ${preferences.mood}
- Discovery level: ${preferences.discovery_level}/100 (0=very familiar, 100=very adventurous)
- Excluded artists: ${preferences.exclude_artists.length > 0 ? preferences.exclude_artists.join(", ") : "None"}

## Top Artists (by play count)
${topArtists.map((a) => `- ${a.name} (${a.count} plays)`).join("\n")}

## Recent Listening History
${recentTracks.map((t) => `- "${t.title}" by ${t.artist}${t.album ? ` (${t.album})` : ""}`).join("\n")}
${candidateSection}
## Instructions
- Suggest ${requestCount} songs the user would likely enjoy
- Mix familiar artists with new discoveries based on discovery_level
- Do NOT recommend songs already in their history
- Do NOT recommend songs by excluded artists
- Every song MUST actually exist — use EXACT official title and artist spelling
- NEVER invent or guess at song titles. If you can't recall the exact title, skip it.
- For each recommendation, reference specific musical qualities
- Assign a confidence score from 0.0 to 1.0

Respond with a JSON array of objects: title (string), artist (string), album (string, optional), reason (string, 1-2 sentences), confidence_score (number 0-1).

Return ONLY the JSON array, no other text.`;

  return callAI(prompt, requestCount);
}

interface EnrichedSeed {
  title: string;
  artist: string;
  youtubeTitle?: string;
  youtubeArtist?: string;
}

interface CandidateTrack {
  title: string;
  artist: string;
  matchScore: number;
}

export async function generateFromSeeds(
  seeds: EnrichedSeed[],
  count: number = 10,
  context?: SeedContext,
  candidates?: CandidateTrack[]
): Promise<AIRecommendation[]> {
  const seedList = seeds
    .map((s) => {
      let line = `- "${s.title}"${s.artist ? ` by ${s.artist}` : ""}`;
      if (s.youtubeTitle) {
        line += `\n  YouTube match: "${s.youtubeTitle}" by ${s.youtubeArtist || "Unknown"}`;
      }
      return line;
    })
    .join("\n");

  // Build context sections
  let contextSections = "";

  if (context?.likedSongs?.length) {
    contextSections += `\n## Songs This User Has Liked Before (use as POSITIVE signal — recommend more like these)
${context.likedSongs.map((s) => `- "${s.title}" by ${s.artist}`).join("\n")}
`;
  }

  if (context?.dislikedSongs?.length) {
    contextSections += `\n## Songs This User Disliked (use as NEGATIVE signal — avoid this style/vibe)
${context.dislikedSongs.map((s) => `- "${s.title}" by ${s.artist}`).join("\n")}
`;
  }

  if (context?.recentListens?.length) {
    contextSections += `\n## What They've Been Listening To Recently
${context.recentListens.map((s) => `- "${s.title}" by ${s.artist}`).join("\n")}
`;
  }

  if (context?.topArtists?.length) {
    contextSections += `\n## Their Most-Played Artists
${context.topArtists.map((a) => `- ${a.artist} (${a.count} plays)`).join("\n")}
`;
  }

  if (context?.preferences) {
    const p = context.preferences;
    contextSections += `\n## User Preferences
- Favorite genres: ${p.genres.length > 0 ? p.genres.join(", ") : "Not specified"}
- Current mood: ${p.mood || "Not specified"}
- Discovery level: ${p.discoveryLevel}/100 (0=stick to what I know, 100=surprise me)
${p.excludeArtists.length > 0 ? `- DO NOT recommend these artists: ${p.excludeArtists.join(", ")}` : ""}
`;
  }

  let avoidSection = "";
  if (context?.previouslyRecommended?.length) {
    avoidSection = `\n## DO NOT RECOMMEND (already recommended before)
${context.previouslyRecommended.map((s) => `- ${s}`).join("\n")}
`;
  }

  const requestCount = 20; // Over-generate, verification will filter to final count

  let candidateSection = "";
  if (candidates?.length) {
    const candidateList = candidates
      .slice(0, 80)
      .map((c) => `- "${c.title}" by ${c.artist} (similarity: ${(c.matchScore * 100).toFixed(0)}%)`)
      .join("\n");
    candidateSection = `\n## Verified Similar Songs (from collaborative listening data)
These songs are confirmed similar to the seeds based on REAL listener behavior on Last.fm.
You MUST select at least ${Math.min(Math.ceil(requestCount * 0.7), candidates.length)} of your recommendations from this list.
These are VERIFIED REAL songs — prioritize them heavily.
You may include up to 3 wildcards not on this list, but ONLY if you are 100% certain they are real, commercially released songs with the EXACT correct title and artist spelling.

${candidateList}
`;
  }

  const prompt = `A user wants music recommendations based on these seed songs:

${seedList}

IMPORTANT: Use the "YouTube match" line (if present) to identify the ACTUAL song. The user may have misspelled the title or artist — the YouTube match shows what song they actually mean. Base your recommendations on the REAL song, not a literal interpretation of the user's text.
${candidateSection}${contextSections}${avoidSection}
## Your Analysis Process
First, analyze the seeds carefully:
1. What SPECIFIC sonic qualities connect these songs? (not just "rock" — think: "fuzzy guitar tone with reverb-heavy vocals and a driving 4/4 beat at ~120 BPM")
2. What emotional territory do they occupy? (not just "sad" — think: "bittersweet nostalgia with an undercurrent of hope")
3. What era/scene/movement do they connect to?
4. What would someone who loves these songs be searching for but can't quite find?
${context?.likedSongs?.length ? "\n5. Cross-reference with their liked songs — what patterns emerge? Double down on those qualities." : ""}
${context?.dislikedSongs?.length ? "\n6. Cross-reference with their disliked songs — what should you actively AVOID?" : ""}

## Recommendation Strategy
Generate exactly ${requestCount} recommendations.${candidates?.length ? `
- At least ${Math.min(Math.ceil(requestCount * 0.7), candidates.length)} MUST come from the Verified Similar Songs list above
- Up to 3 can be wildcards NOT on the list (but must be real songs you're certain exist)
- For songs from the verified list, use the EXACT title and artist spelling shown` : `
- 5-7 songs: **Deep cuts** from artists adjacent to the seeds (B-sides, album tracks, not singles)
- 4-5 songs: **Lesser-known artists** in the same sonic space
- 3-4 songs: **Cross-genre gems** that share the same emotional DNA
- 2-3 songs: **Classic tracks** the user genuinely might have missed`}

## Hard Rules
- Every song MUST actually exist — real title, real artist, real release. Use EXACT official spelling.
- NEVER invent or guess at song titles. If you can't recall the exact title, skip it.
- NEVER recommend the seed songs themselves
- NEVER recommend songs from the "already recommended" list above
- Match the ENERGY and MOOD, not just the genre
- The reason MUST reference a specific musical quality shared with the seeds
- Confidence: 0.85+ = "you will love this", 0.7-0.85 = "strong match", 0.55-0.7 = "adventurous but trust me"

Respond with a JSON array of objects: title (string), artist (string), album (string, optional), reason (string, 1-2 sentences with specific musical qualities), confidence_score (number 0-1).

Return ONLY the JSON array, no other text.`;

  return callAI(prompt, requestCount);
}
