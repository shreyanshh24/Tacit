import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const tags = db
    .prepare(
      `SELECT t.member_id, m.name AS member_name, m.role AS member_role
       FROM activity_tags t LEFT JOIN members m ON m.id = t.member_id
       WHERE t.activity_id = ? ORDER BY t.id ASC`
    )
    .all(Number(id));
  return NextResponse.json({ tags });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const activityId = Number(id);
  const session = await getSession();
  if (!session.memberId) {
    return NextResponse.json({ error: "Sign in to tag members." }, { status: 401 });
  }
  const { memberId } = await req.json();
  if (!memberId) return NextResponse.json({ error: "memberId required" }, { status: 400 });

  const db = getDb();
  db.prepare(
    "INSERT OR IGNORE INTO activity_tags (activity_id, member_id) VALUES (?, ?)"
  ).run(activityId, Number(memberId));

  const tags = db
    .prepare(
      `SELECT t.member_id, m.name AS member_name, m.role AS member_role
       FROM activity_tags t LEFT JOIN members m ON m.id = t.member_id
       WHERE t.activity_id = ? ORDER BY t.id ASC`
    )
    .all(activityId);
  return NextResponse.json({ tags });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const activityId = Number(id);
  const { memberId } = await req.json();
  const db = getDb();
  db.prepare("DELETE FROM activity_tags WHERE activity_id = ? AND member_id = ?").run(
    activityId,
    Number(memberId)
  );
  const tags = db
    .prepare(
      `SELECT t.member_id, m.name AS member_name, m.role AS member_role
       FROM activity_tags t LEFT JOIN members m ON m.id = t.member_id
       WHERE t.activity_id = ? ORDER BY t.id ASC`
    )
    .all(activityId);
  return NextResponse.json({ tags });
}
