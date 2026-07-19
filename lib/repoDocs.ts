// Live, per-question branch docs. When a chat question is about work on a
// specific feature branch, fetch that branch's docs/ tree on the fly and feed it
// to the answer alongside the embedded main corpus. Prefers docs that are NEW on
// the branch (branch-specific), then keyword-relevant ones.

import { generateJSON, FAST_MODEL } from "./llm";
import { listBranches, listRepoFiles, getFileContent, DEFAULT_REPO } from "./github";
import type { RetrievedDoc } from "./retrieval";

const DOC_RE = /^docs\/.*\.md$/i;

function tokens(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 3);
}

/**
 * Decide which branch (if any) a question is about. Cheap pre-filter on branch
 * keywords, then a fast-model classification. Returns null for main/none.
 */
export async function detectBranch(question: string): Promise<string | null> {
  if (!DEFAULT_REPO) return null;
  const branches = (await listBranches()).filter((b) => b && b !== "main");
  if (!branches.length) return null;

  // Only pay for the LLM call if the question mentions a branch keyword.
  const qTokens = new Set(tokens(question));
  const kwHit = branches.some((b) =>
    tokens(b).some((t) => qTokens.has(t))
  );
  const mentionsBranchWord = /\bbranch\b/i.test(question);
  if (!kwHit && !mentionsBranchWord) return null;

  try {
    const r = await generateJSON<{ branch?: string }>(
      `The repo has these git branches: ${branches.join(", ")}, main.
Which single branch is this question about? Answer "main" if it's general or unclear.
Question: """${question.slice(0, 500)}"""
Return JSON only: {"branch":"<one of the branches or main>"}`,
      undefined,
      { model: FAST_MODEL, timeoutMs: 30_000 }
    );
    const b = String(r?.branch || "").trim();
    return b && b !== "main" && branches.includes(b) ? b : null;
  } catch {
    return null;
  }
}

/**
 * Fetch up to k docs from a branch as retrieval chunks. New-on-branch files
 * first, then keyword-relevant ones.
 */
export async function fetchBranchDocs(
  branch: string,
  query: string,
  k = 4
): Promise<RetrievedDoc[]> {
  const [mainFiles, branchFiles] = await Promise.all([
    listRepoFiles("main"),
    listRepoFiles(branch),
  ]);
  const branchDocs = branchFiles.filter((f) => DOC_RE.test(f));
  if (!branchDocs.length) return [];
  const mainSet = new Set(mainFiles.filter((f) => DOC_RE.test(f)));

  const qTokens = tokens(query);
  const score = (p: string) => {
    const pt = new Set(tokens(p));
    return qTokens.reduce((n, t) => n + (pt.has(t) ? 1 : 0), 0);
  };

  const newOnBranch = branchDocs.filter((f) => !mainSet.has(f));
  const others = branchDocs
    .filter((f) => mainSet.has(f))
    .sort((a, b) => score(b) - score(a));
  const ranked = [...newOnBranch, ...others].slice(0, k);

  const out: RetrievedDoc[] = [];
  for (const p of ranked) {
    const content = await getFileContent(p, branch);
    if (!content) continue;
    out.push({
      id: -1,
      source: "docs",
      source_id: `${p}@${branch}`,
      author: null,
      ts: null,
      title: `${p.split("/").pop()} (branch ${branch})`,
      content,
      score: 1,
      linked_jira_key: null,
      linked_jira_url: null,
    });
  }
  return out;
}

/** Orchestrate detect + fetch. Returns [] when no branch is relevant. */
export async function getBranchDocChunks(question: string): Promise<RetrievedDoc[]> {
  const branch = await detectBranch(question);
  if (!branch) return [];
  return fetchBranchDocs(branch, question);
}
