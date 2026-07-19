import { NextResponse } from "next/server";
import { getDb, AgentRow, AgentRunRow } from "@/lib/db";
import { unscheduleAgent } from "@/lib/agents/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Get a single agent with its recent run history (no per-run log). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const agent = db
    .prepare("SELECT * FROM agents WHERE id = ?")
    .get(Number(id)) as AgentRow | undefined;
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const runs = db
    .prepare(
      "SELECT id, status, trigger, started_at, finished_at, result, jira_ref, pr_ref FROM agent_runs WHERE agent_id = ? ORDER BY id DESC LIMIT 20"
    )
    .all(Number(id)) as AgentRunRow[];

  return NextResponse.json({
    agent: {
      id: agent.id,
      type: agent.type,
      name: agent.name,
      config: agent.config ? JSON.parse(agent.config) : {},
      enabled: !!agent.enabled,
      schedule_cron: agent.schedule_cron,
    },
    runs: runs.map((r) => ({
      id: r.id,
      status: r.status,
      trigger: r.trigger,
      started_at: r.started_at,
      finished_at: r.finished_at,
      result: r.result ? JSON.parse(r.result) : null,
      jira_ref: r.jira_ref,
      pr_ref: r.pr_ref,
    })),
  });
}

/** Delete an agent (and stop any schedule). */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  unscheduleAgent(Number(id));
  db.prepare("DELETE FROM agent_runs WHERE agent_id = ?").run(Number(id));
  db.prepare("DELETE FROM agents WHERE id = ?").run(Number(id));
  return NextResponse.json({ ok: true });
}
