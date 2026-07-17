import { NextResponse } from "next/server";
import { getDb, TeamRow } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const teams = db
    .prepare("SELECT * FROM teams ORDER BY name COLLATE NOCASE ASC")
    .all() as TeamRow[];
  return NextResponse.json({ teams });
}

export async function POST(req: Request) {
  const { name } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Team name is required" }, { status: 400 });
  }
  const db = getDb();
  const res = db.prepare("INSERT INTO teams (name) VALUES (?)").run(name.trim());
  const team = db
    .prepare("SELECT * FROM teams WHERE id = ?")
    .get(Number(res.lastInsertRowid)) as TeamRow;
  return NextResponse.json({ team });
}
