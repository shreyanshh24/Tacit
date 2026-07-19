import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { syncSources } from "@/lib/sources";
import { runExtractForProject } from "@/lib/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * (Re)ingest Drive docs + transcripts + repo docs into the active project's
 * memory, then re-extract decisions from the richer corpus.
 */
export async function POST() {
  try {
    const session = await getSession();
    const result = await syncSources(session.projectId ?? null);
    let decisions = 0;
    if (session.projectId) {
      const ext = await runExtractForProject(session.projectId);
      decisions = ext.decisions;
    }
    return NextResponse.json({ ok: true, ...result, decisions });
  } catch (e) {
    return NextResponse.json(
      { error: String((e as Error).message ?? e) },
      { status: 500 }
    );
  }
}
