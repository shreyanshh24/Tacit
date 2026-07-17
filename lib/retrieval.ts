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
  linked_jira_key: string | null;
  linked_jira_url: string | null;
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

/** Brute-force vector search over documents (optionally scoped to a project). */
export async function search(
  query: string,
  topK = 8,
  projectId?: number | null
): Promise<RetrievedDoc[]> {
  const queryVec = await embed(query);
  return searchWithVector(queryVec, topK, projectId);
}

/**
 * Search using a precomputed query embedding. Loads document embeddings,
 * computes cosine similarity, returns the top K sorted by score.
 */
export function searchDocuments(
  queryEmbedding: number[],
  topK = 8,
  projectId?: number | null
): RetrievedDoc[] {
  return searchWithVector(queryEmbedding, topK, projectId);
}

export function searchWithVector(
  queryVec: number[],
  topK = 8,
  projectId?: number | null
): RetrievedDoc[] {
  const db = getDb();
  const rows = (
    projectId != null
      ? db
          .prepare(
            "SELECT * FROM documents WHERE embedding IS NOT NULL AND project_id = ?"
          )
          .all(projectId)
      : db.prepare("SELECT * FROM documents WHERE embedding IS NOT NULL").all()
  ) as DocumentRow[];

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
      linked_jira_key: row.linked_jira_key ?? null,
      linked_jira_url: row.linked_jira_url ?? null,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

/** Format retrieved docs into a context block for the LLM prompts. */
export function formatChunks(docs: RetrievedDoc[]): string {
  return docs
    .map((d) => {
      const jira = d.linked_jira_key ? ` [linked Jira: ${d.linked_jira_key}]` : "";
      return `[${d.source_id ?? d.id}] (${d.title ?? "untitled"} — ${d.author ?? "unknown"}, ${d.ts ?? "n/a"})${jira}\n${d.content}`;
    })
    .join("\n\n---\n\n");
}
