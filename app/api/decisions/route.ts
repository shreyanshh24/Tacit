import { NextResponse } from "next/server";
import { getDb, DecisionRow } from "@/lib/db";
import { getSession } from "@/lib/session";
import { runExtractForProject } from "@/lib/ingest";
import { friendlyGeminiError } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** List decisions extracted for the active project. */
export async function GET() {
  const session = await getSession();
  const db = getDb();
  const rows = (
    session.projectId
      ? db
          .prepare("SELECT * FROM decisions WHERE project_id = ? ORDER BY ts DESC, id DESC")
          .all(session.projectId)
      : db.prepare("SELECT * FROM decisions ORDER BY ts DESC, id DESC").all()
  ) as DecisionRow[];

  const decisions = rows.map((r) => ({
    id: r.id,
    title: r.title,
    decision: r.decision,
    reasoning: r.reasoning,
    outcome: r.outcome,
    ts: r.ts,
    alternatives: safeParse(r.alternatives),
    people: safeParse(r.people),
    source_ids: safeParse(r.source_ids),
  }));
  return NextResponse.json({ decisions });
}

/** (Re)run extraction over the active project's documents. */
export async function POST() {
  try {
    const session = await getSession();
    if (!session.projectId) {
      return NextResponse.json({ error: "No active project." }, { status: 400 });
    }
    const result = await runExtractForProject(session.projectId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: friendlyGeminiError(e) }, { status: 500 });
  }
}

function safeParse(s: string | null): unknown[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
