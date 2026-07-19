# Agent runtime — `claude -p`

`lib/agents/runner.ts` executes each agent by spawning the local Claude Code CLI
in headless (`-p`) mode. The CLI reasons and uses tools autonomously; Tacit only
supplies the prompt, scopes the tools, and captures the event stream.

## Spawn

```ts
child_process.spawn(
  [
    "claude", "-p",
    "--output-format", "stream-json",
    "--allowedTools", /* e.g. */ "Read,Grep,Bash,Glob",
    "--permission-mode", /* e.g. */ "acceptEdits",
  ],
  { cwd: workdir }   // the prepared working directory (repo branch + docs)
);
```

- **prompt** is written to the child's **stdin** (the agent's task/PRD), then
  stdin is closed.
- **cwd = workdir** — the temp directory prepared by
  `prepareWorkdir(branch)` (clone/fetch of the repo branch + docs). See
  [../05-integrations/github.md](../05-integrations/github.md).
- **`--output-format stream-json`** emits newline-delimited JSON events (assistant
  text, tool_use, tool_result, result).

## Stream parsing → logs

The runner reads the child's stdout line by line, parses each JSON event, and
**appends a readable rendering to `agent_runs.log`** as it arrives, so the
run-detail view streams live. The terminal `result` event (and any structured
output the agent emits) is stored in `agent_runs.result`; a non-zero exit sets
`status = failed`.

## Security & tool-scoping model

Agents are autonomous, so scoping is the primary safety control:

- **`--allowedTools`** whitelists exactly the tools an agent may use (e.g. a
  read-only reviewer gets `Read,Grep,Glob`; the Tester also gets `Bash`; a
  poster also gets the `gh` CLI via `Bash`). Nothing outside the list runs.
- **`--permission-mode`** controls whether tool calls proceed without prompts.
  Headless runs use a non-interactive mode; keep it as tight as the task allows.
- **`cwd` confinement** — the agent operates inside the temp `workdir`, not the
  Tacit repo or the host at large.
- **Tokens stay server-side.** Agents never receive Jira/GitHub/Drive tokens.
  They call **thin CLI wrappers** under `scripts/agent-tools/` (e.g.
  `jira-comment.ts`) through the Bash tool; the wrappers read tokens from the
  server env. See [../10-security.md](../10-security.md).

## Constraints

- **Localhost-only.** `claude -p` uses the **developer's Claude Code login**, not
  an Anthropic API key — so this only works on a machine where the developer is
  logged in. It is **not** deployable to a shared/hosted server as-is.
- **Prompt injection.** Agents read untrusted external content (transcripts, PR
  diffs). Treat that content as data, not instructions — see
  [../10-security.md](../10-security.md).
