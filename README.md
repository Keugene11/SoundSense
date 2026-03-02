# SoundSense

AI-powered music discovery that connects to your YouTube Music account, analyzes your listening patterns, and generates personalized song recommendations.

## How It Works

1. **Connect YouTube Music** — import your listening history
2. **Enter a seed song** — or let the AI work from your history
3. **Get recommendations** — 10 verified songs with explanations of why you'll love each one

Recommendations are verified across YouTube, Last.fm, and collaborative filtering data to ensure every song is real and playable.

## Tech Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **UI:** Tailwind CSS + shadcn/ui
- **Database & Auth:** Supabase (Postgres + Google OAuth)
- **AI:** Dedalus Labs (OpenAI-compatible API)
- **Payments:** Stripe (Free & Pro plans)
- **Testing:** Vitest + React Testing Library

## External Services

| Service | Purpose |
|---------|---------|
| Dedalus Labs | AI recommendation generation |
| YouTube Data API | Video search, metadata, playback |
| Last.fm (via Python service) | Similar tracks, artist verification |
| TasteDive | Similar artist discovery |
| ListenBrainz / MusicBrainz | Artist similarity, track verification |
| Odesli (song.link) | Cross-platform availability |
| Stripe | Subscription billing |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- Supabase project
- Python microservice running (for YouTube Music sync & Last.fm)

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
DEDALUS_API_KEY=
DEDALUS_BASE_URL=https://api.dedaluslabs.ai/v1

# YouTube
YOUTUBE_API_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRO_PRICE_ID=

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
    (auth)/login/        — Google OAuth login
    (dashboard)/
      dashboard/         — Listening stats & analytics
      discover/          — Seed-based recommendations
      recommendations/   — History-based recommendations
      connect/           — YouTube Music OAuth flow
      settings/          — Preferences, subscription, account
    api/
      recommendations/   — AI generation & verification
      seeds/             — Seed song management
      youtube-music/     — Sync, search, OAuth
      stripe/            — Checkout & portal
      webhooks/stripe    — Stripe webhooks
    auth/callback        — OAuth callback
  components/            — UI components
  lib/
    dedalus/             — AI prompt engineering
    supabase/            — DB clients (browser, server, admin)
    youtube-music.ts     — YouTube search & metadata
    lastfm.ts            — Last.fm verification & candidates
    tastedive.ts         — Similar artist discovery
    listenbrainz.ts      — MusicBrainz/ListenBrainz lookups
    stripe.ts            — Billing helpers
    store.ts             — Supabase queries
    auth.ts              — Auth helpers
  types/                 — TypeScript types
```

## Plans

| | Free | Pro ($9/mo) |
|---|---|---|
| AI recommendations | 5/day | Unlimited |
| YouTube Music sync | Yes | Yes |
| Listening analytics | Basic | Advanced |
