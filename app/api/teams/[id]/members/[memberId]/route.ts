import { NextResponse } from "next/server";
import { getDb, MemberRow } from "@/lib/db";
import { getSession, writeSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { memberId } = await params;
  const targetId = Number(memberId);
  const db = getDb();
  const session = await getSession();

  const me = session.memberId
    ? (db.prepare("SELECT * FROM members WHERE id = ?").get(session.memberId) as MemberRow | undefined)
    : undefined;
  const isAdmin = me?.role === "Admin";
  const isSelf = session.memberId === targetId;
  if (!isAdmin && !isSelf) {
    return NextResponse.json(
      { error: "Only an Admin can remove other members." },
      { status: 403 }
    );
  }

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM activity_tags WHERE member_id = ?").run(targetId);
    db.prepare("DELETE FROM members WHERE id = ?").run(targetId);
  });
  tx();

  // If you removed yourself, drop back to the member picker.
  if (isSelf) {
    await writeSession({ teamId: session.teamId, memberId: null, projectId: session.projectId });
  }
  return NextResponse.json({ ok: true });
}
