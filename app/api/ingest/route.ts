import { NextResponse } from "next/server";
import { runIngest } from "@/lib/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    const result = await runIngest();
    return NextResponse.json({
      success: true,
      documentsInserted: result.documents,
      interviewsInserted: result.interviews,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: String(e) },
      { status: 500 }
    );
  }
}
