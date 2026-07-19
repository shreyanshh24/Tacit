import { NextResponse } from "next/server";
import { getDb, AgentRunRow } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Poll a single run (status + live log + structured result). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const { runId } = await params;
  const db = getDb();
  const run = db
    .prepare("SELECT * FROM agent_runs WHERE id = ?")
    .get(Number(runId)) as AgentRunRow | undefined;
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    run: {
      id: run.id,
      status: run.status,
      trigger: run.trigger,
      started_at: run.started_at,
      finished_at: run.finished_at,
      log: run.log || "",
      result: run.result ? JSON.parse(run.result) : null,
      tests: run.tests_json ? JSON.parse(run.tests_json) : [],
      steps: run.steps_json ? JSON.parse(run.steps_json) : [],
      jira_ref: run.jira_ref,
      pr_ref: run.pr_ref,
    },
  });
}
