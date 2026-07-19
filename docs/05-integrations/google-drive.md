# Integration — Google Drive

`lib/drive.ts` is a **new v2** integration that pulls meeting transcripts from
Google Drive for the [Daily Scrum agent](../04-agents/03-agent-daily-scrum.md).

## What it does

- **Auth:** a server-side Google credential (service account / OAuth token) read
  from the server env; the credential never reaches the agent
  ([../10-security.md](../10-security.md)).
- **Target folder:** the Drive folder **`CRM360/01_Meeting_Transcripts`**
  (resolved by name/id). This is the transcript corpus described in
  [../08-demo-data.md](../08-demo-data.md).
- **List latest transcript:** enumerate files in the folder ordered by modified
  time and select the most recent standup transcript.
- **Fetch content:** download/export the transcript text (e.g. `.vtt`/`.txt`/Doc),
  stripping timestamps as the existing Capture path does.

## Feeding the workdir

The scrum agent run pulls the latest transcript, then the transcript text is
handed to `claude -p` alongside the prepared repo/docs workdir
(`prepareWorkdir(branch)`, see
[github.md](./github.md)). The agent reasons over the transcript **plus** the
repo/docs to map the discussion to Jira tickets:

```
drive.latestTranscript(CRM360/01_Meeting_Transcripts)
   └─► transcript text ──► claude -p prompt (cwd = repo+docs workdir)
```

See the full sequence in
[../04-agents/03-agent-daily-scrum.md](../04-agents/03-agent-daily-scrum.md).

> Transcripts are **untrusted external input** — treat their content as data, not
> instructions (prompt-injection). See [../10-security.md](../10-security.md).
