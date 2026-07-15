# Tacit — a company that never forgets

AI-powered organizational memory. Tacit reads a company's work history (tickets,
threads, incidents, docs), turns it into a queryable brain that remembers *why*
decisions were made, surfaces hidden assumptions in new plans, warns when a
proposal repeats a past failure, and actively interviews people to capture
knowledge that was never written down.

Runs entirely on your machine against a seeded fictional company, **NimbusPay**.

## Prerequisites

1. **Node.js 18+**
2. A **Google AI API key** — get one free at https://ai.google.dev

## Setup (3 commands)

```bash
# 1. Install dependencies (installs native modules for embeddings + SQLite)
npm install

# 2. Add your key
#    Copy .env.local.example -> .env.local and paste your key:
#      GOOGLE_API_KEY=your_key_here

# 3. Warm the embedding model, ingest the seed data, extract decisions
npm run setup
```

`npm run setup` downloads the local embedding model (~25MB, first run only),
loads the 10 seed documents with embeddings into `data/tacit.db`, creates the
pending incident interview, and runs decision extraction with Gemini.

Then start the app:

```bash
npm run dev
# open http://localhost:3000
```

## Tech

- **Next.js 16** (App Router) + TypeScript + Tailwind
- **SQLite** via `better-sqlite3`, single file at `data/tacit.db`
- **Embeddings**: `@xenova/transformers`, `Xenova/all-MiniLM-L6-v2` (384-dim, runs
  locally in Node, no API key)
- **Vector search**: cosine similarity in JS over all document embeddings
  (~25 docs — brute force is instant)
- **LLM**: Google `gemini-2.0-flash`, streaming for Memory and Foresight

## The four views

- **Memory** (`/`) — ask about any decision; streamed, cited answer. Click a
  citation chip to open the source document.
- **Assumptions** (`/assumptions`) — paste a plan; get its load-bearing
  assumptions, sorted high-risk first, with stated/implicit tags.
- **Foresight** (`/foresight`) — paste a proposal; get a pre-mortem grounded
  only in the company's own history, citing similar past initiatives.
- **Interviewer** (`/interviewer`) — answer Tacit's questions about a resolved
  incident; the synthesis becomes a new, immediately retrievable memory.

## Demo script (7 minutes)

1. **Memory** — type *"Why did we kill the Partner Portal?"* → a cited trail
   streams back (zero partner adoption, API instability, Jane's call to kill it),
   citing `[NIMBUSPAY-4412]` and the Slack thread.

2. **Interviewer** — open the pending incident interview (`INC-2024-09-12`).
   Answer its 4 questions. The greyed placeholder in each box is the suggested
   demo answer (also listed below) — paste and send. On finish, watch the
   knowledge get captured as `INTERVIEW-1`.

3. **Memory again** — ask *"What caused the September payments incident and how
   do we prevent it?"* → now answered, citing the fresh `[INTERVIEW-1]`. Proof
   the brain just learned.

4. **Foresight** (the climax) — click *"Load sample: Partner Marketplace
   proposal"* and run the pre-mortem. Tacit recognizes the Partner Portal
   failure `[NIMBUSPAY-4412]`, connects the repeated bets (self-serve partner
   adoption, public API readiness), and lists validation steps. The room goes
   quiet.

### Demo interview answers (paste during step 2)

1. Root cause was the legacy synchronous calls to Stripe. Each payment request
   blocks on Stripe's response, so when Stripe slowed down, every payment in the
   system stalled behind it.
2. I first tried raising the client timeout — made it worse, just held threads
   longer. The actual fix was rerouting payment traffic through the async queue
   we built in June and letting the retry logic drain the backlog.
3. Finish migrating the remaining legacy payment paths to the async queue
   pattern (NIMBUSPAY-4520). About 30% of payment code still makes direct sync
   calls. Until that's done this exact incident can recur.
4. Watch for thread pool saturation alerts on the payments service — that was
   the earliest signal, about 10 minutes before merchant-visible failures started.

## Re-seeding

`npm run setup` is idempotent — it wipes and reloads the documents and
interviews tables each run. You can also POST `/api/ingest` then `/api/extract`
from a running app.

## Project layout

```
data/seed.json          NimbusPay dataset
lib/db.ts               SQLite setup + schema
lib/embeddings.ts       local embedding helper
lib/retrieval.ts        cosine similarity search
lib/gemini.ts           Gemini client + streaming/JSON helpers
lib/prompts.ts          the 5 prompts
lib/ingest.ts           ingest + extract logic (shared by routes + setup)
lib/stream.ts           __SOURCES__ streaming response builder
app/api/*               ingest, extract, memory, assumptions, foresight, interviews
app/page.tsx            Memory (default)
app/assumptions|foresight|interviewer/page.tsx
components/*             sidebar, sources slide-over, citation chips, stream client
scripts/setup.ts        npm run setup
```
