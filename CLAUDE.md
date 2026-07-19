@AGENTS.md

# Pointers for contributors & agents

- **[AGENTS.md](./AGENTS.md)** — this is **not** the Next.js you know (Next.js 16
  breaking changes). Read the relevant guide in `node_modules/next/dist/docs/`
  before writing code.
- **[docs/README.md](./docs/README.md)** — full documentation index.
- **[docs/01-architecture.md](./docs/01-architecture.md)** — current shell, libs,
  and the v2 target.
- **[docs/02-data-model.md](./docs/02-data-model.md)** — SQLite schema (+ v2
  tables) and the `ensureColumn` migration pattern.
- **[docs/09-roadmap-phases.md](./docs/09-roadmap-phases.md)** — the v2 build plan.

**v2 work happens on branch `v2`.** The Agents subsystem uses the local
`claude -p` CLI (developer's Claude Code login) and is **localhost-only** — see
[docs/04-agents/01-runtime-claude-p.md](./docs/04-agents/01-runtime-claude-p.md)
and [docs/10-security.md](./docs/10-security.md).
