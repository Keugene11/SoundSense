# SoundSense Recommendation Prompt Improvement Log

## Baseline (Pre-iteration)
- **Prompt version:** -7031b73b
- **Total recommendations:** 140 (14 test cases × 10)
- **Average confidence:** 0.82
- **Average artist diversity:** 89%
- **Average reason length:** 152 chars
- **Seed SONG leaks:** 0
- **Seed ARTIST leaks:** 16 (MAJOR ISSUE)
- **Duplicates:** 0
- **Generic reasons:** 13

### Key Issues Identified:
1. Seed artist leakage is the #1 problem (16 leaks across 5 test cases)
   - Toxicity test: 4 SOAD songs leaked
   - R&B/Soul: 4 Daniel Caesar + Frank Ocean songs leaked
   - Alt-Rock/Psychedelic: 4 Pink Floyd + Tyler songs leaked
   - Electronic/Synth: 2 M83 songs leaked
   - Heavy/Dark Rock: SOAD + Arctic Monkeys leaked
2. Generic reasons (13 total) using phrases like "similar vibe", "reminiscent of"
3. Artist diversity drops to 50% on Toxicity single-seed test

---

## Iteration 1-2: Explicit Seed Artist Ban
**Changes:**
1. Added rule to SYSTEM_PROMPT: "NEVER recommend ANY song by a seed artist"
2. Added dynamic `BANNED ARTISTS` section to generateFromSeeds prompt listing seed artists explicitly
3. Updated generateRecommendations to ban top artists
4. Updated Hard Rules to ban seed artists with "Zero exceptions"
5. Added reason quality example in Hard Rules

**Results:**
- Seed ARTIST leaks: 16 → 2 (87.5% reduction!)
- Artist diversity: 89% → 95%
- Average confidence: 0.82 → 0.81 (stable)
- Generic reasons: 13 → 14 (slight regression, need to address)
- Only Daniel Caesar still leaking in R&B/Soul test

---

## Iteration 3-4: Reason Quality + Post-Filter
**Changes:**
1. Added specific musical element requirement in Hard Rules (tempo, chord voicings, production, etc.)
2. Banned vague phrases explicitly: "similar vibe", "fans of X", "if you like", "in the same vein", "reminiscent of"
3. Added programmatic post-filter in generateFromSeeds to catch leaked seed artists

**Results:**
- Generic reasons: 14 → 10 (improvement!)
- Reason avg length: 148 → 160 chars (improvement!)
- Seed ARTIST leaks via prompt: varied (but post-filter catches these in production)

---

## Iteration 5-6: Cross-Genre Bridging + Deep Cuts
**Changes:**
1. Added analysis step: "what is the BRIDGE between different-genre seeds?"
2. Shifted distribution away from mega-hits toward deep cuts and lesser-known artists
3. Added "max 1 song per artist" rule in Hard Rules

**Results:**
- Seed artist leaks: down to 4 (from best of 2, with variance)
- Generic reasons: 8 (from 13 baseline)
- Reason length: 166 (from 152 baseline)
- Artist diversity: 94%
- Cross-language test now includes Latin artists (Ozuna, Celso Piña, Romeo Santos)

---

## Iteration 7-8: Positive Reason Template + Artist Dedup
**Changes:**
1. Added programmatic artist dedup in callAI (keep highest-confidence per artist)
2. Replaced banned-phrase list with positive reason template: "Features [element] that connects to..."
3. Added "echoing" and "akin to" to eval detection
4. Expanded banned comparison words

**Results (BEST RUN):**
- Seed ARTIST leaks: **0** (from 16 baseline!)
- Generic reasons: **8** (with expanded detection)
- Duplicates: **0**
- Artist diversity: **97%** (from 89% baseline)
- Reason length: 131 (shorter but more specific)
- Average confidence: 0.80

---

## Iteration 9: Rich Reason Example
**Changes:**
1. Added detailed example in reason instruction showing BPM, instrument tones, production elements

**Results (BEST SINGLE RUN):**
- Generic reasons: **1** (from 13 baseline!)
- All other metrics stable/improved

---

## Iteration 10: Consistency Check
- Ran eval again without changes to verify stability
- Results consistent: 0-1 seed leaks, 1-3 generic, 96-97% diversity

---

## Iteration 11: generateRecommendations Alignment
- Updated history-based prompt to use same reason template and confidence calibration
- Ensures consistent quality across both recommendation paths

---

## Iteration 12: Attribution Accuracy + Final Polish
- Added "double-check title belongs to credited artist" instruction
- Final results stable and consistent

---

