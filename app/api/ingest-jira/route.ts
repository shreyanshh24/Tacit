import { NextResponse } from "next/server";
import { getDb, ProjectRow } from "@/lib/db";
import { embed } from "@/lib/embeddings";
import { fetchJiraIssues } from "@/lib/jira";
import { getSession } from "@/lib/session";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { projectKey } = await req.json();
    if (!projectKey || typeof projectKey !== "string") {
      return NextResponse.json({ error: "Missing projectKey" }, { status: 400 });
    }

    const db = getDb();
    const session = await getSession();

    // If a project is active, only its owner may connect/import Jira.
    let project: ProjectRow | undefined;
    if (session.projectId) {
      project = db
        .prepare("SELECT * FROM projects WHERE id = ?")
        .get(session.projectId) as ProjectRow | undefined;
      if (project && project.owner_member_id !== session.memberId) {
        return NextResponse.json(
          { error: "Only the project owner can connect Jira for this project." },
          { status: 403 }
        );
      }
    }

    const conn = project
      ? { baseUrl: project.jira_base_url, email: project.jira_email, token: project.jira_token }
      : undefined;
    const issues = await fetchJiraIssues(projectKey, conn);
    // Upsert by source_id so re-importing the same project doesn't duplicate.
    const del = db.prepare("DELETE FROM documents WHERE source_id = ?");
    const insert = db.prepare(
      `INSERT INTO documents (source, source_id, author, ts, title, content, embedding, project_id, member_id)
       VALUES (@source, @source_id, @author, @ts, @title, @content, @embedding, @project_id, @member_id)`
    );

    let inserted = 0;
    for (const doc of issues) {
      const embedding = JSON.stringify(await embed(`${doc.title}\n${doc.content}`));
      del.run(doc.source_id);
      insert.run({
        ...doc,
        embedding,
        project_id: session.projectId,
        member_id: session.memberId,
      });
      inserted++;
    }

    const upperKey = projectKey.trim().toUpperCase();

    // Remember the Jira key on the active project.
    if (project) {
      db.prepare("UPDATE projects SET jira_project_key = ? WHERE id = ?").run(
        upperKey,
        project.id
      );
    }

    await logActivity({
      type: "jira_import",
      title: `Imported ${inserted} issue${inserted === 1 ? "" : "s"} from Jira (${upperKey})`,
      detail: `Live connector · project ${upperKey}`,
      ref: upperKey,
    });

    return NextResponse.json({
      success: true,
      documentsInserted: inserted,
      projectKey: upperKey,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
}
