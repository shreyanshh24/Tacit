import { getDb } from "./db";
import { getSession } from "./session";

export interface LogActivityOpts {
  type: "memory" | "assumptions" | "foresight" | "jira_import" | "capture";
  title?: string;
  detail?: string;
  ref?: string;
}

/**
 * Record an attributed activity for the current session member. Best-effort:
 * never throws, so it can't break the underlying feature if there's no session.
 * Returns the new activity id (or null).
 */
export async function logActivity(opts: LogActivityOpts): Promise<number | null> {
  try {
    const session = await getSession();
    const db = getDb();
    const res = db
      .prepare(
        `INSERT INTO activities (team_id, project_id, member_id, type, title, detail, ref)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        session.teamId,
        session.projectId,
        session.memberId,
        opts.type,
        opts.title ?? null,
        opts.detail ?? null,
        opts.ref ?? null
      );
    return Number(res.lastInsertRowid);
  } catch (e) {
    console.error("logActivity failed:", e);
    return null;
  }
}
