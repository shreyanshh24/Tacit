import { NextResponse } from "next/server";
import { getDb, TeamRow, MemberRow, ProjectRow } from "@/lib/db";
import { getSession, writeSession, clearSession, Session } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hydrate(session: Session) {
  const db = getDb();
  const team = session.teamId
    ? (db.prepare("SELECT * FROM teams WHERE id = ?").get(session.teamId) as TeamRow | undefined)
    : undefined;
  const member = session.memberId
    ? (db.prepare("SELECT * FROM members WHERE id = ?").get(session.memberId) as MemberRow | undefined)
    : undefined;
  const project = session.projectId
    ? (db.prepare("SELECT * FROM projects WHERE id = ?").get(session.projectId) as ProjectRow | undefined)
    : undefined;
  return {
    session,
    team: team ?? null,
    member: member ?? null,
    project: project ?? null,
  };
}

export async function GET() {
  const session = await getSession();
  return NextResponse.json(hydrate(session));
}

export async function POST(req: Request) {
  const current = await getSession();
  const body = (await req.json()) as Partial<Session>;
  const next: Session = {
    teamId: body.teamId !== undefined ? body.teamId : current.teamId,
    memberId: body.memberId !== undefined ? body.memberId : current.memberId,
    projectId: body.projectId !== undefined ? body.projectId : current.projectId,
  };
  await writeSession(next);
  return NextResponse.json(hydrate(next));
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
