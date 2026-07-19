# Agents — overview

The Agents subsystem is the second v2 nav item. Unlike Chat (which runs on
Gemini), Agents are **truly agentic**: each run spawns the local **`claude -p`**
CLI in headless mode, which reasons and acts **autonomously** with real tools
(Read, Grep, Bash, `gh`) inside a working directory. No Anthropic API key is
needed — it uses the developer's Claude Code login, which makes the whole
subsystem **localhost-only**. See
[01-runtime-claude-p.md](./01-runtime-claude-p.md) and [../10-security.md](../10-security.md).

## UI

`/agents` lists a project's agents and their run history, with **New agent**,
**Run now**, and a **run-detail** view that streams the live log. Each agent
belongs to one project.

## Data model

Two tables (added via the `ensureColumn` pattern, see [../02-data-model.md](../02-data-model.md)):

- **agents** — `id, project_id, type, name, config (JSON), enabled,
  schedule_cron, created_at`.
- **agent_runs** — `id, agent_id, status, trigger, started_at, finished_at, log,
  result (JSON), jira_ref, pr_ref`.

## Run lifecycle

```
queued ──► running ──► done
                   └──► failed
```

1. **queued** — a run row is created by the scheduler (cron) or the Run-now
   endpoint (`POST /api/agents/[id]/run`); `trigger` records which.
2. **running** — `lib/agents/runner.ts` spawns `claude -p`, streams stream-json
   events, and **appends them to `agent_runs.log` live** so the run-detail view
   updates in real time.
3. **done / failed** — on exit, `finished_at` is set and the structured verdict
   is written to `agent_runs.result`.

## Where results go

- **agent_runs** — every run keeps its full `log` and `result` JSON, plus
  `jira_ref` / `pr_ref` pointing at anything the agent posted.
- **External systems** — agents post back through server-side integrations: a
  **Jira comment/transition** ([../05-integrations/jira.md](../05-integrations/jira.md))
  or a **PR comment** ([../05-integrations/github.md](../05-integrations/github.md)).

## The three agents

1. [Daily Scrum](./03-agent-daily-scrum.md) — scheduled (node-cron); Drive
   transcript → Jira update.
2. [Tester Ticket](./04-agent-tester.md) — on-demand; branch + ticket →
   generate & run tests → verdict.
3. [PR Security](./05-agent-pr-security.md) — PR to `main` → security report.

Scheduling is covered in [02-scheduling.md](./02-scheduling.md).
