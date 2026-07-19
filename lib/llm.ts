// Unified LLM engine. Default provider is the local `claude` CLI (`claude -p`),
// which uses the developer's Claude Code login — no API key, localhost-only.
// Set LLM_PROVIDER=gemini to fall back to the original Gemini path (lib/gemini).
//
// Embeddings are unaffected (they run locally via lib/embeddings).

import { spawn } from "child_process";
import * as gemini from "./gemini";

const PROVIDER = (process.env.LLM_PROVIDER || "claude").toLowerCase();
const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
// A small, fast model for cheap calls like the chat intent classifier.
export const FAST_MODEL =
  process.env.CLAUDE_FAST_MODEL || "claude-haiku-4-5-20251001";

export interface GenOpts {
  system?: string;
  model?: string;
  maxTurns?: number;
  timeoutMs?: number;
  cwd?: string;
}

/** Spawn `claude` with the given args, feeding `prompt` on stdin. Resolves stdout. */
function spawnClaude(
  prompt: string,
  args: string[],
  opts: { cwd?: string; timeoutMs?: number } = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(CLAUDE_BIN, args, {
      cwd: opts.cwd,
      env: process.env,
    });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("claude -p timed out"));
    }, opts.timeoutMs ?? 120_000);

    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`claude exited ${code}: ${err.slice(0, 400)}`));
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function baseArgs(opts: GenOpts, format: "json" | "stream-json"): string[] {
  const args = ["-p", "--output-format", format];
  if (format === "stream-json") args.push("--verbose");
  args.push("--max-turns", String(opts.maxTurns ?? 1));
  if (opts.model) args.push("--model", opts.model);
  return args;
}

function withSystem(prompt: string, system?: string): string {
  return system ? `${system}\n\n${prompt}` : prompt;
}

/** One-shot text generation via `claude -p --output-format json`. */
export async function claudeGenerate(
  prompt: string,
  opts: GenOpts = {}
): Promise<string> {
  const raw = await spawnClaude(
    withSystem(prompt, opts.system),
    baseArgs(opts, "json"),
    { cwd: opts.cwd, timeoutMs: opts.timeoutMs }
  );
  try {
    const obj = JSON.parse(raw);
    if (obj?.is_error) throw new Error(obj?.result || "claude returned an error");
    return String(obj?.result ?? "");
  } catch (e) {
    // If the envelope didn't parse, surface the raw output (trimmed).
    if (raw && !raw.startsWith("{")) return raw.trim();
    throw e;
  }
}

/** Parse a JSON object out of model text, tolerating ```json fences and prose. */
export function parseJsonLoose<T = unknown>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const cleaned = text.replace(/```json\n?|```/g, "").trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      const start = cleaned.search(/[{[]/);
      const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
      if (start >= 0 && end > start) {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      }
      throw new Error("Could not parse JSON from model output");
    }
  }
}

/**
 * Structured JSON generation. Mirrors gemini.generateJSON's contract so callers
 * can swap providers transparently.
 */
export async function generateJSON<T = unknown>(
  prompt: string,
  system?: string,
  opts: GenOpts = {}
): Promise<T> {
  if (PROVIDER === "gemini") {
    return (await gemini.generateJSON(prompt, system)) as T;
  }
  const text = await claudeGenerate(
    `${prompt}\n\nRespond with ONLY valid JSON. No markdown fences, no commentary.`,
    { ...opts, system }
  );
  return parseJsonLoose<T>(text);
}

/**
 * Streaming text generation. Yields text chunks. With the claude provider we
 * parse the stream-json event log and emit each assistant text block as it
 * arrives (turn-granular; good enough for the chat UI).
 */
export async function* streamText(
  prompt: string,
  system?: string,
  opts: GenOpts = {}
): AsyncGenerator<string> {
  if (PROVIDER === "gemini") {
    yield* gemini.streamText(prompt, system);
    return;
  }

  const args = baseArgs(opts, "stream-json");
  const child = spawn(CLAUDE_BIN, args, { cwd: opts.cwd, env: process.env });
  child.stdin.write(withSystem(prompt, system));
  child.stdin.end();

  const timeoutMs = opts.timeoutMs ?? 120_000;
  const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);

  let buf = "";
  let stderr = "";
  child.stderr.on("data", (d) => (stderr += d.toString()));

  // Async queue bridging the 'data' callback to this generator.
  const queue: string[] = [];
  let done = false;
  let errorMsg: string | null = null;
  let notify: (() => void) | null = null;
  const wake = () => {
    if (notify) {
      const n = notify;
      notify = null;
      n();
    }
  };

  const emitted = new Set<string>();
  function handleLine(line: string) {
    line = line.trim();
    if (!line) return;
    let evt: { type?: string; message?: { content?: { type?: string; text?: string }[] } };
    try {
      evt = JSON.parse(line);
    } catch {
      return;
    }
    if (evt.type === "assistant" && evt.message?.content) {
      for (const block of evt.message.content) {
        if (block.type === "text" && block.text && !emitted.has(block.text)) {
          emitted.add(block.text);
          queue.push(block.text);
          wake();
        }
      }
    }
  }

  child.stdout.on("data", (d) => {
    buf += d.toString();
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      handleLine(line);
    }
  });
  child.on("error", (e) => {
    errorMsg = e.message;
    done = true;
    wake();
  });
  child.on("close", (code) => {
    clearTimeout(timer);
    if (buf.trim()) handleLine(buf);
    if (code !== 0 && queue.length === 0) {
      errorMsg = `claude exited ${code}: ${stderr.slice(0, 300)}`;
    }
    done = true;
    wake();
  });

  while (true) {
    if (queue.length) {
      yield queue.shift() as string;
      continue;
    }
    if (done) {
      if (errorMsg) throw new Error(errorMsg);
      return;
    }
    await new Promise<void>((r) => (notify = r));
  }
}

/** Human-readable error line (reused from gemini for parity). */
export function friendlyError(err: unknown): string {
  const msg = String((err as Error)?.message ?? err);
  if (PROVIDER === "gemini") return gemini.friendlyGeminiError(err);
  if (/ENOENT|not found/i.test(msg)) {
    return "The `claude` CLI was not found. Install Claude Code and ensure `claude` is on PATH (Agents/Chat run it locally).";
  }
  if (/timed out/i.test(msg)) return "The model call timed out. Try again.";
  return `Model error: ${msg.slice(0, 300)}`;
}
