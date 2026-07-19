# Tacit — a company that never forgets

AI-powered organizational memory + autonomous agents. Tacit reads a team's work
history (Jira tickets, Google Drive docs, meeting transcripts, repo docs) and
turns it into a queryable brain that remembers *why* decisions were made,
surfaces hidden assumptions, and runs grounded pre-mortems. It also runs
autonomous **agents** (ticket tester, PR security review, daily scrum) on the
local `claude` CLI.

Two surfaces: **Chat** (auto-routed memory / foresight / assumptions / decisions
/ capture) and **Agents**.

## Prerequisites

- **Node.js 20+**
- **Claude Code CLI** installed and logged in — the app shells out to `claude -p`
  for all chat generation and agents (no API key needed). Verify: `claude --version`.
- **GitHub CLI** (`gh`) installed and authenticated (`gh auth login`) — used by
  the agents and by chat's repo-docs retrieval. Verify: `gh auth status`.
- **A Jira Cloud API token** (optional but recommended for the demo) —
  <https://id.atlassian.com/manage-profile/security/api-tokens>.
- Google AI (Gemini) key is **optional** — only needed if you set
  `LLM_PROVIDER=gemini`. The default (`claude`) needs no key.

## Setup

```bash
# 1. Install dependencies (native modules for embeddings + SQLite)
npm install

# 2. Create .env.local (see keys below)

# 3. Warm the local embedding model (first run downloads ~25MB)
npm run setup

# 4. Start the app
npm run dev            # http://localhost:3000
```

### `.env.local`

```bash
# Engine: use the local Claude Code login (default). No key required.
LLM_PROVIDER=claude
# CLAUDE_BIN=claude                 # override if `claude` isn't on PATH
# CLAUDE_FAST_MODEL=claude-haiku-4-5-20251001   # cheap model for routing

# Agents: the target code repo (owner/name), read via the authed `gh` CLI.
CRM360_REPO=Your-Org/CRM360

# Where the Daily Scrum agent watches for transcripts (default shown).
TRANSCRIPTS_DIR=./data/transcripts

# Jira Cloud connection (fallback for any project without an in-app connection).
JIRA_BASE_URL=https://your-site.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=ATATT...

# Only if LLM_PROVIDER=gemini:
# GOOGLE_API_KEY=AIza...
# GEMINI_MODEL=gemini-2.5-flash
```

## First run in the app

1. **Log in**: create a team → add yourself (Admin) → create/select a project
   (e.g. **CRM360**).
2. **Connect Jira** (Chat empty state or `/jira`) and **import issues** so the
   board is in memory.
3. **Sync knowledge sources**: go to **Settings → Sync sources**. This ingests
   the Google Drive docs under `data/crm360/**`, local transcripts, and the repo
   `docs/` (main branch) into searchable memory, then re-extracts decisions.
   > The Drive docs are shipped as local markdown under `data/crm360/`. To refresh
   > them from Drive, re-download into that folder and click Sync again.
4. **Chat**: click **💡 Prompt ideas** for categorized examples, or just ask.
   Chat auto-routes to memory / foresight / assumptions / decisions / capture.
5. **Agents** (`/agents`): create a Ticket Tester (branch + ticket), a PR
   Security Review (branch to watch), or a Daily Scrum (transcripts folder).

## Agents

- **Ticket Tester** — clones a branch, generates & runs the ticket's tests, posts
  a pass/fail verdict to Jira. Live view shows each test as a pass/fail card.
- **PR Security Review** — watches a branch; when a PR targets it, reviews the
  diff for vulnerabilities and comments on the PR. Live view shows finding cards.
- **Daily Scrum** — watches a transcripts folder; a daily scan (or "Check for new
  transcripts") processes each new transcript in its own run: posts a progress
  update to every ticket mentioned and logs any decisions to the project.

The in-process scheduler + PR watcher start on server boot (`instrumentation.ts`),
so **restart `npm run dev` after adding scheduled/watching agents**.

## Tech

Next.js 16 (App Router) + TypeScript + Tailwind · SQLite (`better-sqlite3`) ·
local `Xenova/all-MiniLM-L6-v2` embeddings + cosine search · generation via the
local `claude` CLI (`claude -p`) · Jira REST v3 · GitHub via `gh`.

## Full documentation

See **[docs/README.md](./docs/README.md)**.
