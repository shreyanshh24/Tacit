# End-to-end flows

Cross-references: [03-chat-router.md](./03-chat-router.md),
[04-agents/](./04-agents/00-overview.md).

## A chat turn

```mermaid
sequenceDiagram
  participant U as User
  participant API as POST /api/chat
  participant CL as classifier
  participant H as lib/handlers/*
  participant G as Gemini
  participant DB as chat_messages

  U->>API: message (+ optional forced mode)
  API->>DB: persist user turn
  alt forced (chip/slash)
    API->>H: dispatch(mode)
  else
    API->>CL: classify → {mode}
    API->>H: dispatch(mode)
  end
  H->>G: prompt
  G-->>U: stream __SOURCES__+text (memory/foresight) or card (assumptions/decisions)
  API->>DB: persist assistant turn (mode, sources)
```

## Daily Scrum run

```mermaid
sequenceDiagram
  participant Cron as node-cron
  participant R as runner
  participant D as Drive
  participant WD as workdir
  participant CP as claude -p
  participant J as Jira

  Cron->>R: fire
  R->>D: latest transcript (CRM360/01_Meeting_Transcripts)
  R->>WD: prepareWorkdir(branch)
  R->>CP: spawn (transcript + task)
  CP->>WD: read repo/docs, map → tickets
  CP->>J: Bash → jira-comment (progress)
  CP-->>R: result + jira_ref
```

## Tester run

```mermaid
sequenceDiagram
  participant U as Run now
  participant R as runner
  participant J as Jira
  participant WD as workdir
  participant CP as claude -p

  U->>R: {branch, ticket}
  R->>J: fetch ticket
  R->>WD: prepareWorkdir(branch)
  R->>CP: spawn (task)
  CP->>WD: locate module, generate tests
  CP->>WD: Bash → run tests
  CP->>J: Bash → jira-comment (verdict)
  CP-->>R: result {verdict}
```

## PR Security run

```mermaid
sequenceDiagram
  participant T as PR→main
  participant R as runner
  participant GH as GitHub
  participant WD as workdir
  participant CP as claude -p

  T->>R: {prNumber}
  R->>GH: PR diff + files
  R->>WD: prepareWorkdir(PR branch)
  R->>CP: spawn (review task)
  CP->>WD: read files, security lint, reason
  CP->>GH: Bash → gh pr comment (report)
  CP-->>R: result {findings}
```

See per-agent detail: [Daily Scrum](./04-agents/03-agent-daily-scrum.md) ·
[Tester](./04-agents/04-agent-tester.md) ·
[PR Security](./04-agents/05-agent-pr-security.md).
