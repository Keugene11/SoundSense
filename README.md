# SoundSense

AI-powered music discovery app. Enter a song you like, get 10 personalized recommendations — every one verified to be real and playable. No sign-up required.

## How It Works

1. **Enter a seed song** — type a song name or paste a YouTube link
2. **AI generates recommendations** — Claude analyzes your seed and pulls candidates from multiple music databases
3. **Every song is verified** — cross-checked across YouTube, Last.fm, TasteDive, and ListenBrainz
4. **Listen inline** — play recommendations directly with the built-in YouTube player and playlist controls

## Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **UI:** Tailwind CSS 4 + shadcn/ui
- **Database:** Supabase (Postgres)
- **AI:** Anthropic Claude (Claude Haiku 4.5)
- **Testing:** Vitest + React Testing Library

## External Services

| Service | Purpose |
|---------|---------|
| Anthropic Claude | AI recommendation generation |
| YouTube Data API | Video search, metadata, inline playback |
| Last.fm | Similar tracks, genre tags, artist verification |
| TasteDive | Similar artist discovery |
| ListenBrainz | Artist similarity |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Supabase project

### Setup

```bash
pnpm install
```

Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
ANTHROPIC_API_KEY=

# YouTube
YOUTUBE_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional
TASTEDIVE_API_KEY=
```

### Run

```bash
pnpm dev
```

### Test

```bash
pnpm test
pnpm lint
```

## Project Structure

```
src/
  app/
    (dashboard)/
      discover/              -- Seed-based recommendations + playlist player
      settings/              -- User preferences
    api/
      recommendations/       -- AI generation, discover, backfill
      seeds/                 -- Seed song management
      preferences/           -- User preference management
  components/                -- UI components (shadcn + custom)
  lib/
    anthropic/               -- AI client & prompt engineering
    supabase/                -- DB client (admin)
    youtube-music.ts         -- YouTube search & metadata
    lastfm.ts                -- Last.fm verification & candidates
    tastedive.ts             -- Similar artist discovery
    listenbrainz.ts          -- ListenBrainz artist similarity
    session.ts               -- Anonymous session management
    store.ts                 -- Supabase queries
  types/                     -- TypeScript types
```
