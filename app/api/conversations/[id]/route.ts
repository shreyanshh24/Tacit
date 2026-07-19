import { NextResponse } from "next/server";
import { getDb, ChatMessageRow } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fetch a conversation's messages (oldest first). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY id ASC"
    )
    .all(Number(id)) as ChatMessageRow[];

  const messages = rows.map((r) => {
    let sources = null;
    let cards = null;
    if (r.sources) {
      try {
        const parsed = JSON.parse(r.sources);
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
      sources,
      cards,
    };
  });
  return NextResponse.json({ messages });
}
