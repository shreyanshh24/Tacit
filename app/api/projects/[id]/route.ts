import { NextResponse } from "next/server";
import { getDb, MemberRow, ProjectRow } from "@/lib/db";
import { getSession, writeSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const projectId = Number(id);
  const db = getDb();
  const session = await getSession();

  const project = db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(projectId) as ProjectRow | undefined;
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const me = session.memberId
    ? (db.prepare("SELECT * FROM members WHERE id = ?").get(session.memberId) as MemberRow | undefined)
    : undefined;
  const isOwner = project.owner_member_id === session.memberId;
  const isAdmin = me?.role === "Admin";
  if (!isOwner && !isAdmin) {
    return NextResponse.json(
      { error: "Only the project owner or a team Admin can delete this project." },
      { status: 403 }
    );
  }

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM documents WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM decisions WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM interviews WHERE project_id = ?").run(projectId);
    const acts = db
      .prepare("SELECT id FROM activities WHERE project_id = ?")
      .all(projectId) as { id: number }[];
    for (const a of acts) {
      db.prepare("DELETE FROM comments WHERE activity_id = ?").run(a.id);
      db.prepare("DELETE FROM activity_tags WHERE activity_id = ?").run(a.id);
    }
    db.prepare("DELETE FROM activities WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
  });
  tx();

  if (session.projectId === projectId) {
    await writeSession({ teamId: session.teamId, memberId: session.memberId, projectId: null });
  }
  return NextResponse.json({ ok: true });
}
