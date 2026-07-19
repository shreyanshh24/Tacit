# Roadmap — build phases

The v2 refactor ships in five phases. v2 work happens on branch **`v2`**.

## Phase 1 — Docs + architecture (NOW)

- **Scope:** this `docs/` set — product overview, current + target architecture,
  data model, chat-router design, agent designs, integration designs, PRD,
  flows, demo-data, security.
- **Acceptance:** docs cross-link and accurately reflect the current code and the
  v2 plan; root pointer files redirect here.

## Phase 2 — Chat router + collapse surfaces

- **Scope:** `POST /api/chat` with the hybrid router (forced mode + generateJSON
  classifier); refactor route logic into `lib/handlers/*.ts`; `chat_conversations`
  / `chat_messages` tables; shared Bubble/message-list; collapse nav to **Chat +
  Agents**; move Activity/Settings to the TopBar menu.
- **Acceptance:** a single Chat thread routes to all capabilities; memory/foresight
  stream with `__SOURCES__`; assumptions/decisions render as cards; turns persist.
  See [03-chat-router.md](./03-chat-router.md).

## Phase 3 — Integration libs + agent infra

- **Scope:** `lib/jira.ts` write helpers (`jiraComment`/`jiraTransition`),
  `lib/github.ts` (PR data + `prepareWorkdir`), `lib/drive.ts`; `agents` /
  `agent_runs` tables; `lib/agents/runner.ts` (`claude -p` spawn + stream-json →
  log); `lib/agents/scheduler.ts` (node-cron singleton); `scripts/agent-tools/*`
  wrappers; `POST /api/agents/[id]/run`; `/agents` UI.
- **Acceptance:** an agent can be created, run ad-hoc, and stream a live log;
  runs persist with the `queued→running→done|failed` lifecycle. See
  [04-agents/00-overview.md](./04-agents/00-overview.md).

## Phase 4 — The three agents (Tester first)

- **Scope:** [Tester](./04-agents/04-agent-tester.md) →
  [Daily Scrum](./04-agents/03-agent-daily-scrum.md) →
  [PR Security](./04-agents/05-agent-pr-security.md).
- **Acceptance:** each agent completes a real run and writes `agent_runs.result`
  plus a Jira/PR comment.

## Phase 5 — Real CRM360 module + planted-vuln PR

- **Scope:** replace the CRM360 husk with a small real TS module + Jest tests, and
  open a PR carrying a planted vulnerability — wired so Tester and PR Security run
  end-to-end. See [08-demo-data.md](./08-demo-data.md).
- **Acceptance:** Tester generates/runs real tests and reports a verdict; PR
  Security finds the planted vulnerability and comments on the PR.
