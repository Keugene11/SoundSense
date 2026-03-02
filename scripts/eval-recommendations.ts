/**
 * Standalone evaluation script for SoundSense recommendations.
 * Calls the Dedalus API directly with test seed songs, then evaluates quality.
 *
 * Usage: npx tsx scripts/eval-recommendations.ts
 *
 * Requires .env.local with DEDALUS_API_KEY and DEDALUS_BASE_URL
 */

import "dotenv/config";
import { config } from "dotenv";
import { resolve } from "path";
import OpenAI from "openai";
import fs from "fs";

// Load .env.local
config({ path: resolve(__dirname, "../.env.local") });

const dedalus = new OpenAI({
  apiKey: process.env.DEDALUS_API_KEY!,
  baseURL: process.env.DEDALUS_BASE_URL || "https://api.dedaluslabs.ai/v1",
});

// Test cases from the specified test songs
const TEST_CASES: { name: string; seeds: { title: string; artist: string }[] }[] = [
  // === SINGLE SEED TESTS ===
  {
    name: "Single: Misery (pop-rock)",
    seeds: [{ title: "Misery", artist: "Maroon 5" }],
  },
  {
    name: "Single: Crystals (electronic)",
    seeds: [{ title: "Crystals", artist: "Isolate.exe" }],
  },
  {
    name: "Single: Lover Girl (jazz-pop)",
    seeds: [{ title: "Lover Girl", artist: "Laufey" }],
  },
  {
    name: "Single: Toxicity (metal)",
    seeds: [{ title: "Toxicity", artist: "System of a Down" }],
  },
  // === MULTI-SEED COMBOS ===
  {
    name: "Pop-Rock meets Electronic",
    seeds: [
      { title: "Misery", artist: "Maroon 5" },
      { title: "Crystals", artist: "Isolate.exe" },
    ],
  },
  {
    name: "Smooth/Jazzy Pop",
    seeds: [
      { title: "Sunday Morning", artist: "Maroon 5" },
      { title: "Lover Girl", artist: "Laufey" },
    ],
  },
  {
    name: "Confidence Anthems Cross-Language",
    seeds: [
      { title: "The Man", artist: "Aloe Blacc" },
      { title: "Lo Siento BB", artist: "Tainy" },
    ],
  },
  {
    name: "Soulful Vibes",
    seeds: [
      { title: "Pink + White", artist: "Frank Ocean" },
      { title: "I Thought I Saw Your Face Today", artist: "Stevie Wonder" },
    ],
  },
  {
    name: "Electronic/Synth",
    seeds: [
      { title: "Midnight City", artist: "M83" },
      { title: "Crystals", artist: "Isolate.exe" },
    ],
  },
  {
    name: "Heavy/Dark Rock",
    seeds: [
      { title: "Toxicity", artist: "System of a Down" },
      { title: "Do I Wanna Know?", artist: "Arctic Monkeys" },
    ],
  },
  {
    name: "Romantic/Mellow",
    seeds: [
      { title: "Best Part", artist: "Daniel Caesar" },
      { title: "Lover Girl", artist: "Laufey" },
      { title: "Sunday Morning", artist: "Maroon 5" },
    ],
  },
  {
    name: "R&B / Soul",
    seeds: [
      { title: "Best Part", artist: "Daniel Caesar" },
      { title: "Pink + White", artist: "Frank Ocean" },
    ],
  },
  {
    name: "Synth-Pop / Retro",
    seeds: [
      { title: "Blinding Lights", artist: "The Weeknd" },
      { title: "Midnight City", artist: "M83" },
    ],
  },
  {
    name: "Alt-Rock / Psychedelic",
    seeds: [
      { title: "Comfortably Numb", artist: "Pink Floyd" },
      { title: "Boredom", artist: "Tyler, the Creator" },
    ],
  },
];

interface Recommendation {
  title: string;
  artist: string;
  album?: string;
  reason: string;
  confidence_score: number;
}

interface EvalResult {
  testCase: string;
  seeds: { title: string; artist: string }[];
  recommendations: Recommendation[];
  metrics: {
    count: number;
    avgConfidence: number;
    uniqueArtists: number;
    artistDiversityRatio: number;
    hasReasons: boolean;
    containsSeedArtists: string[];
    containsSeedSongs: string[];
    duplicates: string[];
    suspiciouslyGeneric: string[];
    reasonAvgLength: number;
  };
  timestamp: string;
}

