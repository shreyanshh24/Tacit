import { NextResponse } from "next/server";
import { listOpenPRs } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List open PRs on the configured repo (for the PR-security agent form). */
export async function GET() {
  try {
    const prs = await listOpenPRs();
    return NextResponse.json({ prs });
  } catch (e) {
    return NextResponse.json(
      { prs: [], error: String((e as Error).message ?? e) },
      { status: 200 }
    );
  }
}
