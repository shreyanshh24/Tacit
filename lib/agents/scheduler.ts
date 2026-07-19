// In-process cron scheduler for enabled agents. Initialized once on server boot
// (via instrumentation.ts). Uses a globalThis singleton so hot-reloads don't
// stack duplicate jobs.

import cron, { ScheduledTask } from "node-cron";
import { getDb, AgentRow } from "../db";
import { runAgent } from "./runner";

interface CronState {
  started: boolean;
  tasks: Map<number, ScheduledTask>;
}

const g = globalThis as unknown as { __tacitCron?: CronState };
if (!g.__tacitCron) g.__tacitCron = { started: false, tasks: new Map() };
const state = g.__tacitCron;

/** Register cron jobs for all enabled, scheduled agents (idempotent). */
export function initScheduler(): void {
  if (state.started) return;
  state.started = true;
  try {
    const db = getDb();
    const agents = db
      .prepare(
        "SELECT * FROM agents WHERE enabled = 1 AND schedule_cron IS NOT NULL AND schedule_cron <> ''"
      )
      .all() as AgentRow[];
    for (const a of agents) scheduleAgent(a);
    // eslint-disable-next-line no-console
    console.log(`[tacit] scheduler started with ${agents.length} scheduled agent(s)`);
  } catch (e) {
    console.error("[tacit] scheduler init failed", e);
  }
}

/** (Re)register a single agent's cron job. */
export function scheduleAgent(a: AgentRow): void {
  if (!a.schedule_cron || !cron.validate(a.schedule_cron)) return;
  const prev = state.tasks.get(a.id);
  if (prev) {
    prev.stop();
    state.tasks.delete(a.id);
  }
  const task = cron.schedule(a.schedule_cron, () => {
    runAgent(a.id, "schedule").catch((e) =>
      console.error(`[tacit] scheduled run for agent ${a.id} failed`, e)
    );
  });
  state.tasks.set(a.id, task);
}

/** Stop a scheduled agent's job. */
export function unscheduleAgent(id: number): void {
  const t = state.tasks.get(id);
  if (t) {
    t.stop();
    state.tasks.delete(id);
  }
}
