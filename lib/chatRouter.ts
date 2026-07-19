// Intent classification for the unified Chat. A cheap, fast (Haiku) call maps a
// free-text message to one capability mode. Slash-commands bypass it.

import { generateJSON, FAST_MODEL } from "./llm";
import type { ChatMode } from "./handlers";

export const MODES: ChatMode[] = [
  "memory",
  "foresight",
  "assumptions",
  "decisions",
  "capture",
  "smalltalk",
];

const SLASH: Record<string, ChatMode> = {
  "/memory": "memory",
  "/ask": "memory",
  "/foresight": "foresight",
  "/premortem": "foresight",
  "/assume": "assumptions",
  "/assumptions": "assumptions",
  "/decisions": "decisions",
  "/capture": "capture",
  "/note": "capture",
};

/**
 * If the message starts with a known slash-command, return {mode, text} with the
 * command stripped. Otherwise mode is null (caller should classify).
 */
export function parseSlash(message: string): { mode: ChatMode | null; text: string } {
  const m = message.match(/^(\/[a-z]+)\s*([\s\S]*)$/i);
  if (m) {
    const mode = SLASH[m[1].toLowerCase()];
    if (mode) return { mode, text: m[2].trim() || message };
  }
  return { mode: null, text: message };
}

/** Classify a message into one ChatMode via a fast model. Defaults to memory. */
export async function classify(message: string): Promise<ChatMode> {
  const prompt = `You route messages for "Tacit", an organizational-memory assistant. Classify the user's message into exactly ONE mode:
- "memory": a question about the company's past — decisions, history, incidents ("why did we…", "what happened with…", "who decided…").
- "foresight": the user describes or pastes a NEW proposal/plan/idea and wants risks / a pre-mortem before doing it.
- "assumptions": the user wants the hidden or load-bearing assumptions in a plan surfaced.
- "decisions": the user wants to browse the list of recorded decisions.
- "capture": the user wants to SAVE/store a note, doc, or transcript into memory.
- "smalltalk": greetings, "what can you do", or anything that doesn't fit above.

Message:
"""${message.slice(0, 2000)}"""

Return JSON only: {"mode":"<memory|foresight|assumptions|decisions|capture|smalltalk>"}`;

  try {
    const r = await generateJSON<{ mode?: string }>(prompt, undefined, {
      model: FAST_MODEL,
      timeoutMs: 30_000,
    });
    const m = String(r?.mode || "").toLowerCase() as ChatMode;
    return MODES.includes(m) ? m : "memory";
  } catch {
    return "memory";
  }
}
