# Tacit documentation

Documentation for **Tacit** — an AI-powered organizational-memory brain — and its
**v2** refactor (one unified Chat + autonomous Agents). v2 work happens on branch
**`v2`**.

## Contents

- [00 — Overview](./00-overview.md) — what Tacit is + the v2 vision.
- [01 — Architecture](./01-architecture.md) — current shell & libs, v2 target,
  component + request-flow diagrams.
- [02 — Data model](./02-data-model.md) — full SQLite schema + new v2 tables.
- [03 — Chat router](./03-chat-router.md) — unified Chat, intents, classifier,
  dispatch, persistence.

### Agents
- [04 · 00 — Overview](./04-agents/00-overview.md) — model, tables, lifecycle.
- [04 · 01 — Runtime (`claude -p`)](./04-agents/01-runtime-claude-p.md) — spawn,
  stream-json, tool scoping, constraints.
- [04 · 02 — Scheduling](./04-agents/02-scheduling.md) — node-cron singleton,
  Run-now.
- [04 · 03 — Daily Scrum agent](./04-agents/03-agent-daily-scrum.md)
- [04 · 04 — Tester Ticket agent](./04-agents/04-agent-tester.md)
- [04 · 05 — PR Security agent](./04-agents/05-agent-pr-security.md)

### Integrations
- [05 — Jira](./05-integrations/jira.md) — read-only connector + planned writes.
- [05 — GitHub](./05-integrations/github.md) — PR data + `prepareWorkdir`.
- [05 — Google Drive](./05-integrations/google-drive.md) — transcript pull.

### Product & process
- [06 — PRD](./06-prd.md) — goals, non-goals, user stories, acceptance.
- [07 — Flows](./07-flows.md) — end-to-end sequence diagrams.
- [08 — Demo data](./08-demo-data.md) — the three CRM360 sources + husk→real plan.
- [09 — Roadmap phases](./09-roadmap-phases.md) — the 5 build phases.
- [10 — Security](./10-security.md) — tool scoping, tokens, prompt injection.

## See also (repo root)

- `README.md` — quickstart / setup.
- `AGENTS.md` — Next.js 16 breaking-changes warning (read before writing code).
- `CLAUDE.md` — pointers for contributors/agents.
