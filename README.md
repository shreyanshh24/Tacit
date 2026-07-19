# Tacit — a company that never forgets

AI-powered organizational memory. Tacit reads a team's work history (Jira tickets,
docs, transcripts, incidents) and turns it into a queryable brain that remembers
*why* decisions were made, surfaces hidden assumptions, warns when a proposal
repeats a past failure, and interviews people to capture undocumented knowledge.

## Prerequisites

- **Node.js 18+**
- A **Google AI (Gemini) API key** — <https://aistudio.google.com/apikey>

## Setup

```bash
# 1. Install dependencies (native modules for embeddings + SQLite)
npm install

# 2. Create .env.local
#    GOOGLE_API_KEY=your_gemini_key              (required)
#    JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN (optional fallback)
#    GEMINI_MODEL=gemini-3.1-flash-lite          (optional override)

# 3. Warm the local embedding model (first run downloads ~25MB)
npm run setup

# 4. Start the app
npm run dev            # http://localhost:3000
```

In the app: create a team → add yourself (Admin) → create a project (or load the
sample) → connect Jira / capture a doc → ask a question.

## Tech

Next.js 16 (App Router) + TypeScript + Tailwind · SQLite (`better-sqlite3`) ·
local `Xenova/all-MiniLM-L6-v2` embeddings + cosine search · Google Gemini
(streaming for Memory & Foresight).

## Full documentation

See **[docs/README.md](./docs/README.md)**, and
**[docs/09-roadmap-phases.md](./docs/09-roadmap-phases.md)** for the v2 plan
(unified Chat + autonomous Agents).
