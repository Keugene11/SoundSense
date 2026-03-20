# SoundSense Recommendation Prompt Improvement — Final Summary

**Date:** 2026-03-02
**Duration:** ~12 iterations over ~1 hour
**Files modified:** `src/lib/dedalus/recommendations.ts`, `scripts/eval-recommendations.ts`

## Starting vs Ending Metrics

| Metric | Baseline | Final (avg of last 3 runs) | Change |
|--------|----------|---------------------------|--------|
| Seed ARTIST leaks | 16 | 0-1 | -94% to -100% |
| Generic reasons | 13 | 1-3 | -77% to -92% |
| Artist diversity | 89% | 94-97% | +5-8% |
| Reason avg length | 152 chars | 148-153 chars | Stable |
| Avg confidence | 0.82 | 0.80-0.81 | Stable |
| Duplicates | 0 | 0 | Maintained |
| Seed SONG leaks | 0 | 0 | Maintained |

## What Changed

### 1. Explicit Seed Artist Ban (Iterations 1-2)
**Impact: Massive** — Reduced seed artist leaks from 16 to 2.
- Added rule to SYSTEM_PROMPT: "NEVER recommend ANY song by a seed artist"
- Added dynamic `BANNED ARTISTS` section to generateFromSeeds that lists seed artists by name
- Added programmatic post-filter in generateFromSeeds as a safety net

### 2. Positive Reason Template (Iterations 3-4, 8-9)
**Impact: Major** — Reduced generic reasons from 13 to 1-3.
- Started by banning specific phrases ("similar vibe", "reminiscent of", etc.)
- Found the model just substituted with "akin to", "echoing"
- **Breakthrough:** Giving a positive example template was far more effective than banning phrases
- Final instruction: "describe what the song DOES musically, naming 2-3 concrete elements (BPM, key, chord types...)"
- Added rich example: "Layers warm Rhodes piano over a shuffling 6/8 drum pattern at ~90 BPM..."

### 3. Artist Dedup in callAI (Iteration 7)
**Impact: Medium** — Eliminated duplicate-artist recommendations.
- Added programmatic dedup: keep highest-confidence song per artist
- Works as safety net alongside prompt-level "max 1 per artist" rule

### 4. Cross-Genre Bridging (Iteration 6)
**Impact: Medium** — Better recommendations for mixed-genre seeds.
- Added analysis step: "what is the BRIDGE between different-genre seeds?"
- Cross-language test (Aloe Blacc + Tainy) now produces Latin artists alongside English ones
- Shifted distribution toward deep cuts and lesser-known artists

### 5. Attribution Accuracy (Iteration 12)
**Impact: Small** — Reduced risk of song misattribution.
- Added "double-check that the title belongs to the artist you're crediting"

### 6. generateRecommendations Alignment (Iteration 11)
**Impact: Medium** — Improved history-based recs too.
- Applied same reason template and confidence calibration to the listening-history prompt

## What Worked

1. **Explicit, named bans** beat generic rules. Listing banned artists by name was far more effective than saying "don't recommend seed artists."
2. **Positive examples** beat negative restrictions. Showing the model what a good reason looks like worked better than listing banned phrases.
3. **Programmatic safety nets** catch what prompts miss. The artist dedup filter and seed-artist post-filter provide reliable guarantees.
4. **Small, targeted changes** let me measure each improvement. Single-variable changes made it clear what helped and what didn't.

## What Didn't Work

1. **Banning specific phrases** in reasons — the model just used synonyms ("akin to" instead of "reminiscent of")
2. **Adding reason guidance to the system prompt** — better in the user prompt where it's closer to the output
3. **"Max 1 per artist" as prompt-only** — not reliable enough without programmatic enforcement

## Remaining Issues

1. **Daniel Caesar leaks** in ~30% of R&B tests despite the ban. The model strongly associates him with the R&B seed songs. The post-filter catches this in production.
2. **Potential hallucinated songs** — LLMs can't reliably verify song existence. The production candidate list from Last.fm mitigates this for 50% of recommendations; wildcards remain at risk.
3. **Reason length slightly decreased** (152 → 148-153) — the positive template produces tighter, more specific reasons but they're slightly shorter. Quality is higher despite lower char count.
4. **Confidence scores may not be perfectly calibrated** — the model tends to cluster in 0.75-0.85 range regardless of actual match quality.

## Recommendations for Future Improvements

1. **Song existence verification** — Add a post-processing step that verifies recommended songs against MusicBrainz or Spotify API before returning results.
2. **A/B testing with real users** — Automated metrics can only go so far. Real user feedback on recommendation quality would be invaluable.
3. **Few-shot examples** — Include 2-3 complete input/output examples in the prompt showing ideal recommendations with perfect reasons.
4. **Temperature tuning per genre** — Metal/rock tests show lower diversity; slightly higher temperature (0.6) for these genres could help.
5. **Reason deduplication** — Some reasons across different test cases follow the same formulaic structure ("Features X with Y at Z BPM"). Adding variety instructions could help.

## Commits Made

1. `586708f` - Reduce seed artist leakage with explicit banned artists list
2. `1249c1f` - Improve reason specificity and add seed artist post-filter
3. `dcd0e31` - Improve cross-genre bridging and push for deeper cuts
4. `5d9b0d6` - Add positive reason template and artist dedup in callAI
5. `8acc9cb` - Add rich example to reason template for more specific musical details
6. `1e9c575` - Align generateRecommendations prompt with improved reason quality
7. `3247b08` - Strengthen song attribution accuracy for wildcard recommendations
