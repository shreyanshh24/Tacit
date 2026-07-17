import { NextResponse } from "next/server";
import { getDb, InterviewRow } from "@/lib/db";
import { generateJSON, friendlyGeminiError } from "@/lib/gemini";
import { embed } from "@/lib/embeddings";
import { interviewSynthesisPrompt } from "@/lib/prompts";
import { logActivity } from "@/lib/activity";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface QA {
  q: string;
  a: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const interviewId = Number(id);
    const { answers } = (await req.json()) as { answers: QA[] };

    if (!Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json({ error: "Missing answers" }, { status: 400 });
    }

    const db = getDb();
    const row = db
      .prepare("SELECT * FROM interviews WHERE id = ?")
      .get(interviewId) as InterviewRow | undefined;
    if (!row) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    // Persist answers, attributing them to the current member.
    const session = await getSession();
    db.prepare(
      "UPDATE interviews SET answers = ?, status = ?, answered_by = ? WHERE id = ?"
    ).run(JSON.stringify(answers), "answered", session.memberId, interviewId);

    // Synthesize a durable knowledge document.
    const person = row.person ?? "the responder";
    const qaText = answers.map((qa) => `Q: ${qa.q}\nA: ${qa.a}`).join("\n\n");

    // synthesis prompt returns prose; wrap in JSON so we can reuse generateJSON,
    // OR call streaming. Here we ask the model for prose via a JSON wrapper is
    // brittle, so we use generateJSON with an explicit JSON contract.
    const synthPrompt =
      interviewSynthesisPrompt(person, qaText) +
      `\n\nReturn strict JSON only: {"title": "...", "document": "the full markdown document text"}`;

    const synth = await generateJSON(synthPrompt);
    const title: string =
      synth?.title ?? `Incident knowledge — ${row.trigger_ref}`;
    const documentText: string = synth?.document ?? "";

    // Insert as a new, embedded, retrievable document.
    const sourceId = `INTERVIEW-${interviewId}`;
    const embedding = JSON.stringify(await embed(`${title}\n${documentText}`));

    // Replace any prior synthesis for idempotency.
    db.prepare("DELETE FROM documents WHERE source_id = ?").run(sourceId);
    db.prepare(
      `INSERT INTO documents (source, source_id, author, ts, title, content, embedding, project_id, member_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "interview",
      sourceId,
      person,
      new Date().toISOString().slice(0, 10),
      title,
      documentText,
      embedding,
      row.project_id ?? session.projectId,
      session.memberId
    );

    db.prepare("UPDATE interviews SET status = ? WHERE id = ?").run(
      "synthesized",
      interviewId
    );

    await logActivity({
      type: "interview",
      title: `Interview answered: ${row.trigger_ref ?? "incident"}`,
      detail: `Knowledge captured as ${sourceId} — "${title}"`,
      ref: sourceId,
    });

    return NextResponse.json({
      ok: true,
      source_id: sourceId,
      title,
      document: documentText,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: friendlyGeminiError(e) }, { status: 500 });
  }
}
