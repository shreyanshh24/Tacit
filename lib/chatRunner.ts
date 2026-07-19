// Persistent, resumable chat turns. A turn runs in the BACKGROUND (decoupled
// from the HTTP request): the assistant message is inserted as 'streaming' and
// its content is written to the DB incrementally as the model generates. The
// client renders/reconnects by polling the conversation, so an in-progress
// answer keeps generating and stays visible across tab switches / reloads.

import { getDb } from "./db";
import { streamText, friendlyError } from "./llm";
import { classify, parseSlash, MODES } from "./chatRouter";
import {
  runMemory,
  runForesight,
  runAssumptions,
  runDecisions,
  runCapture,
  runSmalltalk,
  type ChatMode,
  type HandlerResult,
  type Session,
} from "./handlers";

export interface StartedTurn {
  conversationId: number;
  assistantMessageId: number;
  mode: ChatMode;
}

/** Resolve mode, persist the user + placeholder assistant rows, kick off gen. */
export async function startChatTurn(opts: {
  conversationId: number | null;
  message: string;
  forcedMode?: string;
  title?: string;
  jiraKey?: string | null;
  session: Session;
}): Promise<StartedTurn> {
  const db = getDb();
  const { message, session } = opts;

  const slash = parseSlash(message);
  const text = slash.text;
  let mode: ChatMode;
  if (opts.forcedMode && MODES.includes(opts.forcedMode as ChatMode))
    mode = opts.forcedMode as ChatMode;
  else if (slash.mode) mode = slash.mode;
  else mode = await classify(text);

  let conversationId = opts.conversationId;
  if (!conversationId) {
    const conv = db
      .prepare(
        "INSERT INTO chat_conversations (project_id, member_id, title) VALUES (?, ?, ?)"
      )
      .run(session.projectId, session.memberId, message.slice(0, 60));
    conversationId = Number(conv.lastInsertRowid);
  } else {
    const row = db
      .prepare("SELECT title FROM chat_conversations WHERE id = ?")
      .get(conversationId) as { title?: string } | undefined;
    if (row && (!row.title || row.title === "New chat")) {
      db.prepare("UPDATE chat_conversations SET title = ? WHERE id = ?").run(
        message.slice(0, 60),
        conversationId
      );
    }
  }

  db.prepare(
    "INSERT INTO chat_messages (conversation_id, role, mode, content, status) VALUES (?, 'user', ?, ?, 'done')"
  ).run(conversationId, mode, message);

  const asst = db
    .prepare(
      "INSERT INTO chat_messages (conversation_id, role, mode, content, status) VALUES (?, 'assistant', ?, '', 'streaming')"
    )
    .run(conversationId, mode);
  const assistantMessageId = Number(asst.lastInsertRowid);

  // Fire-and-forget: generation continues regardless of the HTTP request.
  generate(assistantMessageId, mode, text, opts.title, opts.jiraKey, session).catch(
    (e) => {
      try {
        getDb()
          .prepare(
            "UPDATE chat_messages SET status = 'error', content = content || ? WHERE id = ?"
          )
          .run(`\n\n⚠ ${friendlyError(e)}`, assistantMessageId);
      } catch {
        /* ignore */
      }
    }
  );

  return { conversationId, assistantMessageId, mode };
}

async function generate(
  msgId: number,
  mode: ChatMode,
  text: string,
  title: string | undefined,
  jiraKey: string | null | undefined,
  session: Session
): Promise<void> {
  const db = getDb();

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
      result = await runCapture(text, session, title ?? undefined, jiraKey);
      break;
    default:
      result = await runSmalltalk(text);
  }

  // Persist sources/cards early so citation chips + cards render immediately.
  const meta = JSON.stringify({
    sources: result.sources ?? null,
    cards: result.cards ?? null,
  });
  db.prepare("UPDATE chat_messages SET mode = ?, meta = ? WHERE id = ?").run(
    result.mode,
    meta,
    msgId
  );

  let full = "";
  const flush = () => {
    try {
      db.prepare("UPDATE chat_messages SET content = ? WHERE id = ?").run(full, msgId);
    } catch {
      /* ignore */
    }
  };

  if (result.staticText != null) {
    full = result.staticText;
    flush();
  } else if (result.prompt) {
    let last = 0;
    try {
      for await (const chunk of streamText(result.prompt, result.system)) {
        full += chunk;
        const now = Date.now();
        if (now - last > 250) {
          last = now;
          flush();
        }
      }
    } catch (e) {
      full += `\n\n⚠ ${friendlyError(e)}`;
    }
  }

  db.prepare(
    "UPDATE chat_messages SET content = ?, status = 'done' WHERE id = ?"
  ).run(full, msgId);
}
