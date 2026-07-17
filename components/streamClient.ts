export const SOURCES_PREFIX = "__SOURCES__";

export interface StreamSource {
  source_id: string;
  title?: string | null;
  author?: string | null;
  ts?: string | null;
  source?: string | null;
  content?: string | null;
  score?: number;
  linked_jira_key?: string | null;
  linked_jira_url?: string | null;
}

/**
 * Consume a text/plain stream whose first line is `__SOURCES__<json>`,
 * then streamed model output. Calls onSources once, onDelta per text chunk.
 */
export async function consumeStream(
  res: Response,
  {
    onSources,
    onDelta,
  }: { onSources: (s: StreamSource[]) => void; onDelta: (text: string) => void }
): Promise<void> {
  if (!res.body) throw new Error("No response body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sourcesParsed = false;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });

    if (!sourcesParsed) {
      buffer += text;
      const nl = buffer.indexOf("\n");
      if (nl === -1) continue;
      const firstLine = buffer.slice(0, nl);
      if (firstLine.startsWith(SOURCES_PREFIX)) {
        try {
          onSources(JSON.parse(firstLine.slice(SOURCES_PREFIX.length)));
        } catch {
          /* ignore malformed sources header */
        }
      }
      const rest = buffer.slice(nl + 1);
      sourcesParsed = true;
      buffer = "";
      if (rest) onDelta(rest);
      continue;
    }

    onDelta(text);
  }
}
