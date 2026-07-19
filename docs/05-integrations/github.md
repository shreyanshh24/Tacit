# Integration — GitHub

`lib/github.ts` is a **new v2** integration. It has two jobs: expose PR data via
the GitHub REST API, and **prepare the working directory** the autonomous agents
operate in.

## Auth

- **`GITHUB_TOKEN`** (personal access token) in the server env, sent as a Bearer
  token to the GitHub REST API. The token stays server-side; agents never receive
  it directly ([../10-security.md](../10-security.md)).

## REST helpers

- **List PRs** — enumerate open PRs for the repo (used to find PRs targeting
  `main` for the [PR Security agent](../04-agents/05-agent-pr-security.md)).
- **Get PR diff / files** — fetch a PR's unified diff and changed-file list to
  feed the reviewer.

## `prepareWorkdir(branch)`

This is the bridge between "GitHub REST API + token" and **autonomous local tool
use**. It **clones/fetches** the target branch into a **temporary directory**,
which becomes the `cwd` for `claude -p`:

```
prepareWorkdir("feature-x")
  → git clone/fetch Alin-Verma/CRM360 (branch feature-x) into /tmp/tacit-wd-XXXX
  → return that path as the agent workdir
```

The agent then uses **Read / Grep / Glob / Bash** against real files on disk —
so it can locate modules, run tests ([Tester](../04-agents/04-agent-tester.md)),
and read changed files ([PR Security](../04-agents/05-agent-pr-security.md))
exactly as a developer would, confined to that temp dir. See
[../04-agents/01-runtime-claude-p.md](../04-agents/01-runtime-claude-p.md).

## Posting back

PR comments are posted via the `gh` CLI (or a `pr-comment` wrapper) through the
agent's Bash tool, keeping the token server-side. Results and the PR reference
are recorded in `agent_runs` (`pr_ref`) — see
[../04-agents/00-overview.md](../04-agents/00-overview.md).
