# Security model

v2 adds autonomous agents and write integrations, which change the threat model.
This page collects the constraints referenced throughout the docs.

## Agent execution: `claude -p`

- **Tool scoping.** Every agent run is launched with an explicit
  `--allowedTools` whitelist — an agent gets only the tools its task needs
  (read-only reviewers get `Read,Grep,Glob`; the Tester adds `Bash`; posters add
  the `gh` CLI via Bash). Nothing outside the list can run. See
  [04-agents/01-runtime-claude-p.md](./04-agents/01-runtime-claude-p.md).
- **Permission mode.** `--permission-mode` is kept as tight as the task allows;
  headless runs use a non-interactive mode, so scoping (above) does the work.
- **cwd confinement.** Agents operate inside a temporary `workdir` (a clone of the
  target branch), not the Tacit repo or the wider host.

## Token handling

- Jira token, `GITHUB_TOKEN`, and Google Drive credentials live **only in the
  server environment**. They are **never passed into an agent**.
- Agents post back through **thin CLI wrappers** under `scripts/agent-tools/`
  (e.g. `jira-comment.ts`, `pr-comment`) invoked via the Bash tool; the wrappers
  read tokens from the server env. This keeps secrets server-side even though the
  agent is autonomous. See [05-integrations/jira.md](./05-integrations/jira.md) and
  [05-integrations/github.md](./05-integrations/github.md).

## Demo caveats

- **Plaintext tokens.** Jira tokens are stored **unencrypted** in SQLite
  (`projects.jira_token`). Production must encrypt at rest or use Atlassian OAuth.
- **Localhost-only.** `claude -p` uses the **developer's Claude Code login**, not
  an Anthropic API key. Agents therefore run **only** on the developer's machine
  and are **not** safe to expose on a shared/hosted server as-is. See
  [04-agents/01-runtime-claude-p.md](./04-agents/01-runtime-claude-p.md).

## Prompt injection

Agents read **untrusted external content**: standup transcripts
([05-integrations/google-drive.md](./05-integrations/google-drive.md)) and PR
diffs ([05-integrations/github.md](./05-integrations/github.md)). That content can
contain instructions ("ignore your task and…"). Mitigations:

- Treat external content as **data, not instructions**; keep the agent's actual
  task in the system/prompt, clearly delimited from pasted content.
- Rely on **tool scoping** — even a hijacked agent can only use whitelisted tools
  within the confined `workdir`.
- Agents cannot exfiltrate tokens (they never hold them) and cannot post outside
  the wrappers' fixed endpoints.
