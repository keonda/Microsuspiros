# Microsuspiros Notes

A private-first Markdown notes app inspired by Notesnook, Obsidian, and Scrivener. It includes database-backed auth, notebooks, wiki links, Markdown editing with preview, encrypted per-user Groq API key storage, a small AI assistant, local media uploads, and admin basics.

## Stack

- Node.js
- Next.js App Router
- React + TypeScript
- PostgreSQL
- Prisma ORM
- TailwindCSS
- Docker-ready for Coolify

## First Run Locally

1. Copy `.env.example` to `.env`.
2. Set strong values for `AUTH_SECRET` and `ENCRYPTION_SECRET`.
3. Start PostgreSQL:

```bash
docker compose up -d db
```

4. Install dependencies and prepare Prisma:

```bash
npm install
npx prisma migrate dev
npm run dev
```

5. Open `http://localhost:3000`.

The first registered user becomes an admin. Admin status is stored in PostgreSQL, not in environment variables.

## Coolify Notes

Use the included `Dockerfile` and configure these environment variables in Coolify:

- `DATABASE_URL`
- `AUTH_SECRET`
- `ENCRYPTION_SECRET`
- `UPLOAD_DIR`
- `NEXT_PUBLIC_APP_URL`
- `AUTH_COOKIE_SECURE`

Run `npx prisma migrate deploy` during deployment or as a one-off command after the database is available.

For a temporary HTTP-only Coolify deployment, set `NEXT_PUBLIC_APP_URL` to your `http://` URL and `AUTH_COOKIE_SECURE=false`. Once HTTPS is enabled, use an `https://` app URL and set `AUTH_COOKIE_SECURE=true` or remove it to let the app infer secure cookies from the URL.

## Implemented In This Foundation

- Login and registration with hashed passwords.
- User roles stored in the database.
- Protected dashboard layout.
- Notes CRUD API and Markdown editor with live preview.
- Autosave plus manual save indicator.
- Notebooks API and sidebar.
- Tags schema/API support.
- Wiki link parsing with `[[Note Title]]`, link opening/creation, backlinks, and a simple graph strip.
- Note version records on manual save.
- Encrypted Groq API key storage and connection testing.
- Mini Groq assistant that returns suggestions without overwriting note content.
- Local media uploads with metadata in PostgreSQL.
- Media library with image, video, audio, and PDF handling.
- Admin user management and app stats.
- Docker and Compose setup.

## Phase 2

- Add true drag-and-drop notebook and note ordering.
- Add nested notebook management UI.
- Replace basic search with PostgreSQL `tsvector` full-text indexes.
- Add richer version history restore/diff UI.
- Add collaborative-safe editor state and better conflict handling.
- Add S3/R2 storage adapter behind the upload abstraction.
- Add graph canvas with pan/zoom/filtering.
- Add tests for auth, authorization, encryption, uploads, and notes APIs.
