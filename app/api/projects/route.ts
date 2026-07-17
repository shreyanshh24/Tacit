import { NextResponse } from "next/server";
import { getDb, ProjectRow } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session.teamId) return NextResponse.json({ projects: [] });
  const db = getDb();
  const projects = db
    .prepare("SELECT * FROM projects WHERE team_id = ? ORDER BY created_at ASC")
    .all(session.teamId) as ProjectRow[];
  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.teamId || !session.memberId) {
    return NextResponse.json(
      { error: "You must be logged in to a team as a member to create a project." },
      { status: 401 }
    );
  }
  const { name } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Project name is required" }, { status: 400 });
  }
  const db = getDb();
  const res = db
    .prepare(
      "INSERT INTO projects (team_id, name, owner_member_id) VALUES (?, ?, ?)"
    )
    .run(session.teamId, name.trim(), session.memberId);
  const project = db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(Number(res.lastInsertRowid)) as ProjectRow;
  return NextResponse.json({ project });
}
