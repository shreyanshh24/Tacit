import { NextResponse } from "next/server";
import { getDb, ChatMessageRow, ChatConversationRow } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fetch a conversation's messages (oldest first), with live status for resume. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const conv = db
    .prepare("SELECT * FROM chat_conversations WHERE id = ?")
    .get(Number(id)) as ChatConversationRow | undefined;

  const rows = db
    .prepare(
      "SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY id ASC"
    )
    .all(Number(id)) as ChatMessageRow[];

  const messages = rows.map((r) => {
    let sources = null;
    let cards = null;
    const metaStr = r.meta ?? r.sources; // meta for new rows, sources for legacy
    if (metaStr) {
      try {
        const parsed = JSON.parse(metaStr);
        sources = parsed?.sources ?? null;
        cards = parsed?.cards ?? null;
      } catch {
        /* ignore */
      }
    }
    return {
      id: r.id,
      role: r.role,
      mode: r.mode,
      content: r.content ?? "",
      status: r.status ?? "done",
      sources,
      cards,
    };
  });

  return NextResponse.json({
    id: Number(id),
    title: conv?.title ?? null,
    messages,
  });
}
