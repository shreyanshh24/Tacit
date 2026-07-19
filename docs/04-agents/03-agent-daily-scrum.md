# Daily Scrum Agent

**Type:** scheduled (node-cron, daily). **Goal:** turn the day's standup
transcript into a concrete progress update on the right Jira ticket(s).

## PRD

- **Trigger:** a daily cron on the agent's `schedule_cron` (see
  [02-scheduling.md](./02-scheduling.md)).
- **Inputs:** the latest standup transcript from the Google Drive folder
  `CRM360/01_Meeting_Transcripts` ([../05-integrations/google-drive.md](../05-integrations/google-drive.md));
  the repo branch + `docs/` in the prepared workdir.
- **Behavior:** read the transcript, understand what was discussed and by whom,
  read the repo/docs for context, **map the discussion to the relevant Jira
  ticket(s)**, then post a progress comment/update on each.
- **Outputs:** a Jira comment per ticket
  ([../05-integrations/jira.md](../05-integrations/jira.md)) and an
  `agent_runs.result` summary with `jira_ref`(s).
- **Non-goals:** it does not close tickets or transition status by default
  (transition is available but off unless configured).

## Flow

```mermaid
sequenceDiagram
  participant Cron as node-cron
  participant R as runner.ts
  participant Drive as drive.ts (Drive)
  participant WD as workdir (repo+docs)
  participant CP as claude -p
  participant Jira as jira-comment wrapper

  Cron->>R: fire (queued run)
  R->>Drive: fetch latest transcript (CRM360/01_Meeting_Transcripts)
  R->>WD: prepareWorkdir(branch) — clone/fetch repo + docs
  R->>CP: spawn (prompt + transcript, cwd=workdir)
  CP->>WD: Read/Grep repo & docs for context
  CP->>CP: map discussion → relevant Jira ticket(s)
  CP->>Jira: Bash → jira-comment.ts (post progress update)
  Jira-->>CP: comment url
  CP-->>R: result (tickets updated) + stream-json log
  R->>R: agent_runs.result + jira_ref, status=done
```

See the end-to-end version in [../07-flows.md](../07-flows.md) and the demo Drive
corpus in [../08-demo-data.md](../08-demo-data.md).
