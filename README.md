# SoundSense

AI-powered music discovery. Enter a song you love, get a playlist of songs you'll actually want to listen to.

**Live:** [soundsense.vercel.app](https://soundsense.vercel.app)

## How It Works

1. **Enter a song** — type a name like "Crystals Isolate exe" or paste a YouTube link
2. **AI builds a playlist** — Claude analyzes the song's genre, vibe, and sonic qualities using data from Last.fm, TasteDive, and ListenBrainz
3. **Every song is verified** — cross-checked on YouTube and Last.fm to ensure it's real and playable
4. **Listen seamlessly** — Spotify-style playlist player with play/pause, skip, seek, and volume control
5. **Teach it your taste** — like and dislike songs to improve future recommendations

## Features

- Spotify/YouTube Music-style playlist player with bottom now-playing bar
- Auto-plays through recommendations when a song ends
- Like/dislike feedback that persists and shapes future playlists
- Library page to view all your liked and disliked songs
- Google login via Supabase Auth (optional — app works without login)
- Smart seed resolution via Last.fm (handles vague queries like "no one noticed" correctly)
- Fallback pipelines for underground/niche artists with limited data

## Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **UI:** Tailwind CSS 4 + shadcn/ui
- **Database:** Supabase (Postgres)
- **Auth:** Supabase Auth + Google OAuth
- **AI:** Anthropic Claude (Haiku 4.5)
- **Package Manager:** pnpm

## External Services

| Service | Purpose |
|---------|---------|
| Anthropic Claude | AI recommendation generation |
| YouTube Data API | Video search, metadata, audio playback |
| Last.fm | Song resolution, similar tracks, genre tags, verification |
| TasteDive | Similar artist discovery |
| ListenBrainz | Artist similarity via MusicBrainz |
| Supabase | Auth, database, user profiles |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Supabase project with Google OAuth configured

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

# Last.fm
LASTFM_API_KEY=

# Optional
TASTEDIVE_API_KEY=
```

### Run

```bash
pnpm dev
```

## Project Structure

```
src/
  app/
    (dashboard)/
      discover/        -- Seed input, playlist generation, player
      library/         -- Liked and disliked songs
      settings/        -- User preferences
    auth/callback/     -- Google OAuth callback
    login/             -- Login page
    api/
      recommendations/ -- AI generation + verification pipeline
      seeds/           -- Seed song resolution via Last.fm
  components/
    playlist-player    -- Bottom now-playing bar with controls
    playlist-track-list -- Track list with play indicators
    youtube-player     -- Hidden YouTube iframe for audio playback
    nav-sidebar        -- Navigation + user info
  lib/
    anthropic/         -- AI client + prompt engineering
    supabase/          -- Browser, server, and admin clients
    youtube-music.ts   -- YouTube search (API, scrape, race)
    lastfm.ts          -- Similar tracks, genre tags, verification
    tastedive.ts       -- Similar artist discovery
    listenbrainz.ts    -- Artist similarity
    session.ts         -- Auth session helpers
    store.ts           -- Database queries
```
