import { NextResponse } from "next/server";
import { scanScrumFolder } from "@/lib/agents/scrumWatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Scan a Scrum agent's folder for new transcripts and queue a run per new file. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const result = scanScrumFolder(Number(id));
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: String((e as Error).message ?? e) },
      { status: 500 }
    );
  }
}
