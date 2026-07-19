import { NextResponse } from "next/server";
import { startAgentRun } from "@/lib/agents/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kick off an agent run in the background and return its run id immediately.
 * The client navigates to the agent's page and polls the run to watch it live.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const runId = startAgentRun(Number(id), "manual");
    return NextResponse.json({ runId });
  } catch (e) {
    return NextResponse.json(
      { error: String((e as Error).message ?? e) },
      { status: 500 }
    );
  }
}
