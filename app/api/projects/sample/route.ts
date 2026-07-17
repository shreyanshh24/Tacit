import { NextResponse } from "next/server";
import { getDb, ProjectRow } from "@/lib/db";
import { getSession, writeSession } from "@/lib/session";
import { loadSampleIntoProject } from "@/lib/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SAMPLE_NAME = "Sample: NimbusPay";

export async function POST() {
  try {
    const session = await getSession();
    if (!session.teamId || !session.memberId) {
      return NextResponse.json(
        { error: "Sign in to a team as a member first." },
        { status: 401 }
      );
    }

    const db = getDb();
    let project = db
      .prepare("SELECT * FROM projects WHERE team_id = ? AND name = ?")
      .get(session.teamId, SAMPLE_NAME) as ProjectRow | undefined;

    if (!project) {
      const res = db
        .prepare(
          "INSERT INTO projects (team_id, name, owner_member_id) VALUES (?, ?, ?)"
        )
        .run(session.teamId, SAMPLE_NAME, session.memberId);
      project = db
        .prepare("SELECT * FROM projects WHERE id = ?")
        .get(Number(res.lastInsertRowid)) as ProjectRow;
    }

    const result = await loadSampleIntoProject(project.id);

    // Switch the session to the freshly loaded sample project.
    await writeSession({
      teamId: session.teamId,
      memberId: session.memberId,
      projectId: project.id,
    });

    return NextResponse.json({ ok: true, project, ...result });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
}
