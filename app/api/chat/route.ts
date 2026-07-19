import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { friendlyError } from "@/lib/llm";
import { startChatTurn } from "@/lib/chatRunner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Start a chat turn. Returns immediately with the conversation + assistant
 * message ids; the answer generates in the background and is persisted
 * incrementally. The client renders it by polling the conversation.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message: string = (body?.message ?? "").toString();
    if (!message.trim()) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }
    const session = await getSession();
    const started = await startChatTurn({
      conversationId: body?.conversationId ?? null,
      message,
      forcedMode: body?.mode,
      title: body?.title,
      jiraKey: body?.jiraKey ?? null,
      session,
    });
    return NextResponse.json(started);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}
