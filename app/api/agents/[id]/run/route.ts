import { NextResponse } from "next/server";
import { getDb, AgentRunRow } from "@/lib/db";
import { runAgent } from "@/lib/agents/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Run an agent now (synchronous) and return the finished run. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const runId = await runAgent(Number(id), "manual");
    const db = getDb();
    const run = db.prepare("SELECT * FROM agent_runs WHERE id = ?").get(runId) as
      | AgentRunRow
      | undefined;
    return NextResponse.json({
      run: run
        ? {
            id: run.id,
            status: run.status,
            log: run.log,
            result: run.result ? JSON.parse(run.result) : null,
            jira_ref: run.jira_ref,
            pr_ref: run.pr_ref,
            started_at: run.started_at,
            finished_at: run.finished_at,
          }
        : null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: String((e as Error).message ?? e) },
      { status: 500 }
    );
  }
}
