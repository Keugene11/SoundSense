import { anthropic } from "./client";
import type { ListeningHistoryEntry, UserPreferences } from "@/types/database";

interface AIRecommendation {
  title: string;
  artist: string;
  album?: string;
  reason: string;
  confidence_score: number;
}

interface SeedContext {
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
- Never recommend the seed songs themselves.
- NEVER recommend ANY song by a seed artist. If the user gives you "Toxicity" by System of a Down, do NOT recommend other System of a Down songs. The user already knows that artist — show them something NEW.`;

async function callAI(prompt: string, count: number): Promise<AIRecommendation[]> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 6000,
    system: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const content = textBlock?.text?.trim();
  if (!content) throw new Error("No response from AI");

  const cleaned = content.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
  const recommendations: AIRecommendation[] = JSON.parse(cleaned);

  // Sort by confidence, deduplicate artists (keep highest-confidence per artist)
  recommendations.sort((a, b) => b.confidence_score - a.confidence_score);
  const seenArtists = new Set<string>();
  const deduped = recommendations.filter((r) => {
    const key = r.artist.toLowerCase();
    if (seenArtists.has(key)) return false;
    seenArtists.add(key);
    return true;
  });
  return deduped.slice(0, count);
}

export async function generateRecommendations(
  history: ListeningHistoryEntry[],
  preferences: UserPreferences,
  _count: number = 10,
  candidates?: CandidateTrack[],
  similarArtists?: string[],
  genreTags?: string[]
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

  const requestCount = 10;

  let candidateSection = "";
  if (candidates?.length) {
    const candidateList = candidates
      .slice(0, 40)
      .map((c) => `- "${c.title}" by ${c.artist} (similarity: ${(c.matchScore * 100).toFixed(0)}%)`)
      .join("\n");
    candidateSection = `\n## Verified Similar Songs (from collaborative listening data)
These songs are confirmed similar based on REAL listener behavior on Last.fm.
These are VERIFIED REAL songs — you may pick from this list, but ONLY if they match the user's genre and style.
Do NOT pick songs from this list that don't fit the genre/mood — genre match is more important than being on this list.
Any picks from this list must use the EXACT title and artist spelling shown.

${candidateList}
`;
  }

  let similarArtistsSection = "";
  if (similarArtists?.length) {
    similarArtistsSection = `\n## Similar Artists (from TasteDive and ListenBrainz)
Use these as inspiration — but only if they fit the genre and style:
${similarArtists.slice(0, 30).map((a) => `- ${a}`).join("\n")}
`;
  }

  let genreSection = "";
  if (genreTags?.length) {
    genreSection = `\n## Genre DNA (from Last.fm tags)
These tags describe the user's core sound — every recommendation MUST fit within or adjacent to these genres:
${genreTags.map((t) => `- ${t}`).join("\n")}
Use these tags as your PRIMARY filter. If a song doesn't match this sonic territory, don't recommend it.
`;
  }

  const prompt = `Based on the user's listening history and preferences, suggest ${requestCount} songs they would enjoy.

## User Preferences
- Favorite genres: ${preferences.favorite_genres.length > 0 ? preferences.favorite_genres.join(", ") : "Not specified"}
- Mood: ${preferences.mood}
- Discovery level: ${preferences.discovery_level}/100 (0=very familiar, 100=very adventurous)
- Excluded artists: ${preferences.exclude_artists.length > 0 ? preferences.exclude_artists.join(", ") : "None"}
${genreSection}
## Top Artists (by play count)
${topArtists.map((a) => `- ${a.name} (${a.count} plays)`).join("\n")}

## Recent Listening History
${recentTracks.map((t) => `- "${t.title}" by ${t.artist}${t.album ? ` (${t.album})` : ""}`).join("\n")}
${candidateSection}${similarArtistsSection}
## Instructions
- Suggest ${requestCount} songs the user would likely enjoy
- GENRE MATCH IS THE #1 PRIORITY — every song must fit the user's genre/style profile
- Mix familiar artists with new discoveries based on discovery_level
- Do NOT recommend songs already in their history
- Do NOT recommend songs by excluded artists
- Do NOT recommend songs by the user's top artists — they already know those. Show them something NEW.
- Maximum 1 song per artist — show variety
- Every song MUST actually exist — use EXACT official title and artist spelling
- NEVER invent or guess at song titles. If you can't recall the exact title, skip it.
- Each reason must describe what the song DOES musically, naming 2-3 concrete elements (BPM, key, chord types, production effects, instrument tones, vocal techniques). Do NOT use comparison clichés like "reminiscent of", "akin to", "similar to".
- Confidence: 0.85+ = "you will love this", 0.7-0.85 = "strong match", 0.55-0.7 = "adventurous pick"

Respond with a JSON array of objects: title (string), artist (string), album (string, optional), reason (string, 1-2 sentences naming specific musical elements), confidence_score (number 0-1).

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
  _count: number = 10,
  context?: SeedContext,
  candidates?: CandidateTrack[],
  similarArtists?: string[],
  genreTags?: string[]
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

  const requestCount = 10;

  let candidateSection = "";
  if (candidates?.length) {
    const candidateList = candidates
      .slice(0, 40)
      .map((c) => `- "${c.title}" by ${c.artist} (similarity: ${(c.matchScore * 100).toFixed(0)}%)`)
      .join("\n");
    candidateSection = `\n## Verified Similar Songs (from collaborative listening data)
These songs are confirmed similar to the seeds based on REAL listener behavior on Last.fm.
These are VERIFIED REAL songs — you may pick from this list, but ONLY if they match the genre and style of the seeds.
Do NOT pick songs from this list that don't fit the genre/mood — genre match is more important than being on this list.
Any picks from this list must use the EXACT title and artist spelling shown.

${candidateList}
`;
  }

