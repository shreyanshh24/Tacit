import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generateJSON, friendlyGeminiError } from "@/lib/gemini";
import { assumptionsPrompt } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface Assumption {
  text: string;
  why_load_bearing: string;
  risk: "high" | "medium" | "low";
  stated_or_implicit: "stated" | "implicit";
}

const riskRank: Record<string, number> = { high: 0, medium: 1, low: 2 };

export async function POST(req: Request) {
  try {
    const { title, plan } = await req.json();
    if (!plan || typeof plan !== "string") {
      return NextResponse.json({ error: "Missing plan" }, { status: 400 });
    }

    const db = getDb();
    const planRow = db
      .prepare("INSERT INTO plans (title, content) VALUES (?, ?)")
      .run(title ?? "Untitled plan", plan);
    const planId = Number(planRow.lastInsertRowid);

    const result = await generateJSON(assumptionsPrompt(plan));
    const assumptions: Assumption[] = Array.isArray(result?.assumptions)
      ? result.assumptions
      : [];

    const insert = db.prepare(
      `INSERT INTO assumptions (plan_id, text, why_load_bearing, risk, stated_or_implicit, validated)
       VALUES (?, ?, ?, ?, ?, 0)`
    );
    for (const a of assumptions) {
      insert.run(
        planId,
        a.text ?? "",
        a.why_load_bearing ?? "",
        a.risk ?? "medium",
        a.stated_or_implicit ?? "implicit"
      );
    }

    assumptions.sort(
      (a, b) => (riskRank[a.risk] ?? 1) - (riskRank[b.risk] ?? 1)
    );

    return NextResponse.json({ ok: true, plan_id: planId, assumptions });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: friendlyGeminiError(e) }, { status: 500 });
  }
}
