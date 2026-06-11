# Nimbus Goods — AI Support Chat

A small but production-shaped customer-support chat agent for a fictional e-commerce
store. A visitor asks a question in a chat widget; the backend persists the
conversation, asks Google Gemini to answer as a support agent grounded in the store's
policies, and streams the reply back into the UI.

This was built as the Spur Founding Engineer take-home. The brief asked for a mini AI
support agent; I treated it as a small slice of a real product and focused on the
things that matter when you actually ship: clean layering, a well-encapsulated LLM
integration, sensible persistence, and graceful behaviour under bad input and flaky
upstreams.

- **Live demo:** https://spur-chat-agent-tau.vercel.app
- **Repo:** https://github.com/Abhishek764/spur-chat-agent
- **Stack:** SvelteKit (Svelte 5) · TypeScript · Prisma · PostgreSQL · Google Gemini

---

## Table of contents

- [What it does](#what-it-does)
- [Why this stands out](#why-this-stands-out)
- [Requirements checklist](#requirements-checklist)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Data model](#data-model)
- [LLM integration](#llm-integration)
- [Robustness & edge cases](#robustness--edge-cases)
- [API reference](#api-reference)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [npm scripts](#npm-scripts)
- [Deployment](#deployment)
- [Security & privacy](#security--privacy)
- [Design decisions](#design-decisions)
- [How I tested it](#how-i-tested-it)
- [Trade-offs & if I had more time](#trade-offs--if-i-had-more-time)
- [Project structure](#project-structure)

---

## What it does

1. The visitor opens a single page with a chat widget.
2. They type a question — _"What's your return policy?"_, _"Do you ship to the USA?"_
3. The frontend sends it to `POST /api/chat`.
4. The backend resolves (or creates) a conversation, stores the user message, replays
   recent history to Gemini with a grounded system prompt, and stores the reply.
5. The answer appears in the chat. The session id is kept in `localStorage`, so the
   conversation is restored on reload via `GET /api/conversations/[id]`.

The agent only answers from the store's knowledge base (shipping, returns, payments,
support hours, order tracking), politely declines off-topic requests, and is tolerant
of typos and shorthand (e.g. it reads _"usq"_ as _"USA"_).

## Why this stands out

- **Strict separation of concerns.** Route handlers never touch Prisma or the LLM
  directly — everything goes through a service layer, and the LLM lives behind a single
  `generateReply(history, userMessage)` function. Adding a new channel (WhatsApp, IG)
  or swapping providers touches one module, not the whole app.
- **Robust by design.** Input is validated, oversized messages are truncated rather than
  rejected, transient model outages are retried with backoff, and any failure degrades
  to a friendly message instead of a crash or a stack trace.
- **Coherent persistence.** The user's message is saved _before_ the model is called, so
  it's never lost; the agent's turn is always saved too, so a reloaded conversation
  always reads as a complete exchange.
- **Typed end to end.** TypeScript throughout, a typed `LlmError` taxonomy, and a Prisma
  schema that the client and server share. `svelte-check` passes with zero errors.

## Requirements checklist

Everything the brief asked for, and where it lives:

| Requirement | Status | Where |
| --- | --- | --- |
| Chat UI: scrollable list, user/AI distinction, Enter to send, auto-scroll | ✅ | [`ChatWidget.svelte`](src/lib/components/ChatWidget.svelte) |
| Disabled send while in flight, typing indicator | ✅ | [`ChatWidget.svelte`](src/lib/components/ChatWidget.svelte), [`TypingIndicator.svelte`](src/lib/components/TypingIndicator.svelte) |
| `POST /chat/message`-style endpoint returning `{ reply, sessionId }` | ✅ | [`/api/chat`](src/routes/api/chat/+server.ts) |
| Persist every message, associated with a conversation | ✅ | [`chat/service.ts`](src/lib/server/chat/service.ts) |
| Real LLM call behind a `generateReply` service | ✅ | [`llm/gemini.ts`](src/lib/server/llm/gemini.ts) |
| System prompt + conversation history for context | ✅ | [`llm/prompt.ts`](src/lib/server/llm/prompt.ts) |
| Seeded FAQ / domain knowledge | ✅ | [`llm/knowledge.ts`](src/lib/server/llm/knowledge.ts) |
| Graceful handling of timeouts / invalid key / rate limits | ✅ | [`llm/gemini.ts`](src/lib/server/llm/gemini.ts) |
| Token / history caps for cost control | ✅ | `MAX_OUTPUT_TOKENS`, `MAX_HISTORY_TURNS` |
| Conversations + messages persisted; history fetchable by id | ✅ | [`prisma/schema.prisma`](prisma/schema.prisma), [`/api/conversations/[id]`](src/routes/api/conversations/[id]/+server.ts) |
| Input validation, no crashes on bad input, no hardcoded secrets | ✅ | [`validation.ts`](src/lib/server/validation.ts), `.env` (gitignored) |

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **SvelteKit (Svelte 5)** | Spur's stated preference, and it lets one codebase host both the UI and the API routes — a single deploy, no CORS, shared types. |
| Language | **TypeScript** | Type safety across the request lifecycle, from the zod-validated body to the Prisma rows to the LLM contract. |
| Database | **PostgreSQL + Prisma** | Prisma gives a typed client, migrations, and a readable schema. Postgres is what Spur runs in production. |
| LLM | **Google Gemini** (`@google/genai`, `gemini-2.5-flash`) | Fast and cheap for short support replies, with a clean official SDK. |
| Validation | **zod** | Declarative request validation with good error messages. |
| Hosting | **Vercel + Neon** | `adapter-vercel` deploys the whole app serverless; Neon is serverless Postgres that pairs cleanly with Prisma. |

## Architecture

The app is a single SvelteKit project. Request handlers are thin; all logic lives in a
server-only `lib/server` layer that the handlers call into.

```mermaid
flowchart TD
    UI["ChatWidget.svelte<br/>(browser)"] -->|"POST /api/chat"| Route["+server.ts<br/>route handler"]
    Route -->|"zod validate"| V["validation.ts"]
    Route --> Service["chat/service.ts<br/>orchestration"]
    Service --> DB[("Prisma → PostgreSQL")]
    Service --> LLM["llm/gemini.ts<br/>generateReply()"]
    LLM --> Prompt["prompt.ts + knowledge.ts<br/>system instruction"]
    LLM -->|"HTTPS"| Gemini["Google Gemini API"]
```

**The rule:** a route handler may parse and validate the request and call the service —
nothing more. Prisma and the Gemini client are never imported into a route. This keeps
the HTTP layer trivial and makes the core logic easy to test and reuse from another
entry point (a webhook for WhatsApp, say).

### Request lifecycle

```mermaid
sequenceDiagram
    participant U as Browser
    participant R as /api/chat
    participant S as chat/service
    participant DB as PostgreSQL
    participant G as Gemini

    U->>R: { message, sessionId? }
    R->>R: parse JSON + zod validate
    R->>S: handleChat(input)
    S->>DB: find or create conversation
    S->>DB: load prior history
    S->>DB: persist USER message
    S->>G: generateReply(history, message)
    alt success
        G-->>S: reply text
    else transient 503
        S->>G: retry (backoff, up to 3x)
    else hard failure
        S->>S: fall back to friendly message
    end
    S->>DB: persist AI message (real or fallback)
    S-->>R: { reply, sessionId, degraded }
    R-->>U: 200 { reply, sessionId }
```

## Data model

Two tables, one relationship. A conversation is a chat session; messages belong to it
and are ordered by creation time.

```mermaid
erDiagram
    Conversation ||--o{ Message : has
    Conversation {
        string id PK
        datetime createdAt
        datetime updatedAt
    }
    Message {
        string id PK
        string conversationId FK
        enum sender "user | ai"
        string text
        datetime createdAt
    }
```

The schema lives in [`prisma/schema.prisma`](prisma/schema.prisma). `Message` has a
composite index on `(conversationId, createdAt)` so loading a conversation's history is
a single ordered index scan. Deleting a conversation cascades to its messages.

## LLM integration

The entire integration is encapsulated behind one function in
[`llm/gemini.ts`](src/lib/server/llm/gemini.ts):

```ts
generateReply(history: ConversationTurn[], userMessage: string): Promise<string>
```

**Provider & model.** Google Gemini via the official `@google/genai` SDK, defaulting to
`gemini-2.5-flash`. The model is overridable with the `GEMINI_MODEL` env var without a
code change.

**Prompt design.** The system instruction ([`prompt.ts`](src/lib/server/llm/prompt.ts))
sets a concise support-agent persona and a short set of behaviour rules, then appends
the store's knowledge base. The rules tell the model to:

- answer only from the provided knowledge, and offer a human handoff when it can't;
- infer intent from typos and shorthand instead of refusing (_"usq" → "USA"_);
- ask a brief clarifying question only when intent is genuinely unclear;
- never invent policies, prices, or order details, and decline off-topic requests.

**Knowledge base.** The FAQ lives as structured data in
[`knowledge.ts`](src/lib/server/llm/knowledge.ts) (store profile + topic/answer pairs),
rendered into the prompt by a single function. Keeping it as data rather than a prose
blob makes it trivial to edit and a small step away from moving it into the database.

**Context.** Recent history is replayed so replies are contextual — _"How long does it
take?"_ correctly resolves against the previous question about USA shipping.

**Guardrails & cost control.**

| Concern | Handling |
| --- | --- |
| Slow / hung request | 15s timeout via `AbortController` + SDK `httpOptions.timeout` |
| Transient overload (HTTP 503) | up to 3 attempts with linear backoff |
| Rate limit / quota (429), auth (401/403), empty response | classified into a typed `LlmError` and surfaced as a friendly message |
| Runaway cost | `maxOutputTokens` capped at 1024; history capped at the last 20 turns |
| Determinism | `temperature: 0.3` for consistent, on-brand answers |

Every failure mode is mapped to an `LlmError` kind (`config`, `timeout`, `rate_limit`,
`auth`, `unavailable`, `empty`, `unknown`). The service decides how to present it; the
caller never sees a raw exception.

## Robustness & edge cases

The brief warned that they'd try to break it. These are handled explicitly:

| Input / condition | Behaviour |
| --- | --- |
| Empty or whitespace-only message | `400` with a clear error; never reaches the model |
| Non-JSON body | `400` "Request body must be valid JSON." |
| Wrong types (e.g. `message: 123`) | `400` from zod with a readable message |
| Very long message (≤ 20k chars) | accepted, truncated to 4k before storage and the model call |
| Absurdly long message (> 20k chars) | `400` "message is too long" |
| Unknown / stale `sessionId` | a fresh conversation is started rather than erroring |
| Model overloaded (503) | retried with backoff; if still failing, a friendly fallback |
| Model timeout / bad key / rate limit | caught, logged server-side, friendly message to the user |
| Unknown conversation id on history fetch | `404` |
| Unexpected server error | `500` with a clean message — no stack trace leaks to the client |

The user message is persisted before the model call, and the agent's turn (real reply or
fallback) is always persisted, so a reloaded conversation is never left with a dangling,
unanswered question.

## API reference

### `POST /api/chat`

Send a message and get the agent's reply.

**Request**

```json
{ "message": "Do you ship to the USA?", "sessionId": "optional-existing-id" }
```

**Response** `200`

```json
{ "reply": "Yes, we ship to the USA! ...", "sessionId": "cmq43zw010005cxf4jdtow6pj" }
```

Omit `sessionId` to start a new conversation; the returned id identifies it for
subsequent turns. Validation failures return `400 { "error": "..." }`.

```bash
curl -X POST http://localhost:5173/api/chat \
  -H 'content-type: application/json' \
  -d '{"message":"What is your return policy?"}'
```

### `GET /api/conversations/[id]`

Fetch a conversation's full history (used to restore the UI on reload).

**Response** `200`

```json
{
  "sessionId": "cmq43zw010005cxf4jdtow6pj",
  "messages": [
    { "id": "...", "sender": "user", "text": "Do you ship to the USA?", "createdAt": "..." },
    { "id": "...", "sender": "ai",   "text": "Yes, we ship to the USA! ...", "createdAt": "..." }
  ]
}
```

Returns `404` if the conversation doesn't exist.

## Getting started

### Prerequisites

- Node.js 22+
- Docker (for local PostgreSQL) — or any Postgres you already have
- A Google Gemini API key — https://aistudio.google.com/apikey

### 1. Install

```bash
git clone https://github.com/Abhishek764/spur-chat-agent.git
cd spur-chat-agent
npm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

This runs Postgres on host port **5433** (5432 is left free so it won't clash with an
existing local Postgres). Credentials default to `spur` / `spur` / `spur_chat`.

### 3. Configure environment

```bash
cp .env.example .env
```

Then fill in `.env` (see [Environment variables](#environment-variables)). For the
default Docker setup, `DATABASE_URL` and `DIRECT_URL` are:

```
postgresql://spur:spur@localhost:5433/spur_chat?schema=public
```

Add your `GEMINI_API_KEY`.

### 4. Apply migrations and seed

```bash
npm run db:migrate   # creates the tables
npm run db:seed      # adds one demo conversation (optional)
```

### 5. Run

```bash
npm run dev
```

Open the printed URL (usually http://localhost:5173) and start chatting.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` | yes | Google Gemini API key. Read at runtime; never committed. |
| `DATABASE_URL` | yes | Postgres connection string used by the app at runtime. On serverless, use the **pooled** Neon URL. |
| `DIRECT_URL` | yes | Connection used for migrations. Locally it equals `DATABASE_URL`; on Neon it's the **direct** (non-pooled) URL. |
| `GEMINI_MODEL` | no | Override the model (defaults to `gemini-2.5-flash`). |

Secrets live only in `.env`, which is gitignored. `.env.example` documents the shape
with placeholders.

## npm scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run preview` | Preview the production build |
| `npm run check` | Type-check the whole project (`svelte-check`) |
| `npm run db:migrate` | Create/apply a dev migration |
| `npm run db:deploy` | Apply migrations in production (CI/host) |
| `npm run db:seed` | Seed the demo data |
| `npm run db:studio` | Open Prisma Studio |

## Deployment

Deployed to **Vercel** with a **Neon** serverless Postgres database.

1. Create a Neon project and copy two connection strings: the **pooled** URL (host
   contains `-pooler`) and the **direct** URL.
2. Apply the schema to Neon: `DATABASE_URL=<direct> DIRECT_URL=<direct> npx prisma migrate deploy`.
3. Import the repo at https://vercel.com/new — SvelteKit is auto-detected.
4. Set the environment variables on the project:
   - `DATABASE_URL` → Neon **pooled** URL
   - `DIRECT_URL` → Neon **direct** URL
   - `GEMINI_API_KEY` → your key
5. Deploy. The build runs `prisma generate` automatically; the schema is already applied,
   so the app works on first boot.

The Prisma `directUrl` split is deliberate: serverless functions use the pooled
connection for runtime queries, while migrations use the direct connection (pooled
connections don't support the operations migrations need).

## Security & privacy

- **No secrets in the repo.** All keys and connection strings come from `.env` /
  platform env vars; `.env` is gitignored.
- **No auth, by design.** The brief explicitly didn't require it. The `sessionId` (a
  Prisma `cuid`) acts as an unguessable capability that ties a browser to its
  conversation. There are no user accounts and no personal data. For a real deployment
  I'd move the session id into a signed, http-only cookie so it can't be read or shared
  via JavaScript — see [below](#trade-offs--if-i-had-more-time).
- **No crashes on hostile input.** Every handler validates and wraps its work; the
  client only ever sees clean JSON.

## Design decisions

- **One SvelteKit app instead of separate front/back.** Fewer moving parts, shared
  types, one deploy, no CORS — the right call for a focused product slice.
- **A service layer between routes and infrastructure.** It's the single most important
  decision for extensibility: the same `handleChat` could be driven by a WhatsApp
  webhook tomorrow without touching the HTTP route.
- **Knowledge as data, not a hardcoded prompt string.** Easier to read and edit, and a
  short hop from a database-backed knowledge source.
- **Persist the user message first, and always persist the agent turn.** This is what
  keeps conversations coherent across failures and reloads — a small decision with an
  outsized effect on how trustworthy the product feels.
- **A typed error taxonomy for the LLM.** Turning every upstream failure into a named
  `LlmError` kind keeps error handling honest and makes the friendly-fallback policy a
  single, obvious place in the code.
- **Truncate oversized input rather than reject it.** A user who pastes a wall of text
  should still get help, not a wall of error.

## How I tested it

I exercised the system end-to-end against the live Gemini API, both via the HTTP API and
by driving the real UI in a browser:

- **Happy path:** sane, grounded answers to shipping/returns/hours questions.
- **Context:** _"How long does it take?"_ after a USA-shipping question resolves
  correctly using replayed history.
- **Guardrails:** off-topic requests (e.g. "write me a poem") are politely declined.
- **Typos:** _"can i ship to usq"_ is understood as USA and answered.
- **Validation:** empty messages, non-JSON bodies, wrong types, and oversized input all
  return clean `400`s; very long input is truncated and still answered.
- **Persistence & reload:** messages survive a page reload via the history endpoint and
  `localStorage` session id.
- **Failure modes:** simulated/observed model outages (HTTP 503) trigger the retry path,
  and ultimately a friendly fallback that is itself persisted so the thread stays
  coherent.

`npm run check` (full TypeScript + Svelte type-check) passes with zero errors.

## Trade-offs & if I had more time

Given the weekend timebox, I deliberately left some things out and would prioritise
these next:

- **Streaming replies.** Token-by-token streaming would make the UI feel instant; the
  service is already shaped to allow it.
- **Cookie-bound sessions.** Move `sessionId` into a signed http-only cookie for a real
  ownership boundary instead of a client-held capability.
- **Automated tests.** Unit tests for `validation` and the `LlmError` classifier, and an
  integration test for `handleChat` with a mocked model. I tested manually under the
  timebox; this is the first thing I'd formalise.
- **Retrieval over the knowledge base.** For a larger catalogue, move the FAQ into the
  database and retrieve the relevant entries per query instead of sending all of it.
- **Rate limiting & abuse protection** on the public endpoint.
- **Observability.** Structured logs and basic metrics (latency, token usage, failure
  rates) per request.
- **Richer UX.** Message timestamps, markdown rendering, a "new conversation" control,
  and an explicit retry button on a degraded reply.

## Project structure

```
prisma/
  schema.prisma          Conversation + Message models, Sender enum
  migrations/            generated SQL migrations
  seed.ts                idempotent demo seed
src/
  app.html, app.css      shell + global styles
  routes/
    +layout.svelte       global layout
    +page.svelte         the chat page (+ SEO metadata)
    api/
      chat/+server.ts            POST  — send a message
      conversations/[id]/+server.ts  GET — fetch history
  lib/
    types.ts             shared UI types
    api.ts               typed browser client (fetch wrappers)
    components/
      ChatWidget.svelte  the chat experience
      Message.svelte     a single bubble
      TypingIndicator.svelte
    server/              server-only
      db.ts              Prisma client singleton
      validation.ts      zod schema + truncation
      chat/service.ts    orchestration
      llm/
        gemini.ts        generateReply() + error taxonomy + retries
        prompt.ts        system instruction builder
        knowledge.ts     store FAQ as structured data
docker-compose.yml       local Postgres
```

---

Built by [Abhishek](https://github.com/Abhishek764) for the Spur Founding Full‑Stack Engineer
take-home.
