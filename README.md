# SoundSense

AI-powered music discovery that connects to your YouTube Music account, analyzes your listening patterns, and generates personalized song recommendations. No sign-up required -- just open the app and start discovering music.

## How It Works

1. **Connect YouTube Music** — import your listening history via OAuth
2. **Enter a seed song** — or let the AI work from your full listening history
3. **Get recommendations** — 10 verified songs with explanations of why you'll love each one
4. **Listen inline** — play recommendations directly with the built-in YouTube player

Every recommendation is verified across YouTube, Last.fm, MusicBrainz, ListenBrainz, and Odesli to ensure every song is real and playable.

## Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **UI:** Tailwind CSS 4 + shadcn/ui + Recharts
- **Database:** Supabase (Postgres)
- **AI:** Anthropic Claude (Claude Sonnet)
- **Python Service:** FastAPI microservice for YouTube Music sync & Last.fm
- **Testing:** Vitest + React Testing Library

## External Services

| Service | Purpose |
|---------|---------|
| Anthropic Claude | AI recommendation generation |
| YouTube Data API | Video search, metadata, playback |
| Last.fm (via Python service) | Similar tracks, artist verification |
| TasteDive | Similar artist discovery |
| ListenBrainz / MusicBrainz | Artist similarity, track verification |
| Odesli (song.link) | Cross-platform availability |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Python 3.x (for the FastAPI microservice)
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

# Python microservice (YouTube Music sync + Last.fm)
PYTHON_SERVICE_URL=http://localhost:8000

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional
TASTEDIVE_API_KEY=
ODESLI_API_KEY=
```

### Run

```bash
# Next.js app
pnpm dev

# Python microservice (separate terminal)
cd python-service
pip install -r requirements.txt
uvicorn main:app --reload
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
      dashboard/             -- Listening stats & analytics
      discover/              -- Seed-based recommendations + playlist player
      recommendations/       -- History-based recommendations
      connect/               -- YouTube Music OAuth flow
      settings/              -- Preferences & YouTube Music connection
    api/
      recommendations/       -- AI generation, discover, backfill
      seeds/                 -- Seed song management
      youtube-music/         -- Sync, search, OAuth, device-code
      preferences/           -- User preference management
  components/                -- UI components (shadcn + custom)
  lib/
    anthropic/               -- AI client & prompt engineering
    supabase/                -- DB client (admin)
    youtube-music.ts         -- YouTube search & metadata
    lastfm.ts                -- Last.fm verification & candidates
    tastedive.ts             -- Similar artist discovery
    listenbrainz.ts          -- ListenBrainz artist similarity
    musicbrainz.ts           -- MusicBrainz track verification
    odesli.ts                -- Cross-platform availability
    session.ts               -- Anonymous session management
    store.ts                 -- Supabase queries
  types/                     -- TypeScript types

python-service/
  routers/
    oauth.py                 -- YouTube Music device-code OAuth
    history.py               -- Recently played tracks
    library.py               -- Library songs
    search.py                -- YouTube Music search
    lastfm.py                -- Last.fm integration
  services/
    ytmusic.py               -- ytmusicapi wrapper
    credentials.py           -- Credential storage
```

## Database Schema

| Table | Purpose |
|-------|---------|
| profiles | Session identity & YouTube Music connection status |
| yt_music_credentials | OAuth tokens for YouTube Music |
| listening_history | Synced tracks with metadata |
| user_preferences | Favorite genres, mood, discovery level, excluded artists |
| recommendations | AI-generated recommendations with status |
| seed_songs | User's current seed songs for discovery |
| sync_log | Sync operation history & error tracking |
