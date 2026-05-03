# Personal Homepage Assistant

A private full-stack Next.js dashboard for organizing sites, YouTube channels, projects, notes, tasks, calendar entries, quick links, and Groq-powered AI conversations.

## Features

- Database-backed first-run admin setup and login
- Secure password hashing with `bcryptjs`
- Persistent opaque sessions stored in Postgres
- CRUD pages for sites, channels, projects, notes, tasks, calendar events, and quick links
- Global search across dashboard content
- Groq chat panel with database-stored API key, model setting, conversation history, and optional dashboard context
- Dark/light mode, responsive sidebar, dashboard widgets, pinned/favorite links, and activity log
- Prisma + PostgreSQL ready for Coolify

## Local Install

```bash
cd personal-homepage-assistant
npm install
cp .env.example .env
```

Edit `.env`:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/personal_homepage_assistant?schema=public"
SESSION_SECRET="use-a-long-random-secret"
```

Do not add the Groq key to `.env`. It is stored through the app settings page.

## PostgreSQL

Create a database named `personal_homepage_assistant` in your local Postgres instance, or update `DATABASE_URL` to match your database.

With Docker:

```bash
docker run --name pha-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=personal_homepage_assistant -p 5432:5432 -d postgres:16
```

## Prisma

```bash
npm run prisma:generate
npm run prisma:migrate
```

From the repository root, these also work:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:deploy
```

Optional demo data, no credentials:

```bash
npm run db:seed
```

## Run Locally

```bash
npm run dev
```

Open `http://localhost:3000`. On first run, `/setup` creates the admin user in Postgres.

## Groq API Key

After login, go to `Settings -> AI`, paste your Groq API key, and save. The key is stored in the `Setting` table and never sent to the browser. The default model is `llama-3.1-8b-instant`.

## Coolify Deployment

1. Create a new Coolify app from this repository.
2. Add a PostgreSQL resource in Coolify.
3. Set environment variables:
   - `DATABASE_URL` from the Coolify Postgres resource
   - `SESSION_SECRET` as a long random string
4. Use Nixpacks from the repository root. The root `package.json` and `nixpacks.toml` forward build/start commands into `personal-homepage-assistant`.
5. The start command runs `prisma migrate deploy` before starting Next.js.
6. Visit the app URL and complete first-run setup.
7. Add the Groq key inside the app at `Settings -> AI`.

## Security Notes

- No admin credentials or Groq API key are hardcoded in environment variables.
- Passwords are hashed with bcrypt.
- Dashboard/API routes require a valid database session.
- Groq calls are server-side only.
- Inputs are validated with Zod in server actions/API routes.