// Read the current system prompt and generateFromSeeds prompt from source
function getCurrentPromptVersion(): string {
  const src = fs.readFileSync(
    resolve(__dirname, "../src/lib/dedalus/recommendations.ts"),
    "utf-8"
  );
  let hash = 0;
  for (let i = 0; i < src.length; i++) {
    const chr = src.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString(16);
}

// Extract system prompt and build the eval prompt to match generateFromSeeds
function buildPrompts(srcFile: string): { systemPrompt: string } {
  const systemPromptMatch = srcFile.match(
    /const SYSTEM_PROMPT = `([\s\S]*?)`;/
  );
  const systemPrompt = systemPromptMatch
    ? systemPromptMatch[1]
    : "You are a music recommendation engine.";
  return { systemPrompt };
}

async function runTestCase(
  testCase: (typeof TEST_CASES)[number],
  systemPrompt: string
): Promise<EvalResult> {
  const seedList = testCase.seeds
    .map((s) => `- "${s.title}" by ${s.artist}`)
    .join("\n");

  const seedArtists = [...new Set(testCase.seeds.map((s) => s.artist))];
  const bannedArtistsLine = seedArtists.length > 0
    ? `\n## BANNED ARTISTS (do NOT recommend any song by these artists — not even as a featured artist):\n${seedArtists.map((a) => `- ${a}`).join("\n")}\nThe user already knows these artists. Recommending their other songs is lazy curation. Show the user something NEW. This includes songs where they appear as a featured artist (feat.), collaborator, or under any variation of their name.\n`
    : "";

  const requestCount = 10;

  // Build prompt to match generateFromSeeds pattern (no candidates/context for eval)
  const prompt = `A user wants music recommendations based on these seed songs:

${seedList}
${bannedArtistsLine}
## Your Analysis Process
First, analyze the seeds carefully:
1. What SPECIFIC sonic qualities connect these songs? (not just "rock" — think: "fuzzy guitar tone with reverb-heavy vocals and a driving 4/4 beat at ~120 BPM")
2. What emotional territory do they occupy? (not just "sad" — think: "bittersweet nostalgia with an undercurrent of hope")
3. What era/scene/movement do they connect to?
4. What would someone who loves these songs be searching for but can't quite find?

## Recommendation Strategy
Generate exactly ${requestCount} recommendations.
- 3-4 songs: **Deep cuts** from artists adjacent to the seeds (B-sides, album tracks, not singles)
- 2-3 songs: **Lesser-known artists** in the same sonic space
- 2-3 songs: **Cross-genre gems** that share the same emotional DNA
- 1-2 songs: **Classic tracks** the user genuinely might have missed

## Hard Rules
- Every song MUST actually exist — real title, real artist, real release. Use EXACT official spelling.
- NEVER invent or guess at song titles. If you can't recall the exact title, skip it.
- NEVER recommend the seed songs themselves
- NEVER recommend ANY song by ANY of the seed artists. The user already knows those artists. Zero exceptions.
- NEVER recommend songs from the "already recommended" list above
- Match the ENERGY and MOOD, not just the genre
- Each reason MUST name at least ONE specific musical element (e.g., tempo, chord voicings, production technique, instrument tone, vocal style, rhythmic pattern). NEVER use vague phrases like "similar vibe", "fans of X will enjoy", "if you like", "in the same vein", or "reminiscent of".
- Confidence: 0.85+ = "you will love this", 0.7-0.85 = "strong match", 0.55-0.7 = "adventurous but trust me"

Respond with a JSON array of objects: title (string), artist (string), album (string, optional), reason (string, 1-2 sentences naming specific musical elements), confidence_score (number 0-1).

Return ONLY the JSON array, no other text.`;

  const response = await dedalus.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: 0.5,
    max_tokens: 6000,
  });

  const content = response.choices[0]?.message?.content?.trim() || "[]";
  const cleaned = content.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
  const recommendations: Recommendation[] = JSON.parse(cleaned);

  // Compute metrics
  const seedArtistsLower = testCase.seeds.map((s) => s.artist.toLowerCase());
  const seedTitles = testCase.seeds.map(
    (s) => `${s.title.toLowerCase()}|||${s.artist.toLowerCase()}`
  );
  const recKeys = recommendations.map(
    (r) => `${r.title.toLowerCase()}|||${r.artist.toLowerCase()}`
  );

  const containsSeedArtists = recommendations
    .filter((r) => seedArtistsLower.includes(r.artist.toLowerCase()))
    .map((r) => `${r.title} - ${r.artist}`);

  const containsSeedSongs = recommendations
    .filter((r) =>
      seedTitles.includes(`${r.title.toLowerCase()}|||${r.artist.toLowerCase()}`)
    )
    .map((r) => `${r.title} - ${r.artist}`);

  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const key of recKeys) {
    if (seen.has(key)) duplicates.push(key);
    seen.add(key);
  }

  // Flag suspiciously generic reasons
  const genericPhrases = [
    "you might enjoy",
    "similar vibe",
    "same genre",
    "fans of",
    "if you like",
    "similar feel",
    "in the same vein",
    "reminiscent of",
  ];
  const suspiciouslyGeneric = recommendations
    .filter((r) =>
      genericPhrases.some((p) => r.reason.toLowerCase().includes(p))
    )
    .map((r) => `${r.title}: "${r.reason}"`);

  const uniqueArtists = new Set(recommendations.map((r) => r.artist.toLowerCase())).size;
  const reasonAvgLength = recommendations.reduce((sum, r) => sum + (r.reason?.length || 0), 0) / (recommendations.length || 1);

  return {
    testCase: testCase.name,
    seeds: testCase.seeds,
    recommendations,
    metrics: {
      count: recommendations.length,
      avgConfidence:
        recommendations.reduce((sum, r) => sum + r.confidence_score, 0) /
        (recommendations.length || 1),
      uniqueArtists,
      artistDiversityRatio: uniqueArtists / (recommendations.length || 1),
      hasReasons: recommendations.every(
        (r) => r.reason && r.reason.length > 20
      ),
      containsSeedArtists,
      containsSeedSongs,
      duplicates,
      suspiciouslyGeneric,
      reasonAvgLength,
    },
    timestamp: new Date().toISOString(),
  };
}

