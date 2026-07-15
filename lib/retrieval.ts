import { getDb, DocumentRow } from "./db";
import { embed } from "./embeddings";

export interface RetrievedDoc {
  id: number;
  source: string;
  source_id: string | null;
  author: string | null;
  ts: string | null;
  title: string | null;
  content: string;
  score: number;
}

/** Cosine similarity. Vectors from embed() are normalized, so this is a dot
 *  product, but we normalize defensively in case a raw vector sneaks in. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Brute-force vector search over all documents (dataset is tiny). */
export async function search(query: string, topK = 8): Promise<RetrievedDoc[]> {
  const queryVec = await embed(query);
  return searchWithVector(queryVec, topK);
}

export function searchWithVector(queryVec: number[], topK = 8): RetrievedDoc[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM documents WHERE embedding IS NOT NULL")
    .all() as DocumentRow[];

  const scored = rows.map((row) => {
    const vec = JSON.parse(row.embedding as string) as number[];
    return {
      id: row.id,
      source: row.source,
      source_id: row.source_id,
      author: row.author,
      ts: row.ts,
      title: row.title,
      content: row.content,
      score: cosineSimilarity(queryVec, vec),
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

/** Format retrieved docs into a context block for the LLM prompts. */
export function formatChunks(docs: RetrievedDoc[]): string {
  return docs
    .map(
      (d) =>
        `[${d.source_id ?? d.id}] (${d.title ?? "untitled"} — ${d.author ?? "unknown"}, ${d.ts ?? "n/a"})\n${d.content}`
    )
    .join("\n\n---\n\n");
}
