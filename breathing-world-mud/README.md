# Breathing World MUD

A lightweight browser-based MUD simulator built with Node.js, Express, PostgreSQL, Prisma, Vite, React, Tailwind CSS, and optional Groq AI world generation.

The world starts from a small seed area and stores generated rooms, items, monsters, NPCs, lore, and events in PostgreSQL so exploration becomes persistent.

## Features

- Email/password login and registration with bcrypt password hashing
- Database-backed admin flag, no hardcoded admin env gate
- Admin settings for Groq API key, model, creativity, max tokens, world generation, and safety toggle
- MUD command UI with story log, command history, clickable exits, inventory, monsters, NPCs, and world events
- Rule-based command parser for classic text adventure commands
- Groq integration that requests JSON only, validates output, retries once, and falls back safely
- Interaction-driven world ticks instead of constant background jobs
- Simple turn-based combat and loot drops
- Admin views for users, rooms, monsters, items, NPCs, lore, and AI logs
- Docker-ready deployment for VPS/Coolify

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment file:

   ```bash
   cp .env.example .env
   ```

3. Start Postgres:

   ```bash
   docker compose up -d postgres
   ```

4. Run migrations and seed the world:

   ```bash
   npm run prisma:migrate
   npm run seed
   ```

5. Start development servers:

   ```bash
   npm run dev
   ```

Open `http://localhost:5173`.

The seed admin defaults to:

- Email: `admin@example.com`
- Password: `change-me-now`

Change these in `.env` before seeding a shared environment.

## Groq Settings

The Groq API key is stored encrypted in the database from the admin panel. It is intentionally not required in `.env`.

After logging in as an admin, open the shield icon and set:

- Groq API key
- Model name, such as `llama-3.1-8b-instant`
- Creativity
- Max tokens
- World generation toggle
- Safety toggle

If no Groq key is stored, gameplay still works with local fallback templates.

## Commands

- `look`
- `north`, `south`, `east`, `west`, `up`, `down`
- `inventory`
- `take [item]`
- `drop [item]`
- `examine [thing]`
- `talk to [npc]`
- `attack [monster]`
- `use [item]`
- `rest`
- `help`

## Docker / Coolify

Build and run the complete stack:

```bash
docker compose up --build
```

For Coolify, create a PostgreSQL resource and set these app environment variables:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB?schema=public
SESSION_SECRET=replace-with-a-long-random-secret
PORT=3000
NODE_ENV=production
```

The container runs `prisma migrate deploy` before starting the server.

To seed production once, run:

```bash
npm run seed
```

## Architecture

- `src/server/index.ts` - Express app, sessions, API routing, production static serving
- `src/server/routes` - Auth, game, and admin REST routes
- `src/server/services/commandParserService.ts` - local command parser
- `src/server/services/gameService.ts` - gameplay loop, exploration, combat, ticks
- `src/server/services/worldGeneratorService.ts` - Groq JSON generation, validation, fallbacks
- `prisma/schema.prisma` - PostgreSQL data model
- `prisma/seed.ts` - seed admin and starting world
- `src/client/main.tsx` - React MUD UI and admin panel

## Seed World

- The Candle Gate
- Ashroot Path
- The Quiet Well
- Old Copper Shrine

The tone is mysterious, quiet, slightly gothic, and strange without becoming too grim.