async function main() {
  const promptVersion = getCurrentPromptVersion();
  const srcFile = fs.readFileSync(
    resolve(__dirname, "../src/lib/dedalus/recommendations.ts"),
    "utf-8"
  );
  const { systemPrompt } = buildPrompts(srcFile);

  console.log(`\n=== SoundSense Recommendation Eval ===`);
  console.log(`Prompt version: ${promptVersion}`);
  console.log(`Running ${TEST_CASES.length} test cases...\n`);

  const results: EvalResult[] = [];

  // Run sequentially to avoid rate limits
  for (const testCase of TEST_CASES) {
    console.log(`Testing: ${testCase.name}...`);
    try {
      const result = await runTestCase(testCase, systemPrompt);
      results.push(result);

      // Print summary
      const m = result.metrics;
      console.log(
        `  ✓ ${m.count} recs | avg conf: ${m.avgConfidence.toFixed(2)} | ${m.uniqueArtists} unique artists (${(m.artistDiversityRatio * 100).toFixed(0)}%) | reason len: ${m.reasonAvgLength.toFixed(0)}`
      );
      if (m.containsSeedSongs.length > 0)
        console.log(`  ⚠ SEED SONGS leaked: ${m.containsSeedSongs.join(", ")}`);
      if (m.containsSeedArtists.length > 0)
        console.log(`  ⚠ Seed ARTISTS leaked: ${m.containsSeedArtists.join(", ")}`);
      if (m.duplicates.length > 0)
        console.log(`  ⚠ Duplicates: ${m.duplicates.join(", ")}`);
      if (m.suspiciouslyGeneric.length > 0)
        console.log(`  ⚠ Generic reasons: ${m.suspiciouslyGeneric.length}`);
      if (!m.hasReasons) console.log(`  ⚠ Some recommendations missing detailed reasons`);
    } catch (err) {
      console.log(`  ✗ Failed: ${err}`);
    }
  }

  // Write results to file
  const outDir = resolve(__dirname, "../.claude/eval-results");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outFile = resolve(
    outDir,
    `eval-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  fs.writeFileSync(outFile, JSON.stringify({ promptVersion, results }, null, 2));
  console.log(`\nResults saved to: ${outFile}`);

  // Print overall summary
  console.log(`\n=== Overall Summary ===`);
  const totalRecs = results.reduce((s, r) => s + r.metrics.count, 0);
  const avgConf =
    results.reduce((s, r) => s + r.metrics.avgConfidence, 0) / results.length;
  const totalSeedArtistLeaks = results.reduce(
    (s, r) => s + r.metrics.containsSeedArtists.length, 0
  );
  const totalSeedSongLeaks = results.reduce(
    (s, r) => s + r.metrics.containsSeedSongs.length, 0
  );
  const totalDuplicates = results.reduce(
    (s, r) => s + r.metrics.duplicates.length, 0
  );
  const totalGeneric = results.reduce(
    (s, r) => s + r.metrics.suspiciouslyGeneric.length, 0
  );
  const avgDiversity = results.reduce(
    (s, r) => s + r.metrics.artistDiversityRatio, 0
  ) / results.length;
  const avgReasonLen = results.reduce(
    (s, r) => s + r.metrics.reasonAvgLength, 0
  ) / results.length;

  console.log(`Total recommendations: ${totalRecs}`);
  console.log(`Average confidence: ${avgConf.toFixed(2)}`);
  console.log(`Average artist diversity: ${(avgDiversity * 100).toFixed(0)}%`);
  console.log(`Average reason length: ${avgReasonLen.toFixed(0)} chars`);
  console.log(`Seed SONG leaks: ${totalSeedSongLeaks}`);
  console.log(`Seed ARTIST leaks: ${totalSeedArtistLeaks}`);
  console.log(`Duplicates: ${totalDuplicates}`);
  console.log(`Generic reasons: ${totalGeneric}`);
}

main().catch(console.error);
