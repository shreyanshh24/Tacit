import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { buildMetaStream } from "@/lib/stream";
import { friendlyError } from "@/lib/llm";
import { classify, parseSlash, MODES } from "@/lib/chatRouter";
import {
  runMemory,
  runForesight,
  runAssumptions,
  runDecisions,
  runCapture,
  runSmalltalk,
  type ChatMode,
  type HandlerResult,
} from "@/lib/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message: string = (body?.message ?? "").toString();
    const forced: string | undefined = body?.mode;
    const title: string | undefined = body?.title;
    const jiraKey: string | null = body?.jiraKey ?? null;
    let conversationId: number | null = body?.conversationId ?? null;

    if (!message.trim()) {
      return NextResponse.json({ error: "Empty message" }, { status: 400 });
    }

    const session = await getSession();
    const db = getDb();

    // Resolve the mode: forced (chip) → slash-command → classifier.
    const slash = parseSlash(message);
    let text = slash.text;
    let mode: ChatMode;
    if (forced && MODES.includes(forced as ChatMode)) mode = forced as ChatMode;
    else if (slash.mode) mode = slash.mode;
    else mode = await classify(text);

    // Ensure a conversation exists.
    if (!conversationId) {
      const conv = db
        .prepare(
          "INSERT INTO chat_conversations (project_id, member_id, title) VALUES (?, ?, ?)"
        )
        .run(session.projectId, session.memberId, message.slice(0, 60));
      conversationId = Number(conv.lastInsertRowid);
    }

    // Persist the user message.
    db.prepare(
      "INSERT INTO chat_messages (conversation_id, role, mode, content, sources) VALUES (?, 'user', ?, ?, NULL)"
    ).run(conversationId, mode, message);

    // Dispatch to the capability handler.
    let result: HandlerResult;
    switch (mode) {
      case "memory":
        result = await runMemory(text, session);
        break;
      case "foresight":
        result = await runForesight(text, session);
        break;
      case "assumptions":
        result = await runAssumptions(text, session, title);
        break;
      case "decisions":
        result = await runDecisions(session);
        break;
      case "capture":
        result = await runCapture(text, session, title, jiraKey);
        break;
      default:
        result = await runSmalltalk(text);
    }

    const meta = {
      mode: result.mode,
      conversationId,
      sources: result.sources ?? null,
      cards: result.cards ?? null,
    };

    return buildMetaStream(meta, {
      prompt: result.prompt,
      system: result.system,
      staticText: result.staticText,
      onComplete: (full) => {
        db.prepare(
          "INSERT INTO chat_messages (conversation_id, role, mode, content, sources) VALUES (?, 'assistant', ?, ?, ?)"
        ).run(
          conversationId,
          result.mode,
          full,
          JSON.stringify({ sources: result.sources ?? null, cards: result.cards ?? null })
        );
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: friendlyError(e) }, { status: 500 });
  }
}