  let similarArtistsSection = "";
  if (similarArtists?.length) {
    similarArtistsSection = `\n## Similar Artists (from TasteDive and ListenBrainz)
Use these as inspiration — but only if they fit the genre and style of the seeds:
${similarArtists.slice(0, 30).map((a) => `- ${a}`).join("\n")}
`;
  }

  let genreSection = "";
  if (genreTags?.length) {
    genreSection = `\n## Genre DNA (from Last.fm tags for the seed songs)
These tags describe the seeds' core sound — every recommendation MUST fit within or adjacent to these genres:
${genreTags.map((t) => `- ${t}`).join("\n")}
Use these tags as your PRIMARY filter. If a song doesn't match this sonic territory, don't recommend it.
`;
  }

  // Extract ALL artists from seeds, splitting collabs like "Tainy, Bad Bunny, Julieta Venegas"
  const seedArtists = [...new Set(
    seeds
      .flatMap((s) => {
        if (!s.artist) return [];
        // Split on common collaboration delimiters
        return s.artist
          .split(/(?:,\s*|\s+(?:feat\.?|ft\.?|x|&|and|with|y)\s+)/i)
          .map((a) => a.trim())
          .filter(Boolean);
      })
  )];
  const bannedArtistsLine = seedArtists.length > 0
    ? `\n## BANNED ARTISTS (do NOT recommend any song by these artists — not even as a featured artist):\n${seedArtists.map((a) => `- ${a}`).join("\n")}\nThe user already knows these artists. Recommending their other songs is lazy curation. Show the user something NEW. This includes songs where they appear as a featured artist (feat.), collaborator, or under any variation of their name.\n`
    : "";

  const prompt = `A user wants music recommendations based on these seed songs:

${seedList}

IMPORTANT: Use the "YouTube match" line (if present) to identify the ACTUAL song. The user may have misspelled the title or artist — the YouTube match shows what song they actually mean. Base your recommendations on the REAL song, not a literal interpretation of the user's text.
${bannedArtistsLine}${genreSection}${candidateSection}${similarArtistsSection}${contextSections}${avoidSection}
## Your Analysis Process
First, analyze the seeds carefully:
1. What SPECIFIC sonic qualities connect these songs? (not just "rock" — think: "fuzzy guitar tone with reverb-heavy vocals and a driving 4/4 beat at ~120 BPM")
2. What emotional territory do they occupy? (not just "sad" — think: "bittersweet nostalgia with an undercurrent of hope")
3. What era/scene/movement do they connect to?
4. If the seeds span different genres/languages/eras, what is the BRIDGE between them? Find songs that live at that intersection — don't just recommend from each genre separately.
5. What would someone who loves ALL of these songs be searching for but can't quite find?

## Recommendation Strategy
Generate exactly ${requestCount} recommendations.
IMPORTANT: Genre and style match is the #1 priority. Every song must sound like it belongs in the same playlist as the seeds.${candidates?.length ? `
- You may pick from the Verified Similar Songs list, but ONLY ones that match the genre/style of the seeds
- For songs from the verified list, use the EXACT title and artist spelling shown
- All other picks should be songs you're certain exist and that match the seeds' genre` : `
- 5-7 songs: **Deep cuts** — album tracks, B-sides, or lesser-known singles. AVOID mega-hits with 500M+ streams.
- 4-5 songs: **Lesser-known artists** in the same sonic space (artists most people haven't heard of)
- 3-4 songs: **Cross-genre gems** that share the same emotional DNA but come from a totally different genre
- 2-3 songs: **Wildcards** — surprising picks that share a subtle quality with the seeds`}

## Hard Rules
- Every song MUST actually exist — real title, real artist, real release. Use EXACT official spelling. Double-check that the title belongs to the artist you're crediting — do NOT attribute a song to the wrong artist.
- NEVER invent or guess at song titles. If you can't recall the EXACT title AND the correct artist, skip it.
- NEVER recommend the seed songs themselves
- NEVER recommend ANY song by ANY of the seed artists. The user already knows those artists. Zero exceptions.
- NEVER recommend songs from the "already recommended" list above
- Maximum 1 song per artist in your recommendations. Every recommendation should be from a DIFFERENT artist.
- Match the ENERGY and MOOD, not just the genre
- Each reason must describe what the song DOES musically, naming 2-3 concrete elements (e.g., BPM, key, chord types, production effects, instrument tones, vocal techniques, rhythmic patterns). Do NOT use comparison clichés like "reminiscent of", "akin to", "echoing", "similar to". Example: "Layers warm Rhodes piano over a shuffling 6/8 drum pattern at ~90 BPM, with breathy falsetto vocals that float above lush string arrangements."
- Confidence: 0.85+ = "you will love this", 0.7-0.85 = "strong match", 0.55-0.7 = "adventurous but trust me"

Respond with a JSON array of objects: title (string), artist (string), album (string, optional), reason (string, 1-2 sentences naming specific musical elements), confidence_score (number 0-1).

Return ONLY the JSON array, no other text.`;

  const results = await callAI(prompt, requestCount);

  // Safety net: programmatically filter out any seed artist songs that leaked through
  const seedArtistSet = new Set(seedArtists.map((a) => a.toLowerCase()));
  return results.filter((r) => {
    // Split the recommendation's artist field too, in case it's a collab
    const recArtists = r.artist
      .split(/(?:,\s*|\s+(?:feat\.?|ft\.?|x|&|and|with|y)\s+)/i)
      .map((a) => a.trim().toLowerCase());
    return !recArtists.some((a) => seedArtistSet.has(a));
  });
}
