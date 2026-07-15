import { streamText, friendlyGeminiError } from "./gemini";

export const SOURCES_PREFIX = "__SOURCES__";

/**
 * Build a text/plain streaming Response whose first line is
 * `__SOURCES__<json>` followed by the streamed model output.
 */
export function buildStreamingResponse(
  prompt: string,
  sources: unknown
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(`${SOURCES_PREFIX}${JSON.stringify(sources)}\n`)
      );
      try {
        for await (const chunk of streamText(prompt)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (e) {
        controller.enqueue(
          encoder.encode(`\n\n⚠ ${friendlyGeminiError(e)}`)
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
