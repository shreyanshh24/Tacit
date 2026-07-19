import { streamText, friendlyError } from "./llm";

export const SOURCES_PREFIX = "__SOURCES__";
export const META_PREFIX = "__META__";

/**
 * Unified chat stream: first line is `__META__<json>` (mode, sources, cards,
 * conversationId), followed by the assistant text — either streamed from an LLM
 * `prompt`, or emitted verbatim from `staticText`. `onComplete` receives the full
 * assistant text once the stream ends (used to persist the message).
 */
export function buildMetaStream(
  meta: unknown,
  opts: {
    prompt?: string;
    system?: string;
    staticText?: string;
    onComplete?: (fullText: string) => void;
  }
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`${META_PREFIX}${JSON.stringify(meta)}\n`));
      let full = "";
      try {
        if (opts.staticText != null) {
          full = opts.staticText;
          controller.enqueue(encoder.encode(full));
        } else if (opts.prompt) {
          for await (const chunk of streamText(opts.prompt, opts.system)) {
            full += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
        }
      } catch (e) {
        const m = `\n\n⚠ ${friendlyError(e)}`;
        full += m;
        controller.enqueue(encoder.encode(m));
      }
      try {
        opts.onComplete?.(full);
      } catch {
        /* best-effort persistence */
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

/**
 * Build a text/plain streaming Response whose first line is
 * `__SOURCES__<json>` followed by the streamed model output.
 */
export function buildStreamingResponse(
  prompt: string,
  sources: unknown,
  system?: string
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(`${SOURCES_PREFIX}${JSON.stringify(sources)}\n`)
      );
      try {
        for await (const chunk of streamText(prompt, system)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (e) {
        controller.enqueue(
          encoder.encode(`\n\n⚠ ${friendlyError(e)}`)
        );
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
