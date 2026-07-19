import { NextResponse } from "next/server";
import { getDb, ChatConversationRow } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List conversations for the active project (newest first). */
export async function GET() {
  const session = await getSession();
  const db = getDb();
  const rows = (
    session.projectId
      ? db
          .prepare(
            "SELECT * FROM chat_conversations WHERE project_id = ? ORDER BY id DESC LIMIT 50"
          )
          .all(session.projectId)
      : db
          .prepare("SELECT * FROM chat_conversations ORDER BY id DESC LIMIT 50")
          .all()
  ) as ChatConversationRow[];
  return NextResponse.json({ conversations: rows });
}

/** Create an empty conversation. */
export async function POST() {
  const session = await getSession();
  const db = getDb();
  const conv = db
    .prepare(
      "INSERT INTO chat_conversations (project_id, member_id, title) VALUES (?, ?, ?)"
    )
    .run(session.projectId, session.memberId, "New chat");
  return NextResponse.json({ id: Number(conv.lastInsertRowid) });
}
