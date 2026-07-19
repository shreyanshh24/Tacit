import { NextResponse } from "next/server";
import { listBranches } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List branches on the configured repo (for agent branch pickers). */
export async function GET() {
  try {
    const branches = await listBranches();
    return NextResponse.json({ branches });
  } catch (e) {
    return NextResponse.json(
      { branches: [], error: String((e as Error).message ?? e) },
      { status: 200 }
    );
  }
}
