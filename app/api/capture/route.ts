import { NextResponse } from "next/server";
import { getDb, DocumentRow, ProjectRow } from "@/lib/db";
import { embed } from "@/lib/embeddings";
import { getSession } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { jiraIssueUrl } from "@/lib/jira";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** List captured context documents for the current project (newest first). */
export async function GET() {
  try {
    const session = await getSession();
    const db = getDb();
    const rows = (
      session.projectId
        ? db
            .prepare(
              "SELECT * FROM documents WHERE source = 'upload' AND (project_id = ? OR project_id IS NULL) ORDER BY id DESC"
            )
            .all(session.projectId)
        : db
            .prepare("SELECT * FROM documents WHERE source = 'upload' ORDER BY id DESC")
            .all()
    ) as DocumentRow[];

    const memberName = db.prepare("SELECT name FROM members WHERE id = ?");
    const captures = rows.map((r) => ({
      id: r.id,
      source_id: r.source_id,
      title: r.title,
      content: r.content,
      ts: r.ts,
      author: r.author,
      linked_jira_key: r.linked_jira_key,
      linked_jira_url: r.linked_jira_url,
      member_name: r.member_id
        ? ((memberName.get(r.member_id) as { name: string } | undefined)?.name ?? null)
        : null,
    }));
    return NextResponse.json({ captures });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { captures: [], error: String((e as Error).message ?? e) },
      { status: 200 }
    );
  }
}

/** Create a captured context document, embed it, and optionally link a ticket. */
export async function POST(req: Request) {
  try {
    const { title, content, jiraKey } = await req.json();
    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const session = await getSession();
    const db = getDb();

    const memberName = session.memberId
      ? ((db.prepare("SELECT name FROM members WHERE id = ?").get(session.memberId) as
          | { name: string }
          | undefined)?.name ?? null)
      : null;

    const cleanTitle =
      (title && String(title).trim()) ||
      content.trim().split("\n")[0].slice(0, 80) ||
      "Untitled context";

    const project = session.projectId
      ? (db.prepare("SELECT * FROM projects WHERE id = ?").get(session.projectId) as
          | ProjectRow
          | undefined)
      : undefined;

    const key = jiraKey ? String(jiraKey).trim().toUpperCase() : null;
    const jiraUrl = key ? jiraIssueUrl(key, project?.jira_base_url) : null;

    // Unique source id for this capture.
    const seq =
      (db.prepare("SELECT COUNT(*) AS c FROM documents WHERE source = 'upload'").get() as {
        c: number;
      }).c + 1;
    const sourceId = `UPLOAD-${seq}`;

    const embedding = JSON.stringify(await embed(`${cleanTitle}\n${content}`));

    db.prepare(
      `INSERT INTO documents
         (source, source_id, author, ts, title, content, embedding, project_id, member_id, linked_jira_key, linked_jira_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "upload",
      sourceId,
      memberName,
      new Date().toISOString().slice(0, 10),
      cleanTitle,
      content.trim(),
      embedding,
      session.projectId,
      session.memberId,
      key,
      jiraUrl
    );

    await logActivity({
      type: "capture",
      title: `Captured context: ${cleanTitle}`,
      detail: key ? `Linked to ${key}` : "No Jira ticket linked",
      ref: key ?? sourceId,
    });

    return NextResponse.json({
      success: true,
      source_id: sourceId,
      title: cleanTitle,
      linked_jira_key: key,
      linked_jira_url: jiraUrl,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
}
