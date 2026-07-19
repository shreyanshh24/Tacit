import { NextResponse } from "next/server";
import { getDb, MemberRow } from "@/lib/db";
import { getSession, clearSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const teamId = Number(id);
  const db = getDb();
  const session = await getSession();

  const me = session.memberId
    ? (db.prepare("SELECT * FROM members WHERE id = ?").get(session.memberId) as MemberRow | undefined)
    : undefined;
  // Only an Admin of this team may delete it.
  if (!me || me.team_id !== teamId || me.role !== "Admin") {
    return NextResponse.json(
      { error: "Only an Admin of this team can delete it." },
      { status: 403 }
    );
  }

  const projects = db
    .prepare("SELECT id FROM projects WHERE team_id = ?")
    .all(teamId) as { id: number }[];

  const tx = db.transaction(() => {
    for (const p of projects) {
      db.prepare("DELETE FROM documents WHERE project_id = ?").run(p.id);
      db.prepare("DELETE FROM decisions WHERE project_id = ?").run(p.id);
    }
    const acts = db
      .prepare("SELECT id FROM activities WHERE team_id = ?")
      .all(teamId) as { id: number }[];
    for (const a of acts) {
      db.prepare("DELETE FROM comments WHERE activity_id = ?").run(a.id);
      db.prepare("DELETE FROM activity_tags WHERE activity_id = ?").run(a.id);
    }
    db.prepare("DELETE FROM activities WHERE team_id = ?").run(teamId);
    db.prepare("DELETE FROM projects WHERE team_id = ?").run(teamId);
    db.prepare("DELETE FROM members WHERE team_id = ?").run(teamId);
    db.prepare("DELETE FROM teams WHERE id = ?").run(teamId);
  });
  tx();

  if (session.teamId === teamId) await clearSession();
  return NextResponse.json({ ok: true });
}
