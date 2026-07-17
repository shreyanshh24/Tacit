import { NextResponse } from "next/server";
import { getDb, MemberRow } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const members = db
    .prepare("SELECT * FROM members WHERE team_id = ? ORDER BY created_at ASC")
    .all(Number(id)) as MemberRow[];
  return NextResponse.json({ members });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const teamId = Number(id);
  const { name, email, role } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Member name is required" }, { status: 400 });
  }
  const db = getDb();
  const team = db.prepare("SELECT id FROM teams WHERE id = ?").get(teamId);
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }
  // First member of a team is the Admin by default.
  const count = (
    db.prepare("SELECT COUNT(*) AS c FROM members WHERE team_id = ?").get(teamId) as {
      c: number;
    }
  ).c;
  const finalRole = count === 0 ? "Admin" : (role?.trim() || "Member");
  const res = db
    .prepare("INSERT INTO members (team_id, name, email, role) VALUES (?, ?, ?, ?)")
    .run(teamId, name.trim(), email?.trim() || null, finalRole);
  const member = db
    .prepare("SELECT * FROM members WHERE id = ?")
    .get(Number(res.lastInsertRowid)) as MemberRow;
  return NextResponse.json({ member });
}
