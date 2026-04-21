# MicroSuspiros Admin Panel

A self-hosted Next.js admin panel for managing MicroSuspiros songs, suspiro shorts, playlists, publishing metadata, tags, and workflow readiness. It is designed as a production-friendly replacement for a WordPress-style content workflow, with PostgreSQL and Prisma at the center.

## Stack

- Next.js 16 App Router
- TypeScript
- Prisma 6
- PostgreSQL
- Tailwind CSS
- Server actions
- Zod validation
- lucide-react icons

## Features

- Dashboard with catalog and publishing stats
- Song CRUD with lyrics, suspiro short versions, notes, metadata, tags, and asset flags
- Server-side search and filters for status, mood, theme, language, publishing flags, and cover art
- Playlist CRUD with explicit song ordering
- Workflow page for missing cover art, missing short versions, YouTube gaps, and ready-to-publish songs
- Mock AI metadata generation in `lib/ai.ts`, structured for future Groq integration
- Release campaigns, publishing calendar, and rule-based release queue recommendations
- Manual scheduling for YouTube, website, shorts, playlists, teasers, and campaign moments
- Dashboard customization with presets, compact mode, collapsible sections, and saved preferences
- Optional integration foundations for YouTube, website sync checks, and analytics snapshots
- Prisma schema, migration, and seed data with original Spanish placeholder content

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment example:

```bash
cp .env.example .env
```

