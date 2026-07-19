// Daily Scrum folder-watch. A Scrum agent is bound to a transcripts folder; a
// scan finds transcripts not yet processed and creates ONE run per new file
// under that same agent. Runs are processed sequentially in the background so we
// never spawn many `claude -p` processes at once.

import path from "path";
import { getDb, AgentRow } from "../db";
import { runAgent } from "./runner";
import { listTranscriptsIn } from "../transcripts";

export const DEFAULT_SCRUM_FOLDER = "data/crm360/01_Meeting_Transcripts";

/** Resolve a scrum agent's watched folder to an absolute path. */
export function scrumFolder(config: Record<string, unknown>): string {
  return path.resolve(
    process.cwd(),
    String(config.folder || DEFAULT_SCRUM_FOLDER)
  );
}

/** Transcript filenames already processed by this agent (from run inputs). */
function processedFiles(agentId: number): Set<string> {
  const db = getDb();
  const runs = db
    .prepare("SELECT input FROM agent_runs WHERE agent_id = ?")
    .all(agentId) as { input: string | null }[];
  const set = new Set<string>();
  for (const r of runs) {
    try {
      const inp = r.input ? JSON.parse(r.input) : {};
      if (inp.transcriptName) set.add(String(inp.transcriptName));
    } catch {
      /* ignore */
    }
  }
  return set;
}

/**
 * Scan a scrum agent's folder for new transcripts and queue one run per new
 * file. Returns immediately with the queued filenames; runs execute in the
 * background, one at a time.
 */
export function scanScrumFolder(agentId: number): {
  queued: number;
  files: string[];
} {
  const db = getDb();
  const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(agentId) as
    | AgentRow
    | undefined;
  if (!agent || agent.type !== "scrum") return { queued: 0, files: [] };

  const config = agent.config ? JSON.parse(agent.config) : {};
  const folder = scrumFolder(config);
  const done = processedFiles(agentId);
  const fresh = listTranscriptsIn(folder)
    .map((f) => f.name)
    .filter((name) => !done.has(name));

  // Process sequentially in the background; each run() inserts its row at start,
  // so it appears in the agent's run list immediately and won't be re-queued.
  (async () => {
    for (const name of fresh) {
      try {
        await runAgent(agentId, "schedule", { transcriptName: name });
      } catch (e) {
        console.error(`[tacit] scrum run for ${name} failed`, e);
      }
    }
  })();

  return { queued: fresh.length, files: fresh };
}
