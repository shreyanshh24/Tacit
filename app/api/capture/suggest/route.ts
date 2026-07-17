import { NextResponse } from "next/server";
import { generateJSON, friendlyGeminiError } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface IssueOpt {
  key: string;
  summary: string;
}

export async function POST(req: Request) {
  try {
    const { content, issues } = (await req.json()) as {
      content: string;
      issues: IssueOpt[];
    };
    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const list =
      Array.isArray(issues) && issues.length
        ? issues.map((i) => `${i.key}: ${i.summary}`).join("\n")
        : "(no tickets available)";

    const prompt = `You help route a captured project document to the most relevant Jira ticket.

Given the document text and a list of candidate tickets, pick the single best-matching ticket key, or null if none is a good fit. Also propose a short, specific title (max 8 words) for the document.

Return strict JSON only: {"suggested_key": "TICKET-123 or null", "confidence": "high|medium|low", "title": "..."}

CANDIDATE TICKETS:
${list}

DOCUMENT:
${content.slice(0, 6000)}`;

    const result = await generateJSON(prompt);
    return NextResponse.json({
      suggested_key:
        result?.suggested_key && result.suggested_key !== "null"
          ? String(result.suggested_key).toUpperCase()
          : null,
      confidence: result?.confidence ?? "low",
      title: result?.title ?? null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: friendlyGeminiError(e) }, { status: 500 });
  }
}
