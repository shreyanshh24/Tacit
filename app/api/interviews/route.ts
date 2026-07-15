import { NextResponse } from "next/server";
import { getDb, InterviewRow, DocumentRow } from "@/lib/db";
import { search, formatChunks } from "@/lib/retrieval";
import { generateJSON, friendlyGeminiError } from "@/lib/gemini";
import { interviewQuestionsPrompt } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function describeTrigger(row: InterviewRow): string {
  if (row.trigger_type === "incident_resolved") {
    return `An incident (${row.trigger_ref}) was resolved`;
  }
  return `${row.trigger_type} (${row.trigger_ref})`;
}

export async function GET() {
  try {
    const db = getDb();
    const rows = db
      .prepare("SELECT * FROM interviews ORDER BY id ASC")
      .all() as InterviewRow[];

    const update = db.prepare("UPDATE interviews SET questions = ? WHERE id = ?");

    for (const row of rows) {
      const questions = row.questions ? JSON.parse(row.questions) : [];
      if (row.status === "pending" && questions.length === 0) {
        try {
          // Ground the questions in the triggering document + related context.
          const triggerDoc = db
            .prepare("SELECT * FROM documents WHERE source_id = ?")
            .get(row.trigger_ref) as DocumentRow | undefined;

          const query = triggerDoc
            ? `${triggerDoc.title}\n${triggerDoc.content}`
            : (row.trigger_ref ?? "");
          const related = await search(query, 4);

          const result = await generateJSON(
            interviewQuestionsPrompt(
              describeTrigger(row),
              row.person ?? "the responder",
              formatChunks(related)
            )
          );
          const qs: string[] = Array.isArray(result?.questions)
            ? result.questions.slice(0, 4)
            : [];
          update.run(JSON.stringify(qs), row.id);
          row.questions = JSON.stringify(qs);
        } catch (e) {
          // Non-fatal: still list the interview so the inbox renders.
          console.error(`Question generation failed for interview ${row.id}:`, e);
        }
      }
    }

    const interviews = rows.map((r) => ({
      id: r.id,
      trigger_type: r.trigger_type,
      trigger_ref: r.trigger_ref,
      person: r.person,
      questions: r.questions ? JSON.parse(r.questions) : [],
      answers: r.answers ? JSON.parse(r.answers) : [],
      status: r.status,
      created_at: r.created_at,
    }));

    return NextResponse.json({ ok: true, interviews });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: friendlyGeminiError(e) }, { status: 500 });
  }
}
