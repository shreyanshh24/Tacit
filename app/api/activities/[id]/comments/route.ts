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
  const comments = db
    .prepare(
      `SELECT c.*, m.name AS member_name
       FROM comments c
       LEFT JOIN members m ON m.id = c.member_id
       WHERE c.activity_id = ?
       ORDER BY c.id ASC`
    )
    .all(Number(id)) as Array<Record<string, unknown>>;
  return NextResponse.json({ comments });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const activityId = Number(id);
  const session = await getSession();
  if (!session.memberId) {
    return NextResponse.json(
      { error: "You must be signed in as a member to comment." },
      { status: 401 }
    );
  }
  const { body } = await req.json();
  if (!body || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });
  }
  const db = getDb();
  const exists = db.prepare("SELECT id FROM activities WHERE id = ?").get(activityId);
  if (!exists) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }
  const res = db
    .prepare("INSERT INTO comments (activity_id, member_id, body) VALUES (?, ?, ?)")
    .run(activityId, session.memberId, body.trim());
  const comment = db
    .prepare(
      `SELECT c.*, m.name AS member_name
       FROM comments c LEFT JOIN members m ON m.id = c.member_id
       WHERE c.id = ?`
    )
    .get(Number(res.lastInsertRowid));
  return NextResponse.json({ comment });
}
