import { NextResponse } from "next/server";
import { getDb, AgentRow, AgentRunRow } from "@/lib/db";
import { getSession } from "@/lib/session";
import { scheduleAgent, initScheduler } from "@/lib/agents/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List agents for the active project, each with its latest run. */
export async function GET() {
  initScheduler();
  const session = await getSession();
  const db = getDb();
  const agents = (
    session.projectId
      ? db
          .prepare("SELECT * FROM agents WHERE project_id = ? ORDER BY id DESC")
          .all(session.projectId)
      : db.prepare("SELECT * FROM agents ORDER BY id DESC").all()
  ) as AgentRow[];

  const lastRun = db.prepare(
    "SELECT * FROM agent_runs WHERE agent_id = ? ORDER BY id DESC LIMIT 1"
  );

  const out = agents.map((a) => {
    const run = lastRun.get(a.id) as AgentRunRow | undefined;
    return {
      id: a.id,
      type: a.type,
      name: a.name,
      config: a.config ? JSON.parse(a.config) : {},
      enabled: !!a.enabled,
      schedule_cron: a.schedule_cron,
      last_run: run
        ? {
            id: run.id,
            status: run.status,
            started_at: run.started_at,
            finished_at: run.finished_at,
            result: run.result ? JSON.parse(run.result) : null,
            jira_ref: run.jira_ref,
            pr_ref: run.pr_ref,
          }
        : null,
    };
  });
  return NextResponse.json({ agents: out });
}

/** Create an agent. */
export async function POST(req: Request) {
  const session = await getSession();
  const body = await req.json();
  const type = String(body?.type || "");
  if (!["scrum", "tester", "pr_security"].includes(type)) {
    return NextResponse.json({ error: "Invalid agent type" }, { status: 400 });
  }
  const db = getDb();
  const res = db
    .prepare(
      "INSERT INTO agents (project_id, type, name, config, enabled, schedule_cron) VALUES (?, ?, ?, ?, 1, ?)"
    )
    .run(
      session.projectId,
      type,
      body?.name || defaultName(type),
      JSON.stringify(body?.config ?? {}),
      body?.schedule_cron || null
    );
  const id = Number(res.lastInsertRowid);
  const row = db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as AgentRow;
  if (row.schedule_cron) scheduleAgent(row);
  return NextResponse.json({ id });
}

function defaultName(type: string): string {
  return type === "scrum"
    ? "Daily Scrum"
    : type === "tester"
      ? "Ticket Tester"
      : "PR Security Review";
}
