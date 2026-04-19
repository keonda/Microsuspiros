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
npm run start            # Start the production server
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

Run `npm run prisma:migrate` during local development. In production, Coolify can run the build command and a deploy command that applies migrations before starting the app.

## Coolify Deployment Notes

1. Create a PostgreSQL service in Coolify.
2. Create a new app from this repository.
3. Add the production `DATABASE_URL` environment variable from the Coolify PostgreSQL service.
4. Use Node.js build mode.
5. Build command:

```bash
npm install && npm run build
```

6. Start command:

```bash
npx prisma migrate deploy && npm run start
```

7. Optional first-time seed command:

```bash
npm run prisma:seed
```

The `postinstall` script runs `prisma generate`, and the `build` script also runs it to keep Prisma ready in production builds.

## Future Groq Integration

The mock AI helper lives in `lib/ai.ts` with these functions:

- `generateYoutubeTitle(song)`
- `generateYoutubeDescription(song)`
- `generateShortVersion(song)`
- `generateWebsiteExcerpt(song)`

To add Groq later, replace the mock string builders with a Groq client call, keep the same function signatures, and continue storing outputs in `AIGenerationLog`.

## Auth

The app currently runs in simple local admin mode with no auth wall. The layout and data access are structured so middleware or a session provider can be added later without rewriting the admin pages.
