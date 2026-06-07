# Support Chat Agent

A small live-chat support agent for a fictional e-commerce store. A customer types a
question in a chat widget, the backend persists the conversation and asks an LLM
(Google Gemini) to answer as a support agent, and the reply is streamed back into the UI.

Built with SvelteKit (UI + API routes), Prisma, and PostgreSQL.

> Work in progress. The data layer and local infrastructure are in place; the LLM
> service, chat API, and UI are being added next.

## Stack

- **Frontend / server:** SvelteKit (Svelte 5) + TypeScript
- **Database:** PostgreSQL via Prisma
- **LLM:** Google Gemini (`@google/genai`)
- **Validation:** zod
- **Deploy target:** Vercel + hosted Postgres (Neon)

## Running locally

Requirements: Node 22+, Docker (for local Postgres).

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start Postgres:

   ```bash
   docker compose up -d
   ```

   This runs Postgres on host port `5433` (so it won't clash with an existing
   instance on `5432`).

3. Configure environment variables. Copy the example and fill it in:

   ```bash
   cp .env.example .env
   ```

   | Variable         | Description                                            |
   | ---------------- | ------------------------------------------------------ |
   | `DATABASE_URL`   | Postgres connection string                             |
   | `GEMINI_API_KEY` | Google Gemini key — https://aistudio.google.com/apikey |

4. Apply migrations and seed:

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. Start the dev server:

   ```bash
   npm run dev
   ```

## Data model

- **Conversation** — `id`, `createdAt`, `updatedAt`, and its messages.
- **Message** — `id`, `conversationId`, `sender` (`user` | `ai`), `text`, `createdAt`.

A conversation maps to a chat session; messages are ordered by `createdAt`.

## Project layout

```
prisma/            schema, migrations, seed
src/
  routes/          pages and API endpoints
  lib/
    server/        db client, chat service, LLM integration (server-only)
    components/     chat UI components
```

More detail (architecture notes, LLM prompting, trade-offs) will land in this README
as the remaining pieces are built.
