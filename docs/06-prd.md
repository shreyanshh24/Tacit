# PRD — v2 refactor

## Goals

1. **Collapse the surface area to one Chat.** Replace the 8-item sidebar with a
   single unified Chat that routes any message to the right capability (memory,
   assumptions, foresight, decisions, capture, interview). See
   [03-chat-router.md](./03-chat-router.md).
2. **Add autonomous Agents.** A per-project Agents subsystem that runs real,
   tool-using `claude -p` workers for recurring/valuable engineering tasks. See
   [04-agents/00-overview.md](./04-agents/00-overview.md).
3. **Real integrations.** Jira write, GitHub (PR data + workdir), and Google
   Drive (transcripts) so agents act on real systems. See
   [05-integrations/](./05-integrations/jira.md).

## Non-goals

- No production auth (still name-based cookie session).
- No hosted/multi-user deployment of Agents — they are **localhost-only** (use the
  developer's Claude Code login).
- No Anthropic API key usage; Chat stays on Gemini.
- No encrypted-at-rest token store (demo keeps plaintext tokens).

## User stories

### Chat
- As a user, I type a question and get a **cited memory answer** without picking a
  surface.
- As a user, I can **force a mode** with a chip or slash-command (`/foresight`).
- As a user, I can paste a plan and get **assumption cards** inline.
- As a user, my conversation **persists** per project and reloads with citations.

### Daily Scrum agent
- As a PM, the agent reads the latest standup transcript and posts a **progress
  update** on the relevant Jira ticket(s) each morning.

### Tester agent
- As an engineer, I give the agent a **branch + ticket**; it generates and runs
  tests and posts a **pass/fail verdict** to Jira.

### PR Security agent
- As a reviewer, when a PR targets `main`, the agent posts a **security report**
  as a PR comment, catching planted vulnerabilities.

## Acceptance criteria

- Sidebar shows exactly **Chat** and **Agents**; Activity + Settings live in the
  TopBar menu.
- `POST /api/chat` classifies (or honors forced mode) and dispatches to
  `lib/handlers/*`; memory/foresight keep the `__SOURCES__` stream; assumptions/
  decisions render as cards; turns persist to `chat_conversations`/`chat_messages`.
- `/agents` lists agents + run history, supports New agent / Run now / live
  run-detail log; runs persist to `agents`/`agent_runs` with lifecycle
  `queued→running→done|failed`.
- Each of the three agents completes a real run end-to-end and writes its result
  to `agent_runs.result` plus a Jira comment or PR comment.
- Tokens (Jira, GitHub, Drive) are never passed into an agent; only server-side
  CLI wrappers touch them ([10-security.md](./10-security.md)).

See phased delivery in [09-roadmap-phases.md](./09-roadmap-phases.md).
