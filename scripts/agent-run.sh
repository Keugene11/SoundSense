#!/bin/bash
# SoundSense Autonomous Agent — 1 hour continuous improvement loop
# Runs Claude Code headless, no user input needed.

set -e

PROJECT_DIR="C:/Users/Daniel/Projects/SoundSense"
LOG_DIR="$PROJECT_DIR/.claude/agent-logs"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
LOG_FILE="$LOG_DIR/run-$TIMESTAMP.log"

mkdir -p "$LOG_DIR"
mkdir -p "$PROJECT_DIR/.claude/eval-results"

cd "$PROJECT_DIR"

# Allow nested Claude Code sessions
unset CLAUDECODE

echo "=== SoundSense Agent started at $(date) ===" | tee "$LOG_FILE"
echo "Log file: $LOG_FILE"
echo "Will run for ~1 hour autonomously."
echo ""

claude -p "You are an autonomous agent that will spend the next 1 HOUR continuously testing and improving the SoundSense music recommendation system. You work completely independently — no human input needed.

## PROJECT CONTEXT
This is a Next.js music recommendation app. The core recommendation logic is in:
  src/lib/dedalus/recommendations.ts

It uses GPT-4o (via Dedalus API) to generate song recommendations from seed songs. The prompt in that file controls recommendation quality. Your job is to iteratively improve it.

## YOUR EVAL SCRIPT
There is an evaluation script at scripts/eval-recommendations.ts that:
- Sends seed songs to the Dedalus API using the current prompt
- Measures: recommendation count, confidence, artist diversity, seed artist leakage, duplicate detection, generic reason detection
- Saves results to .claude/eval-results/

## TEST SONGS (use these as seeds)
You MUST test with these specific songs across your iterations:
- Misery by Maroon 5
- Sunday Morning by Maroon 5
- Crystals by Isolate.exe
- The Man by Aloe Blacc
- I Thought I Saw Your Face Today by Stevie Wonder
- Lover Girl by Laufey (Icelandic jazz-pop artist, NOT the fairy)
- Lo Siento BB by Tainy, Bad Bunny, Julieta Venegas
- Blinding Lights by The Weeknd
- Do I Wanna Know? by Arctic Monkeys
- Pink + White by Frank Ocean
- Boredom by Tyler, the Creator
- Midnight City by M83
- Toxicity by System of a Down
- Best Part by Daniel Caesar
- Comfortably Numb by Pink Floyd

ALSO test with creative combos:
- [Misery + Crystals] (pop-rock meets electronic)
- [Sunday Morning + Lover Girl] (smooth/jazzy pop)
- [The Man + Lo Siento BB] (confidence anthems across languages)
- [Pink + White + I Thought I Saw Your Face Today] (soulful vibes)
- [Midnight City + Crystals] (electronic/synth)
- [Toxicity + Do I Wanna Know?] (heavy/dark rock)
- [Best Part + Lover Girl + Sunday Morning] (romantic/mellow)
- Single seed tests (just one song, should still produce great recs)

## YOUR LOOP (repeat for 1 hour)

### Step 1: Read the current prompt
Read src/lib/dedalus/recommendations.ts to understand the current state.

### Step 2: Update the eval script test cases
Edit scripts/eval-recommendations.ts to use the test songs listed above. Create diverse test case groupings. Make sure the eval script tests BOTH the generateFromSeeds prompt AND the generateRecommendations prompt patterns.

### Step 3: Run the eval
Run: pnpm tsx scripts/eval-recommendations.ts
Wait for full results.

### Step 4: Analyze results
Look at the eval JSON output. Focus on:
- Are seed artists leaking into recommendations? (BIGGEST issue from previous runs)
- Are recommendations actually GOOD? Would a real person love these suggestions?
- Are reasons specific? (should mention specific sonic qualities, not generic 'similar vibe')
- Is there enough variety? (not all from same genre/era)
- For cross-genre seed combos, does it find the CONNECTION between very different songs?
- Are the recommended songs REAL? (watch for hallucinated titles)
- Is confidence scoring calibrated? (0.85+ should genuinely be amazing picks)

### Step 5: Make improvements
Edit src/lib/dedalus/recommendations.ts to fix issues found. Ideas:
- Strengthen the 'no seed artists' rule if they're leaking
- Improve the analysis framework (sonic qualities, BPM, key, production style)
- Add constraints for diversity (max N songs from same artist, decade spread, etc.)
- Improve the reason quality instructions
- Adjust the recommendation distribution strategy
- Fine-tune temperature or token limits if needed
- Add or refine genre-crossing instructions for diverse seed combos

IMPORTANT: Make SMALL, TARGETED changes each iteration. Do NOT rewrite the whole file. Change 1-3 things per cycle so you can measure what helps.

### Step 6: Re-run eval and compare
Run the eval again after your changes. Compare metrics:
- Did seed artist leakage decrease?
- Did reason quality improve?
- Did overall quality improve?
- Did you introduce any regressions?

If your change made things WORSE, revert it and try something different.

### Step 7: Commit if improved
If the change improved quality, commit it with a descriptive message like:
  git add src/lib/dedalus/recommendations.ts
  git commit -m 'Improve recommendation prompt: [what you changed and why]'

### Step 8: Loop back to Step 3
Keep iterating. Each cycle should take ~5-10 minutes. You should get through 6-12 improvement cycles in the hour.

## RULES
- ONLY modify src/lib/dedalus/recommendations.ts and scripts/eval-recommendations.ts
- Keep a running log: after each iteration, append a summary to .claude/agent-logs/iterations.md
- Never break the JSON output format
- Never remove the critical rules about songs being real
- If something is working well, don't touch it
- Track your iteration count and stop after 1 hour or 12 iterations, whichever comes first
- At the end, write a final summary to .claude/agent-logs/final-summary.md with:
  - Starting metrics vs ending metrics
  - What changes you made
  - What worked and what didn't
  - Recommendations for future improvements

START NOW. Do not ask any questions. Just begin." \
  --allowedTools "Bash,Read,Write,Edit,Glob,Grep" \
  --print 2>&1 | tee -a "$LOG_FILE"

echo "=== Agent completed at $(date) ===" | tee -a "$LOG_FILE"
