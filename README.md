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
- Phase 2 autosave status, version history, wiki links, backlinks, graph view, and optional Groq assistant
- PDF import: upload a PDF, extract selectable text, detect likely chapters, preview/edit the split, and import one or many manuscript documents or notes

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
   - `UPLOAD_DIR=/app/public/uploads`
   - `AUTH_COOKIE_SECURE=true` for HTTPS deployments, or `false` when testing over plain HTTP
   - `APP_ENCRYPTION_KEY` to a long random secret so stored AI API keys can be decrypted across redeploys
4. Mount a persistent volume at `/app/public/uploads`.
5. Expose port `3000`.
6. Deploy. The production start command runs `prisma migrate deploy` before `next start`.
7. Register the first user in the browser, or run the seed command once with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`.

## Future TODO Anchors

The codebase still reserves future work for:

- DOCX/PDF export
- advanced spellcheck/grammar suggestions
- collaborative writing

## Autosave And Versions

The editor autosaves a few seconds after changes and shows `Unsaved changes`, `Saving...`, `Saved`, or `Save failed`. It also warns before leaving a page with unsaved changes. Manual saves and the `Create Snapshot` button create document versions. Autosaves create timed snapshots about every 12 minutes instead of versioning every keystroke.

The editor version panel can view older text, compare word-count delta against the current draft, restore a version, or duplicate a version into a new document. Restoring first snapshots the current document so the current draft is not lost.

## Wiki Links And Backlinks

Use Obsidian-style links in manuscripts, story notes, and research:

```text
[[Chapter 3]]
[[Character: Elena]]
[[Research: Medieval Bells]]
```

On save, Writer Studio parses links into `InternalLink`, resolves matching documents, story notes, research notes, brainstorm cards, and resources, and shows unresolved links in the editor side panel. Unresolved links can create a new manuscript document, story note, or research note. The backlinks panel shows other project items that link to the current document with source title and excerpt.

## Graph

Each project has a basic graph view at `/projects/[id]/graph`. It maps documents, story notes, research notes, and resources with edges from resolved internal links. Filters can hide or show node types.

## Groq Assistant

The AI assistant is optional. Add a Groq key in `/settings`; the key is encrypted before storage and never exposed to the frontend. Set a stable `APP_ENCRYPTION_KEY` in production so encrypted keys remain readable after redeploys.

The editor assistant supports:

- summarize current document
- suggest next scene
- find inconsistencies
- rewrite selected text softer
- rewrite selected text darker
- extract character notes

AI output never overwrites the manuscript automatically. The panel offers copy, insert below selection, and save as story note.

## PDF Import

Use `Resources -> Import PDF` or `Project -> Manuscript order -> Import from PDF` to upload a PDF into a project. Writer Studio stores the original PDF as a protected downloadable resource, extracts selectable text on the server with `pdf-parse`, and creates a PDF import session for review.

The import preview shows detected chapter/section count, page count, extracted character count, confidence warnings, and editable section rows. You can rename sections, exclude sections, merge a section with the previous one, re-run detection with a manual split marker such as `Chapter`, or import the entire PDF as one item.

From the preview, choose one destination:

- manuscript documents, one per selected section
- story notes, one per selected section
- research notes, one per selected section

The extracted text is stored in the selected items, and every imported item is linked back to the original PDF resource. The resource records extraction status, page count, extracted text, and any extraction error. Import sessions also record the detected sections and imported targets, so the original PDF remains available for download and the review state can be reopened from the Resources tab.

Current limits and errors:

- PDF text extraction is limited to 25 MB.
- Scanned or image-based PDFs show `This PDF appears to be scanned or image-based. OCR is not supported yet.`
- Encrypted, unsupported, corrupt, or no-text PDFs are preserved as resources and show an extraction warning.
- Chapter detection is regex-based and intentionally conservative; review uncertain splits before importing.

Future TODO:

- OCR support for scanned PDFs
- AI-assisted chapter detection
- automatic chapter title cleanup
- split by table of contents
- DOCX import
- EPUB import

## Visual QA Checklist

- Light mode dashboard readable
- Dark mode dashboard readable
- Light mode editor readable
- Dark mode editor readable
- Focus mode readable
- Toolbar readable
- Inputs readable
- Right panels readable

## Phase 3 Story Intelligence

Phase 3 adds the first story-intelligence layer without making AI mandatory:

- Version history now supports named snapshots and change summaries. Restores still create a backup version first, and old versions can be duplicated into a branch document.
- Manuscript documents can have scene cards with POV, location, goal, conflict, outcome, emotional tone, and an optional `--- scene: Scene Title ---` marker inserted into the editor.
- Story entities track confirmed characters, locations, objects, organizations, concepts, and unknown terms. The editor can detect recurring capitalized names for user confirmation, then stores mentions across documents.
- The graph includes documents, notes, research, resources, scenes, and story entities, plus simple insights for unresolved links and frequent entities.
- The AI assistant supports context modes for current document, linked-note context, scenes, entities, and selected project context. AI output remains suggestion-only.
- Project exports support title-page, chapter-title, and scene-separator options through query parameters.

Keyboard shortcuts:

- `Ctrl/Cmd + S`: manual save
- `Ctrl/Cmd + B`: bold
- `Ctrl/Cmd + I`: italic
- `Ctrl/Cmd + Alt + F`: focus mode
- `Ctrl/Cmd + K`: insert a wiki-link placeholder

Export examples:

- Current document TXT/HTML: use the document toolbar.
- Full manuscript TXT: `/api/exports/projects/{projectId}?format=txt`
- Full manuscript with scene separators: `/api/exports/projects/{projectId}?format=txt&sceneSeparators=1`
- Omit title page or chapter titles with `titlePage=0` or `chapterTitles=0`.

Coolify deployment note: run Prisma migrations after deploying Phase 3 so `Scene`, `StoryEntity`, `EntityMention`, and version labels exist before opening the editor.
