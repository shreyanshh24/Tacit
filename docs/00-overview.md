# Tacit — Overview

**Tagline:** *A company that never forgets.*

Tacit is an AI-powered **organizational-memory brain**. It reads a team's work
history — Jira tickets, uploaded docs, meeting transcripts, resolved incidents —
turns it into a queryable memory scoped per project, and lets anyone:

- ask **why** a decision was made and get a cited answer,
- surface the hidden **assumptions** in a new plan,
- get a grounded **pre-mortem** (Foresight) that warns when a proposal repeats a
  past failure, and
- actively **interview** people to capture knowledge that was never written down.

Everything runs locally against a seeded project. Retrieval uses local MiniLM
embeddings + brute-force cosine similarity over SQLite; generation uses Google
Gemini (streaming for Memory & Foresight). See
[01-architecture.md](./01-architecture.md) and
[02-data-model.md](./02-data-model.md) for the current build.

## Today (v1): eight surfaces

Memory (`/`), Assumptions, Foresight, Interviewer, Capture, Decisions, Activity,
Settings — each a sidebar entry, each project-scoped behind a 3-step login
(Team → Member → Project). This is the shipped app documented at length in the
original reference (now split across `docs/`).

## The v2 vision: one Chat + Agents

v2 refactors the workspace from eight surfaces down to **two nav items**:

1. **Chat** (default) — a single unified conversation. Instead of picking a
   surface, you just talk. A hybrid router classifies each message
   (memory / assumptions / foresight / decisions / capture / interview /
   smalltalk) — or you force a mode with a chip or slash-command — and dispatches
   to shared handlers refactored out of today's routes. Streaming answers and
   inline cards render in one thread. Chat stays on **Gemini**. See
   [03-chat-router.md](./03-chat-router.md).

2. **Agents** (per project) — **autonomous** background workers that run the
   local `claude -p` CLI with real tools (Read, Grep, Bash, `gh`) in a working
   directory. Three ship first: a **Daily Scrum** agent, a **Tester Ticket**
   agent, and a **PR Security** agent. Agents integrate Jira (write),
   GitHub, and Google Drive. See [04-agents/00-overview.md](./04-agents/00-overview.md).

Activity and Settings move into the TopBar menu. The v2 plan is delivered in five
build phases — see [09-roadmap-phases.md](./09-roadmap-phases.md).

## Doc map

Start at [README.md](./README.md) for the full index. Key entry points:
[architecture](./01-architecture.md) · [data model](./02-data-model.md) ·
[chat router](./03-chat-router.md) · [agents](./04-agents/00-overview.md) ·
[PRD](./06-prd.md) · [security](./10-security.md).
