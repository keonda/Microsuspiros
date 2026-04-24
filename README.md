# Writer Studio

Writer Studio is a private Next.js writing workspace for manuscripts, story notes, research notes, brainstorm boards, and project resources.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS
- Prisma ORM with PostgreSQL
- Database-backed auth with bcrypt password hashes and persistent sessions
- TipTap rich-text manuscript editor with autosave
- Local file uploads stored in a persistent `uploads` folder
- Docker-ready for Coolify or local compose deployment

## Phase 1 Features

- Register, login, logout, database sessions, first registered user becomes admin
- Dashboard with recent projects, continue-writing shortcut, and stats
- Project CRUD foundation with manuscript, notes, research, brainstorm, resources, search, trash
- TipTap editor with headings, bold, italic, underline, blockquote, bullet/numbered lists, horizontal rule, autosave, manual save, word/character counts, reading time, fullscreen, focus mode, dark editor mode, and browser spellcheck
- Story notes and research notes stored in PostgreSQL
- Drag-and-drop brainstorm cards across default columns
- Authenticated local resource upload/download with image/audio/video/PDF previews
- Global and project search
- HTML/TXT document export and combined project manuscript export
- Simple admin user management

## Local Development

```bash
npm install
copy .env.example .env
npm run prisma:migrate
npm run dev
```

Open `http://localhost:3000`, register the first account, and it will become the admin user.

## Optional Seed Admin

The app does not use hardcoded runtime users. For automated environments you can create an admin through the seed command:

```bash
SEED_ADMIN_EMAIL="admin@example.com" SEED_ADMIN_PASSWORD="change-this-password" npm run prisma:seed
```

## Docker

```bash
docker compose up --build
```

The compose file starts the app and PostgreSQL. Uploads are persisted in the `writer-uploads` volume.

## Coolify

1. Create a PostgreSQL service.
2. Create an app from this repository using Dockerfile deployment.
3. Set environment variables:
   - `DATABASE_URL`
   - `BASE_URL`
   - `UPLOAD_DIR=/app/uploads`
   - `AUTH_COOKIE_SECURE=true` for HTTPS deployments, or `false` when testing over plain HTTP
4. Mount a persistent volume at `/app/uploads`.
5. Expose port `3000`.
6. Deploy. The production start command runs `prisma migrate deploy` before `next start`.
7. Register the first user in the browser, or run the seed command once with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`.

## Future TODO Anchors

The codebase includes TODO comments for:

- AI assistant integration
- DOCX/PDF export
- backlinks graph
- advanced spellcheck/grammar suggestions
- version history
- collaborative writing
