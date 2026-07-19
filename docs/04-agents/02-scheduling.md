# Agent scheduling

`lib/agents/scheduler.ts` provides an **in-process** scheduler built on
`node-cron`. It is initialized **once on server boot** as a module singleton —
the same guarded-flag pattern used by `applyMigrations()` in `lib/db.ts` — so it
registers cron jobs exactly once even across hot reloads.

## How it works

- On boot, the scheduler loads every `agents` row with `enabled = 1` and a
  non-null **`schedule_cron`**, and registers a node-cron job per agent.
- When a cron fires, it creates an `agent_runs` row (`trigger = "cron"`,
  `status = queued`) and hands it to `lib/agents/runner.ts` — see
  [01-runtime-claude-p.md](./01-runtime-claude-p.md).
- Editing an agent's `enabled` flag or `schedule_cron` re-registers/cancels its
  job.

## Ad-hoc runs

`POST /api/agents/[id]/run` triggers a run immediately (`trigger = "manual"`),
independent of any schedule — this backs the **Run now** button and any
event-style trigger (e.g. a PR webhook for the
[PR Security agent](./05-agent-pr-security.md)).

## Which agents use schedules

- **Daily Scrum** — a daily cron (e.g. `0 9 * * *`). See
  [03-agent-daily-scrum.md](./03-agent-daily-scrum.md).
- **Tester Ticket** and **PR Security** — on-demand / event-triggered, not
  cron-scheduled.

## Limitation & future

The scheduler only runs **while the Next.js server is up** — jobs do not fire
when the dev server is stopped, and there is no persistence of missed runs. This
matches the localhost-only model of the agents (see
[01-runtime-claude-p.md](./01-runtime-claude-p.md)). A future alternative is an
**external cron** (system `cron` / a hosted scheduler) that hits
`POST /api/agents/[id]/run`, decoupling schedules from server uptime.
