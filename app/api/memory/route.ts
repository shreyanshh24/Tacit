import { NextResponse } from "next/server";
import { search, formatChunks } from "@/lib/retrieval";
import { memoryPrompt } from "@/lib/prompts";
import { buildStreamingResponse } from "@/lib/stream";
import { friendlyGeminiError } from "@/lib/gemini";
import { logActivity } from "@/lib/activity";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { question } = await req.json();
    if (!question || typeof question !== "string") {
      return NextResponse.json({ error: "Missing question" }, { status: 400 });
    }

    const session = await getSession();
    const docs = await search(question, 8, session.projectId);
    const prompt = memoryPrompt(question, formatChunks(docs));

    await logActivity({ type: "memory", title: question });

    const sources = docs.map((d) => ({
      source_id: d.source_id,
      title: d.title,
      author: d.author,
      ts: d.ts,
      source: d.source,
      content: d.content,
      score: Number(d.score.toFixed(4)),
      linked_jira_key: d.linked_jira_key,
      linked_jira_url: d.linked_jira_url,
    }));

    return buildStreamingResponse(prompt, sources);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: friendlyGeminiError(e) }, { status: 500 });
  }
}
