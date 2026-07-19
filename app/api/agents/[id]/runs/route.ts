import { NextResponse } from "next/server";
import { getDb, AgentRunRow } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List an agent's runs (newest first). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM agent_runs WHERE agent_id = ? ORDER BY id DESC LIMIT 20")
    .all(Number(id)) as AgentRunRow[];
  const runs = rows.map((r) => ({
    id: r.id,
    status: r.status,
    trigger: r.trigger,
    started_at: r.started_at,
    finished_at: r.finished_at,
    log: r.log,
    result: r.result ? safe(r.result) : null,
    jira_ref: r.jira_ref,
    pr_ref: r.pr_ref,
  }));
  return NextResponse.json({ runs });
}

function safe(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return { raw: s };
  }
}
