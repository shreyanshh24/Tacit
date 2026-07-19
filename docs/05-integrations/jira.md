# Integration — Jira

`lib/jira.ts` is the Jira connector. Today it is **READ-ONLY**; v2 adds two
narrow **write** helpers so agents can post back.

## Current (read-only)

- **Auth:** HTTP **Basic auth** — `base64(email:apiToken)` in the
  `Authorization` header (Jira Cloud REST v3).
- **`resolveConn()`** — resolves the connection from the **project row**
  (`jira_base_url, jira_email, jira_token, jira_project_key`), falling back to env
  `JIRA_BASE_URL` / `JIRA_EMAIL` / `JIRA_API_TOKEN`.
- **Functions:**
  - `jiraIssueUrl(key)` — build a browse URL from the base URL.
  - `fetchJiraIssueList()` — list issue keys/summaries (for pickers).
  - `fetchJiraIssues()` — map up to **50** issues; flattens **ADF → text** for
    descriptions and includes **comments**. **Status is NOT included/imported.**
- There is **no POST/PUT** anywhere in the current file.

## Planned (write helpers)

Two helpers reuse `resolveConn()` and the same Basic-auth header so tokens stay
server-side ([../10-security.md](../10-security.md)):

- **`jiraComment(issueKey, body)`** — `POST /rest/api/3/issue/{key}/comment`
  (body sent as ADF or text). Used by the
  [Daily Scrum](../04-agents/03-agent-daily-scrum.md) and
  [Tester](../04-agents/04-agent-tester.md) agents.
- **`jiraTransition(issueKey, transitionId)`** —
  `POST /rest/api/3/issue/{key}/transitions` (optionally
  `GET /rest/api/3/issue/{key}/transitions` first to resolve the id). Used to
  move a ticket's status when configured.

Agents never call these directly — they invoke a **thin CLI wrapper**
(`scripts/agent-tools/jira-comment.ts`) through the Bash tool so the token is
read from the server env, not passed into the agent. See
[../04-agents/01-runtime-claude-p.md](../04-agents/01-runtime-claude-p.md).

> **Security note:** in the demo, Jira tokens are stored in **plaintext** in
> SQLite. Production should encrypt at rest or use Atlassian OAuth (3LO). See
> [../10-security.md](../10-security.md).
