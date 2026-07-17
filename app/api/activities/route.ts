import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  const db = getDb();

  // Scope to the current team when available; otherwise show all (demo-friendly).
  const rows = (
    session.teamId
      ? db
          .prepare(
            `SELECT a.*, m.name AS member_name,
                    (SELECT COUNT(*) FROM comments c WHERE c.activity_id = a.id) AS comment_count
             FROM activities a
             LEFT JOIN members m ON m.id = a.member_id
             WHERE a.team_id = ? OR a.team_id IS NULL
             ORDER BY a.id DESC
             LIMIT 200`
          )
          .all(session.teamId)
      : db
          .prepare(
            `SELECT a.*, m.name AS member_name,
                    (SELECT COUNT(*) FROM comments c WHERE c.activity_id = a.id) AS comment_count
             FROM activities a
             LEFT JOIN members m ON m.id = a.member_id
             ORDER BY a.id DESC
             LIMIT 200`
          )
          .all()
  ) as Array<Record<string, unknown>>;

  // Attach tagged members to each activity.
  const tagStmt = db.prepare(
    `SELECT m.name AS member_name, m.role AS member_role
     FROM activity_tags t LEFT JOIN members m ON m.id = t.member_id
     WHERE t.activity_id = ? ORDER BY t.id ASC`
  );
  for (const a of rows) {
    a.tags = tagStmt.all(a.id as number);
  }

  return NextResponse.json({ activities: rows });
}
