# Tacit — Project Documentation

**Tagline:** *A company that never forgets.*

Tacit is an AI-powered organizational-memory platform. It reads a team's work
history (Jira tickets, uploaded docs, meeting notes, resolved incidents), turns
it into a queryable "brain," and lets anyone ask why a decision was made,
surface the hidden assumptions in a new plan, get a grounded pre-mortem before
committing to something, and capture knowledge that was never written down.

This document explains the product from both a **user perspective** (what each
screen does) and a **technical perspective** (stack, architecture, data model,
APIs). It reflects everything built so far.

---

## 1. What Tacit does (user perspective)

Tacit is organized as a workspace app with a left sidebar of "surfaces." A user
signs in to a **team**, picks their **member** profile, and opens a **project**.
Everything they then do happens inside that project's isolated memory.

### The eight surfaces

1. **Memory** (`/`) — Ask a question in plain English ("Why did we kill the
   Partner Portal?"). Tacit retrieves the most relevant items from the project's
   memory and streams back a cited answer that reconstructs the decision trail —
   who raised it, what alternatives existed, what tipped the call. Every claim is
   tagged with a citation chip (e.g. `[NIMBUSPAY-4412]`); clicking it opens the
   source document in a slide-over, and if the source is linked to a Jira ticket,
   a "View in Jira" link is shown.

2. **Assumptions** (`/assumptions`) — Paste a project plan. Tacit extracts the
   load-bearing assumptions the plan treats as true without evidence, especially
   the *implicit* ones, and sorts them high-risk first. Each has a risk badge, a
   stated/implicit tag, "what breaks if this is false," and a "validated" toggle.

3. **Foresight** (`/foresight`) — Paste a proposal for something new. Tacit
   writes a pre-mortem grounded **only** in the company's own history: it names
   the most similar past initiative(s), points out which assumptions repeat ones
   that failed before, and ends with concrete validation steps. A callout box
   flags "⚠ Similar past initiative found" with citation chips. This is the demo
   climax — recognizing that a "Partner Marketplace" repeats the failed "Partner
   Portal."

4. **Interviewer** (`/interviewer`) — When something notable happens (e.g. an
   incident is resolved), Tacit generates four targeted questions for the person
   who handled it. They answer in a chat-style flow; Tacit synthesizes the Q&A
   into a durable knowledge document, embeds it, and adds it to memory — so the
   next person who asks gets an answer citing that freshly captured knowledge.

5. **Capture** (`/capture`) — Upload or paste written context (specs, decision
   docs, meeting transcripts). Supports `.txt`, `.md`, and `.vtt`/`.srt`
   transcripts (timestamps auto-stripped). Optionally link the doc to a Jira
   ticket — pick from the connected project's live tickets, type a key, or use
   **✦ Auto-suggest**, which asks Gemini to match the text to the best ticket and
   propose a title. Saved captures become searchable memory with the ticket
   attached.

6. **Decisions** (`/decisions`) — A browsable log of every decision Tacit
   extracted from the project's memory: what was chosen, the reasoning, the
   alternatives rejected, who was involved, and the outcome. A "Re-extract from
   memory" button refreshes it after new imports or captures.

7. **Activity** (`/activity`) — A team feed of everything people did (questions
   asked, pre-mortems run, interviews answered, docs captured, Jira imports),
   each attributed to a member. Any member can comment on any item (threaded),
   and **tag/assign** teammates to an item ("this was raised by X," "assign to
   Y") with `@name · role` chips.

8. **Settings** (`/settings`) — Team and member management. Lists all members
   with their roles, lets Admins remove members (and anyone remove themselves),
   and has a "Danger zone" to delete the current project (owner/Admin) or the
   whole team (Admin).

### Accounts, roles, and projects

- **Teams** are the top-level org. **Members** belong to a team and each has a
  **role** (Admin, Product Manager, Engineer, Designer, Stakeholder). The first
  member of a team is automatically the **Admin**.
- **Projects** belong to a team and are **owned** by the member who created them.
  The owner is responsible for connecting Jira. Each project has its **own
  isolated memory** — documents, decisions, and interviews never leak between
  projects.
- **Sample project:** new projects start empty. A one-click "✦ Load NimbusPay
  sample project" spins up a self-contained demo dataset (the fictional NimbusPay
  company) in its own project, for demos or exploration.

### Login flow

`Team (pick/create)` → `Member (pick/create, choose role)` → `Project
(pick/create, or load sample)` → the app. A session cookie remembers the active
team, member, and project. The top bar shows `team / project` with an owner
badge, the linked Jira key, and a menu to switch member, switch project, or log
out.

---

## 2. Technology stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router) | Server route handlers + React Server/Client components |
| Language | **TypeScript** | Strict mode |
| UI | **React 19** + **Tailwind CSS v4** | Dark theme, amber accent; no component library |
| Database | **SQLite** via `better-sqlite3` | Single file at `data/tacit.db`, synchronous driver |
| Embeddings | `@xenova/transformers`, model `Xenova/all-MiniLM-L6-v2` | 384-dim vectors, runs **locally** in Node, no API key |
| Vector search | Brute-force **cosine similarity** in JavaScript | Dataset is small; exhaustive scan is instant and reliable |
| LLM | **Google Gemini** via `@google/generative-ai` | Default model `gemini-3.1-flash-lite` (override with `GEMINI_MODEL`); streaming for Memory & Foresight |
| Tooling | `tsx` (script runner), `dotenv` | `npm run setup` warms the embedding model |

**Why these choices:**
- *Local embeddings* mean semantic search costs nothing and needs no external
  vector DB — perfect for a self-contained demo.
- *SQLite* means zero infrastructure: clone, install, run. Embeddings are stored
  as JSON text in a column and scored in JS.
- *Gemini Flash-Lite* is fast and cheap for extraction, Q&A, and pre-mortems.

---

## 3. Architecture overview

```
Browser (React client components)
   │  fetch()
   ▼
Next.js Route Handlers  (app/api/**)  ── nodejs runtime
   │            │              │
   ▼            ▼              ▼
 lib/db     lib/embeddings   lib/gemini
 (SQLite)   (MiniLM local)   (Gemini API)
   │            │              │
   └────► lib/retrieval (cosine search) ◄──┘
```

- **Client pages** (Memory, Capture, etc.) are React client components that call
  JSON/streaming API routes.
- **Route handlers** run on the Node runtime (required for `better-sqlite3` and
  the transformers model) and are marked `dynamic = "force-dynamic"`.
- **`lib/`** holds all server logic; native/heavy packages (`better-sqlite3`,
  `@xenova/transformers`) are declared in `serverExternalPackages` so Next
  doesn't try to bundle them.
- **Streaming**: Memory and Foresight stream tokens. The response body starts
  with a `__SOURCES__<json>\n` line (retrieved source metadata) followed by the
  model's text, parsed on the client by `components/streamClient.ts`.

### Retrieval pipeline (how a Memory answer is produced)

1. User question → embedded locally with MiniLM (384-dim vector).
2. `lib/retrieval.search()` loads the **current project's** document embeddings
   and ranks them by cosine similarity (top 8).
3. The top chunks (with source id, title, author, date, and any linked Jira key)
   are formatted into the P2 prompt.
4. Gemini streams a cited answer; sources are sent first so the UI can render
   citation chips and the "Sources" row immediately.

---

## 4. Data model (SQLite schema)

All tables live in `data/tacit.db`. Schema is created on first run and evolved
by idempotent migrations (`applyMigrations` in `lib/db.ts`), so an existing DB
picks up new columns without a reset.

**`documents`** — the memory store (anything searchable)
`id, source, source_id, author, ts, title, content, embedding (JSON 384 floats),
project_id, member_id, linked_jira_key, linked_jira_url`
- `source` ∈ `jira | slack | incident | interview | upload`

**`decisions`** — decisions extracted from documents
`id, title, decision, reasoning, alternatives (JSON), people (JSON), outcome,
ts, source_ids (JSON), project_id`

**`plans`** — plans submitted to the Assumptions surface
`id, title, content, created_at`

**`assumptions`** — assumptions extracted from a plan
`id, plan_id, text, why_load_bearing, risk, stated_or_implicit, validated`

**`interviews`** — interview triggers and their Q&A
`id, trigger_type, trigger_ref, person, questions (JSON), answers (JSON),
status (pending|answered|synthesized), answered_by, project_id, created_at`

**`teams`** — top-level orgs
`id, name, created_at`

**`members`** — people in a team
`id, team_id, name, email, role, created_at`

**`projects`** — projects within a team (own the memory + Jira connection)
`id, team_id, name, owner_member_id, jira_project_key, jira_base_url,
jira_email, jira_token, created_at`

**`activities`** — attributed audit/feed of actions
`id, team_id, project_id, member_id, type, title, detail, ref, created_at`
- `type` ∈ `memory | assumptions | foresight | interview | jira_import | capture`

**`comments`** — comments on activity items
`id, activity_id, member_id, body, created_at`

**`activity_tags`** — members tagged/assigned to an activity
`id, activity_id, member_id, created_at` (unique per activity+member)

---

## 5. The five AI prompts (`lib/prompts.ts`)

- **P1 — Extraction:** reads a document and returns any DECISION as strict JSON
  (title, decision, reasoning, alternatives, people, outcome). Runs per project.
- **P2 — Memory:** answers a question using only retrieved context, citing every
  claim with a `[source_id]`.
- **P3 — Assumptions:** extracts 5–10 load-bearing assumptions from a plan as
  JSON, focusing on implicit bets.
- **P4 — Foresight:** writes a pre-mortem grounded only in retrieved history,
  naming the closest past initiative and the repeated assumptions.
- **P5a / P5b — Interviewer:** generates four targeted questions for a resolved
  event (P5a) and synthesizes the answers into a knowledge doc (P5b).

All JSON prompts use Gemini's `responseMimeType: "application/json"`, with a
fenced-code fallback parser in `lib/gemini.ts`.

---

## 6. API reference

**Session & identity**
- `GET/POST/DELETE /api/session` — read / set (team, member, project) / log out.
- `GET/POST /api/teams` — list / create teams.
- `DELETE /api/teams/[id]` — delete team + cascade (Admin only).
- `GET/POST /api/teams/[id]/members` — list / add members (first = Admin).
- `DELETE /api/teams/[id]/members/[memberId]` — remove member (Admin or self).
- `GET/POST /api/projects` — list / create projects (creator = owner).
- `DELETE /api/projects/[id]` — delete project + cascade (owner or Admin).
- `POST /api/projects/sample` — create & load the NimbusPay sample project.
- `GET/POST /api/projects/jira-connect` — connection status / save Jira creds
  (owner only; validates against Jira).

**Memory & reasoning**
- `POST /api/memory` `{question}` — streamed cited answer (scoped to project).
- `POST /api/assumptions` `{title, plan}` — risk-sorted assumptions JSON.
- `POST /api/foresight` `{proposal}` — streamed pre-mortem.
- `GET /api/decisions` / `POST /api/decisions` — list / re-extract decisions.

**Interviewer**
- `GET /api/interviews` — list interviews (generates questions for pending ones).
- `POST /api/interviews/[id]/answer` `{answers}` — save + synthesize + embed.

**Capture & Jira**
- `POST /api/capture` `{title, content, jiraKey}` — embed + store a context doc.
- `GET /api/capture` — list captured docs for the project.
- `POST /api/capture/suggest` `{content, issues}` — Gemini suggests ticket+title.
- `POST /api/ingest-jira` `{projectKey}` — import Jira issues into memory.
- `GET /api/jira/issues` — list tickets for the ticket picker.

**Collaboration**
- `GET/POST /api/activities` — feed / (logged internally).
- `GET/POST /api/activities/[id]/comments` — read / add comments.
- `GET/POST/DELETE /api/activities/[id]/tags` — read / add / remove member tags.

**Legacy (global, pre multi-tenancy)**
- `POST /api/ingest`, `POST /api/extract` — original global seed loaders, kept
  for reference; the app now uses the per-project sample loader instead.

---

## 7. Key modules (`lib/`)

- **`db.ts`** — opens the SQLite file (singleton cached on `globalThis` across
  hot reloads), creates the schema, runs idempotent column/table migrations, and
  exports typed row interfaces.
- **`embeddings.ts`** — lazy-loads the MiniLM pipeline once and exposes
  `embed(text) → number[384]` (mean-pooled, L2-normalized).
- **`retrieval.ts`** — `cosineSimilarity`, `search(query, topK, projectId)`
  (project-scoped brute-force ranking), and `formatChunks` for prompt context.
- **`gemini.ts`** — configures the model (via `GEMINI_MODEL`), `streamText` and
  `generateJSON` helpers, valid safety settings, and `friendlyGeminiError`
  (turns raw quota/auth errors into one readable line).
- **`prompts.ts`** — the five prompts as functions.
- **`ingest.ts`** — `loadSampleIntoProject`, `runExtractForProject`, and the
  legacy global `runIngest`/`runExtract`.
- **`jira.ts`** — per-project Jira connection (falls back to env), Basic-auth
  REST v3 calls (`/search/jql` with legacy fallback), ADF→text extraction,
  `fetchJiraIssues`, `fetchJiraIssueList`, `jiraIssueUrl`.
- **`session.ts`** — cookie-based demo session (`getSession`, `writeSession`,
  `clearSession`).
- **`activity.ts`** — `logActivity` (best-effort attributed feed entries).
- **`stream.ts`** — builds the `__SOURCES__`-prefixed streaming response.

**Client components (`components/`):** `SessionProvider` (session context),
`LoginGate` (3-step auth + app shell), `Sidebar`, `TopBar`, `SourcesProvider`
(citation slide-over), `CitationText` (markdown-lite + citation chips),
`ConnectJira` (per-project connect + import), `streamClient` (stream parser).

---

## 8. Multi-tenancy & permissions

- **Isolation:** memory (`documents`), `decisions`, and `interviews` are scoped
  by `project_id`; all reads filter to the active project from the session.
- **Ownership:** the project creator is `owner_member_id`. Only the owner (or a
  team Admin) can connect Jira or delete the project.
- **Roles:** `Admin` can manage/delete members and delete the team; the first
  member is Admin by default. Other roles are descriptive (PM, Engineer, etc.).
- **Attribution:** every action is logged to `activities` with the acting
  `member_id`; interview answers store `answered_by`.

---

## 9. Jira connector

- **Per-project stored token:** the owner enters Jira **base URL + email + API
  token + project key** in the Connect Jira panel (Memory page). It's validated
  against Jira and saved on the `projects` row.
- **Env fallback:** if a project has no stored connection, calls fall back to
  `JIRA_BASE_URL` / `JIRA_EMAIL` / `JIRA_API_TOKEN` from `.env.local`. These env
  vars are therefore **optional** once projects connect their own Jira.
- **Import:** pulls up to 50 issues via the REST v3 enhanced search endpoint,
  flattens ADF descriptions + comments to text, embeds each, and stores them as
  `source = 'jira'` documents in the project.
- **Linking:** captured docs can reference a ticket; the ticket URL (built from
  the project's base URL) is surfaced everywhere the doc appears.

> **Security note:** for the demo, Jira tokens are stored in plaintext in
> SQLite. For production, encrypt them at rest or switch to Atlassian OAuth.

---

## 10. Setup & running locally

**Prerequisites:** Node.js 18+, and a Google AI (Gemini) API key from
<https://aistudio.google.com/apikey> (a standard key begins with `AIzaSy`).

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local
#    GOOGLE_API_KEY=your_gemini_key         (required)
#    JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN   (optional fallback)
#    GEMINI_MODEL=gemini-3.1-flash-lite      (optional override)

# 3. Warm the local embedding model (first run downloads ~25MB)
npm run setup

# 4. Start the app
npm run dev            # http://localhost:3000
```

`npm run setup` no longer wipes or seeds the DB — data is created per project in
the app (create a project, then "Load NimbusPay sample" or connect Jira /
capture docs). `data/tacit.db` is gitignored, as are all `.env*` files.

**First run in the app:** create a team → add yourself (you become Admin) →
create a project (or load the sample) → in Memory, connect Jira and import, or
capture a doc → ask a question.

---

## 11. Project structure

```
tacit/
  data/
    seed.json            NimbusPay sample dataset
    tacit.db             SQLite database (generated, gitignored)
  lib/
    db.ts  embeddings.ts  retrieval.ts  gemini.ts  prompts.ts
    ingest.ts  jira.ts  session.ts  activity.ts  stream.ts
  components/
    SessionProvider.tsx  LoginGate.tsx  Sidebar.tsx  TopBar.tsx
    SourcesProvider.tsx  CitationText.tsx  ConnectJira.tsx  streamClient.ts
  app/
    layout.tsx           providers + login gate + shell
    page.tsx             Memory
    assumptions/  foresight/  interviewer/  capture/  decisions/
    activity/  settings/    (one page.tsx each)
    api/
      session/  teams/  projects/  memory/  assumptions/  foresight/
      interviews/  capture/  decisions/  activities/  jira/  ingest-jira/
      ingest/  extract/     (route.ts handlers)
  scripts/
    setup.ts             warms the embedding model
```

---

## 12. Known limitations & production roadmap

- **Auth is lightweight** (name-based, cookie session, no passwords). Production
  needs real auth (passwords/SSO).
- **Database:** SQLite is ideal for the demo. At scale, move to Postgres +
  pgvector (or MongoDB Atlas Vector Search / a dedicated vector DB) for hosted,
  concurrent, large-volume vector search.
- **Jira auth:** stored-token now; Atlassian OAuth (3LO) is the production path,
  plus token encryption at rest.
- **Light/dark theme toggle:** currently dark-only; a themed light mode is a
  planned pass.
- **Automated capture (future):** the Capture file-read path is designed so a
  Google Meet transcript or Slack feed can post to `/api/capture` automatically.
- **Interviewer trigger:** currently seed/manual; can be wired to a real event
  (e.g. a Jira ticket moving to Done) to auto-create interviews.
- **Notifications / @mention alerts**, export, and cross-project search are
  natural next features.

---

## 13. Demo script (7 minutes)

1. **Sign in** — create team, add yourself (Admin), load the NimbusPay sample
   project.
2. **Memory** — ask *"Why did we kill the Partner Portal?"* → cited trail
   streams back citing `[NIMBUSPAY-4412]` and the Slack thread.
3. **Interviewer** — open the pending incident interview, answer the four
   questions (sample answers are pre-filled as hints), watch knowledge get
   captured as `INTERVIEW-1`.
4. **Memory again** — ask *"What caused the September payments incident and how
   do we prevent it?"* → now answered, citing the fresh interview. Proof the
   brain learns.
5. **Foresight** — load the Partner Marketplace proposal → the pre-mortem
   recognizes the Partner Portal failure and warns about the repeated bets.
6. **Real data** — create a fresh project, connect your Jira, import a real
   project key, capture a doc linked to a ticket, then ask Memory about it — the
   answer comes back with the Jira ticket attached.
7. **Collaboration** — open Activity, comment on an item and tag a teammate;
   show roles and deletes in Settings.
```
