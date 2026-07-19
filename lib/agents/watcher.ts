// PR watcher for pr_security agents. Polls open PRs on the configured repo and,
// when a PR targets a branch a pr_security agent is watching, auto-triggers a
// review run (which posts a comment on the PR). Runs are de-duped so each PR is
// only reviewed once per agent. Boots once on server startup via instrumentation.

import { getDb, AgentRow } from "../db";
import { listOpenPRs } from "../github";
import { startAgentRun } from "./runner";

const POLL_MS = 20_000;

interface WatcherState {
  started: boolean;
  seen: Set<string>; // `${agentId}:${prNumber}` fast-path de-dupe
}

const g = globalThis as unknown as { __tacitWatcher?: WatcherState };
if (!g.__tacitWatcher) g.__tacitWatcher = { started: false, seen: new Set() };
const state = g.__tacitWatcher;

/** Start the PR watcher poll loop (idempotent). */
export function initWatcher(): void {
  if (state.started) return;
  state.started = true;
  setInterval(() => {
    tick().catch((e) => console.error("[tacit] PR watcher tick failed", e));
  }, POLL_MS);
  console.log("[tacit] PR watcher started");
}

async function tick(): Promise<void> {
  const db = getDb();
  const agents = db
    .prepare("SELECT * FROM agents WHERE type = 'pr_security' AND enabled = 1")
    .all() as AgentRow[];
  if (!agents.length) return;

  let prs;
  try {
    prs = await listOpenPRs();
  } catch {
    return; // gh not ready / offline — try again next tick
  }

  for (const a of agents) {
    const cfg = a.config ? JSON.parse(a.config) : {};
    const base = String(cfg.baseBranch || cfg.branch || "main").trim();
    const matching = prs.filter((p) => (p.baseRefName || "") === base);

    for (const pr of matching) {
      const dedup = `${a.id}:${pr.number}`;
      if (state.seen.has(dedup)) continue;

      // Durable de-dupe: already reviewed this PR?
      const existing = db
        .prepare(
          "SELECT id FROM agent_runs WHERE agent_id = ? AND pr_ref = ? LIMIT 1"
        )
        .get(a.id, String(pr.number));
      if (existing) {
        state.seen.add(dedup);
        continue;
      }

      // Don't pile up: let a running review finish before starting the next.
      const running = db
        .prepare(
          "SELECT id FROM agent_runs WHERE agent_id = ? AND status = 'running' LIMIT 1"
        )
        .get(a.id);
      if (running) continue;

      state.seen.add(dedup);
      console.log(
        `[tacit] PR #${pr.number} targets "${base}" — triggering pr_security agent ${a.id}`
      );
      startAgentRun(a.id, "schedule", { prNumber: pr.number });
    }
  }
}