3. Set `DATABASE_URL` in `.env` to a PostgreSQL database:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/microsuspiros_admin?schema=public"
```

4. Run the Prisma migration:

```bash
npm run prisma:migrate
```

5. Seed the database:

```bash
npm run prisma:seed
```

6. Start development:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Scripts

```bash
npm run dev              # Start Next.js in development
npm run build            # Generate Prisma client and build Next.js
npm run start            # Apply migrations and start the production server
npm run lint             # Run Next lint
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Create/apply local Prisma migrations
npm run prisma:seed      # Seed example MicroSuspiros content
```

## Database

The Prisma schema includes:

- `Song`
- `Tag`
- `Playlist`
- `PlaylistSong` with explicit ordering
- `Asset`
- `AIGenerationLog`
- `PublishEvent`
- `ReleaseCampaign`
- `CampaignItem`
- `ScheduledRelease`
- `UserPreference`
- `AnalyticsSnapshot`

Run `npm run prisma:migrate` during local development. In production, the `start` script applies pending migrations with `prisma migrate deploy` before starting Next.js.

## Coolify Deployment Notes

1. Create a PostgreSQL service in Coolify.
2. Create a new app from this repository.
3. Add the production `DATABASE_URL` environment variable from the Coolify PostgreSQL service.
4. Make sure `DATABASE_URL` is enabled for both build and runtime in Coolify.
5. Use the Nixpacks build pack.
6. Set the branch to `codex/microsuspiros-admin-panel`.
7. Set the app port to `3000`.
8. Leave `Is it a static site?` disabled.
9. Build command:

```bash
npm ci && npm run build
```

10. Start command:

```bash
npm run start
```

11. Optional first-time seed command:

```bash
npm run prisma:seed
```

The app pins Node 22 because Next.js 16 requires Node 20.9 or newer and Nixpacks defaults to Node 18 when no version is specified. The production start script runs `prisma migrate deploy` before `next start`, so the database schema is applied when the container starts.

## Future Groq Integration

The AI helper lives in `lib/ai/` with these functions:

- `generateYoutubeTitle(song)`
- `generateYoutubeDescription(song)`
- `generateShortVersion(song)`
- `generateWebsiteExcerpt(song)`
- `generateHookText(song)`
- `suggestTags(song)`

Mock mode is the default and works without external services:

```bash
AI_PROVIDER="mock"
```

To enable Groq, configure:

```bash
AI_PROVIDER="groq"
GROQ_API_KEY="your-groq-key"
GROQ_MODEL="llama-3.1-8b-instant"
```

If Groq is unavailable or misconfigured, the app falls back to mock generation instead of breaking the creator workflow. Generated outputs are stored in `AIGenerationLog` with provider, prompt, result, accepted state, and timestamp.

## Phase 2 Migration

Phase 2 adds provider and accepted tracking to AI generation logs, plus a new `HOOK_TEXT` generation kind. After pulling this version, run:

```bash
npm run prisma:generate
npx prisma migrate deploy
```

## Assets, Uploads, And Publish History

Phase 3 adds song asset management and manual publish history.

Assets can be:

- cover art
- full audio
- short audio
- video
- lyrics documents
- external reference URLs

Local uploads are stored under:

```bash
UPLOAD_DIR="public/uploads"
STORAGE_DRIVER="local"
```

For Coolify, mount a persistent volume to the upload directory so uploaded files survive rebuilds/redeploys. A practical mount target is:

```bash
/app/public/uploads
```

The app currently implements local storage only. These env vars are reserved for future S3/R2-compatible storage:

```bash
S3_BUCKET=""
S3_REGION=""
S3_ENDPOINT=""
S3_ACCESS_KEY=""
S3_SECRET_KEY=""
```

Publish history is logged from each song page and tracks platform, content type, URL, notes, and publish date. You can use it for YouTube, website, WhatsApp, Instagram, TikTok, and other manual publishing events.

## Phase 3 Migration

Phase 3 extends `Asset`, adds local/external storage metadata, and creates `PublishEvent`. After pulling this version, run:

```bash
npm run prisma:generate
npx prisma migrate deploy
```

## Release Planning

Phase 4 adds the release operating system layer:

- `/campaigns` groups songs, playlists, shorts, excerpts, and website posts into release arcs.
- `/calendar` tracks planned, scheduled, published, skipped, and canceled release entries.
- `/queue` ranks songs with deterministic recommendations such as `Publish Now`, `Good Shorts Candidate`, `Finish Metadata`, and `Missing Cover`.
- Song pages now show campaign membership, scheduling, queue status, and release readiness.
- Playlist pages can be added to campaigns and scheduled as playlist releases.
- Dashboard and workflow views include active campaigns, overdue releases, next best moves, upcoming releases, unscheduled ready songs, and no-campaign gaps.

Release queue behavior can be tuned with:

```bash
DEFAULT_TIMEZONE="America/Los_Angeles"
RELEASE_QUEUE_STALE_DAYS="30"
RELEASE_QUEUE_RECENT_DAYS="10"
DASHBOARD_DEFAULT_PRESET="full"
```

The recommendation engine is rule-based and lives in:

```bash
lib/release-recommendations.ts
lib/release-queue.ts
```

It does not require Groq or any external API.

## Phase 4 Migration

Phase 4 adds `ReleaseCampaign`, `CampaignItem`, and `ScheduledRelease`, plus a `TEASER` content type for scheduled releases. After pulling this version, run:

```bash
npm run prisma:generate
npx prisma migrate deploy
```

## Dashboard Customization

Phase 5 adds saved dashboard preferences for calmer working modes.

Available presets:

- `Full`
- `Content Focus`
- `Release Focus`
- `Minimal`

The dashboard customizer lets you:

- hide or show major dashboard sections
- start sections collapsed
- switch compact density on or off
- save a quieter default view for local admin mode

Preferences are stored in `UserPreference` under a global dashboard key, so the app still works even without a full user system.

## Integrations And Sync Foundations

Phase 5 adds optional foundations for external publishing and analytics.

Environment variables:

```bash
YOUTUBE_SYNC_ENABLED="false"
YOUTUBE_API_KEY=""
YOUTUBE_CHANNEL_ID=""
WEBSITE_SYNC_ENABLED="false"
WEBSITE_BASE_URL=""
WEBSITE_API_URL=""
WEBSITE_API_KEY=""
ANALYTICS_IMPORT_ENABLED="true"
ANALYTICS_SOURCE="manual"
SYNC_TIMEOUT_MS="7000"
```

Behavior:

- If an integration is disabled, the app still works normally.
- If YouTube sync is enabled, publish events can normalize YouTube URLs, extract video IDs, and optionally fetch basic video metadata.
- If website sync is enabled, website publish events can store richer external IDs and run a simple sync check against a configured endpoint.
- If analytics import is enabled, manual analytics entry is available immediately and future API imports can plug into the same model.
- All sync failures are soft errors: the page continues working and sync state is recorded instead of crashing the app.

The integrations status page lives at:

```bash
/integrations
```

## Analytics Snapshots

Analytics snapshots store lightweight performance moments for songs and publish events:

- platform
- snapshot date
- views
- likes
- comments
- shares
- watch time
- CTR
- retention

This phase ships manual entry on song pages, plus concise performance summaries on the dashboard and campaign pages.

## Phase 5 Migration

Phase 5 adds:

- `ExternalSyncStatus`
- richer `PublishEvent` sync fields
- `UserPreference`
- `AnalyticsSnapshot`

After pulling this version, run:

```bash
npm run prisma:generate
npx prisma migrate deploy
```

## Auth

The app includes a simple env-controlled login gate. It stays disabled until all three variables are set:

```bash
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="use-a-strong-password"
ADMIN_SESSION_SECRET="use-a-long-random-string"
ADMIN_COOKIE_SECURE="false"
```

Set those in Coolify to protect the admin panel. For local open testing, leave the first three unset. If the site is available through HTTPS only, set `ADMIN_COOKIE_SECURE` to `true`; if you are testing through plain HTTP, keep it `false` so the browser will accept the login cookie. This is intentionally lightweight so a full auth provider can be added later without rewriting the admin pages.
