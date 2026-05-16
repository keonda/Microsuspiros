# Shift Companion

Mobile-first PWA for a breakroom / microkitchen attendant. It replaces a paper shift notebook with fast, offline-first tracking for readiness, inventory, panic restocks, reminders, reports, expiration watch, waste observations, copyable chat summaries, and lightweight stats.

## MVP Features

- Next.js App Router, TypeScript, Tailwind CSS
- Prisma schema for PostgreSQL with seed data
- Offline-first local storage plus IndexedDB action queue
- Sync endpoint that stores the latest offline snapshot in Postgres
- Android-installable PWA manifest and service worker
- Quiet reminders with Notification and Vibration API support checks
- Single-user mode through environment variables
- Dockerfile and `docker-compose.yml`
- Coolify-ready standalone Next.js build
- Phase 2 placeholder service for AI predictions and OCR cleanup

## Local Setup

```bash
cp .env.example .env
npm install
npm run prisma:generate
docker compose up -d db
npm run prisma:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

## Fast Shift Workflow

- `Today`: readiness percentage, checklist, smart prompt, summaries, copy buttons
- `Inventory`: 1-tap status updates, quick quantity buttons, scan label placeholder
- `Panic`: large emergency buttons and one-tap urgent summary
- `Reminders`: quiet reminders that still show in-app if notifications are unavailable
- `Reports`: pending/resolved/no-action/repeated shortage filters
- `Waste / Expiration`: simple observations and approximate expiration batches
- `Stats`: readiness, common shortages, badges, and floor timer mode

## Environment Variables

```bash
DATABASE_URL=postgresql://shift:shift@localhost:5432/shift_companion?schema=public
AUTH_SECRET=change-me
NEXTAUTH_SECRET=change-me
SINGLE_USER_MODE=true
SINGLE_USER_EMAIL=attendant@example.com
SINGLE_USER_PASSWORD=shiftcompanion
NEXT_PUBLIC_APP_NAME="Shift Companion"
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

## Coolify Notes

Use the included Dockerfile or Docker Compose service.

- Build command: `npm run build`
- Start command for non-Docker deployments: `npm run prisma:deploy && npm run start`
- Expose port: `3000`
- Set `DATABASE_URL` to your Coolify PostgreSQL internal connection string
- Keep `SINGLE_USER_MODE=true` for a one-person install
- Set `SINGLE_USER_EMAIL` and `SINGLE_USER_PASSWORD` without wrapping quote characters in the Coolify UI
- Set `AUTH_SECRET` / `NEXTAUTH_SECRET` to a long random value
- Run `npm run db:seed` once after first deploy if you want sample data

## Offline and Sync

The app writes every action locally first. It stores the full shift state in IndexedDB with a localStorage fallback, queues sync events, and posts them to `/api/sync` when online. The MVP sync stores a latest snapshot in `AppSetting.offlineSnapshot`; more granular conflict resolution can be added later without changing the mobile workflow.

## OCR / Scan Label

The MVP includes camera/image upload and a text field standing in for OCR output. Duplicate detection suggests close existing item names. The provider abstraction in `lib/ai-suggestions.ts` is ready for Google Vision, Gemini, OpenAI, or another OCR service.

## Phase 2 TODOs

- Predict shortages by day/time
- Suggest reminders based on routine
- Clean OCR item names with an AI or OCR provider
- Summarize weekly patterns
- Detect waste-heavy items
- Recommend opening checklist changes
- Add granular server-side sync per entity with conflict handling
