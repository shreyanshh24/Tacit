// Shared capability handlers used by both the legacy per-surface routes and the
// unified /api/chat router. Each returns a HandlerResult describing what to send
// back to the client (a streamed LLM answer, structured cards, or static text).

import { search, formatChunks } from "./retrieval";
import { getBranchDocChunks } from "./repoDocs";
import { memoryPrompt, foresightPrompt, assumptionsPrompt } from "./prompts";
import { generateJSON } from "./llm";
import { embed } from "./embeddings";
import { getDb, DecisionRow, ProjectRow } from "./db";
import { logActivity } from "./activity";
import { jiraIssueUrl } from "./jira";
import { getSession } from "./session";

export type Session = Awaited<ReturnType<typeof getSession>>;

export type ChatMode =
  | "memory"
  | "foresight"
  | "assumptions"
  | "decisions"
  | "capture"
  | "smalltalk";

export interface SourceMeta {
  source_id: string | null;
  title: string | null;
  author: string | null;
  ts: string | null;
  source: string;
  content: string;
  score?: number;
  linked_jira_key: string | null;
  linked_jira_url: string | null;
}

export interface HandlerResult {
  mode: ChatMode;
  sources?: SourceMeta[];
  cards?: { type: "assumptions" | "decisions"; items: unknown[] };
  /** If set, stream this prompt through the LLM as the assistant reply. */
  prompt?: string;
  system?: string;
  /** If set, emit this text verbatim as the assistant reply (no LLM call). */
  staticText?: string;
}

function mapSources(
  docs: Awaited<ReturnType<typeof search>>
): SourceMeta[] {
  return docs.map((d) => ({
    source_id: d.source_id,
    title: d.title,
    author: d.author,
    ts: d.ts,
    source: d.source,
    content: d.content,
    score: typeof d.score === "number" ? Number(d.score.toFixed(4)) : undefined,
    linked_jira_key: d.linked_jira_key,
    linked_jira_url: d.linked_jira_url,
  }));
}

/** Memory: retrieve project context and stream a cited answer. */
export async function runMemory(
  question: string,
  session: Session
): Promise<HandlerResult> {
  const [hits, branchDocs] = await Promise.all([
    search(question, 8, session.projectId),
    getBranchDocChunks(question),
  ]);
  const docs = [...branchDocs, ...hits];
  await logActivity({ type: "memory", title: question });
  return {
    mode: "memory",
    sources: mapSources(docs),
    prompt: memoryPrompt(question, formatChunks(docs)),
  };
}

/** Foresight: pre-mortem grounded only in retrieved history. */
export async function runForesight(
  proposal: string,
  session: Session
): Promise<HandlerResult> {
  const [hits, branchDocs] = await Promise.all([
    search(proposal, 6, session.projectId),
    getBranchDocChunks(proposal),
  ]);
  const docs = [...branchDocs, ...hits];
  const firstLine = proposal.trim().split("\n")[0].slice(0, 120);
  await logActivity({ type: "foresight", title: "Pre-mortem", detail: firstLine });
  return {
    mode: "foresight",
    sources: mapSources(docs),
    prompt: foresightPrompt(proposal, formatChunks(docs)),
  };
}

const riskRank: Record<string, number> = { high: 0, medium: 1, low: 2 };

interface Assumption {
  text: string;
  why_load_bearing: string;
  risk: "high" | "medium" | "low";
  stated_or_implicit: "stated" | "implicit";
}

/** Assumptions: extract load-bearing assumptions from a plan (structured cards). */
export async function runAssumptions(
  plan: string,
  _session: Session,
  title?: string
): Promise<HandlerResult> {
  const db = getDb();
  const planRow = db
    .prepare("INSERT INTO plans (title, content) VALUES (?, ?)")
    .run(title ?? "Untitled plan", plan);
  const planId = Number(planRow.lastInsertRowid);

  const result = await generateJSON<{ assumptions?: Assumption[] }>(
    assumptionsPrompt(plan)
  );
  const assumptions: Assumption[] = Array.isArray(result?.assumptions)
    ? result.assumptions
    : [];

  const insert = db.prepare(
    `INSERT INTO assumptions (plan_id, text, why_load_bearing, risk, stated_or_implicit, validated)
     VALUES (?, ?, ?, ?, ?, 0)`
  );
  for (const a of assumptions) {
    insert.run(
      planId,
      a.text ?? "",
      a.why_load_bearing ?? "",
      a.risk ?? "medium",
      a.stated_or_implicit ?? "implicit"
    );
  }
  assumptions.sort((a, b) => (riskRank[a.risk] ?? 1) - (riskRank[b.risk] ?? 1));

  await logActivity({
    type: "assumptions",
    title: title?.trim() || "Untitled plan",
    detail: `${assumptions.length} assumptions surfaced`,
  });

  return {
    mode: "assumptions",
    cards: { type: "assumptions", items: assumptions },
    staticText: `Surfaced **${assumptions.length}** load-bearing assumptions, highest-risk first.`,
  };
}

/** Decisions: list the decisions already extracted for this project (cards). */
export async function runDecisions(session: Session): Promise<HandlerResult> {
  const db = getDb();
  const rows = (
    session.projectId
      ? db
          .prepare(
            "SELECT * FROM decisions WHERE project_id = ? ORDER BY ts DESC, id DESC"
          )
          .all(session.projectId)
      : db.prepare("SELECT * FROM decisions ORDER BY ts DESC, id DESC").all()
  ) as DecisionRow[];

  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    decision: r.decision,
    reasoning: r.reasoning,
    outcome: r.outcome,
    ts: r.ts,
    alternatives: safeParse(r.alternatives),
    people: safeParse(r.people),
    source_ids: safeParse(r.source_ids),
  }));

  return {
    mode: "decisions",
    cards: { type: "decisions", items },
    staticText: items.length
      ? `Here are the **${items.length}** decisions recorded for this project.`
      : "No decisions have been extracted yet. Import Jira / capture docs, then run **Re-extract** in the Decisions view.",
  };
}

/** Capture: store a note/doc into memory, optionally linked to a Jira ticket. */
export async function runCapture(
  content: string,
  session: Session,
  title?: string,
  jiraKey?: string | null
): Promise<HandlerResult> {
  const db = getDb();
  const memberName = session.memberId
    ? ((db.prepare("SELECT name FROM members WHERE id = ?").get(session.memberId) as
        | { name: string }
        | undefined)?.name ?? null)
    : null;

  const cleanTitle =
    (title && String(title).trim()) ||
    content.trim().split("\n")[0].slice(0, 80) ||
    "Untitled context";

  const project = session.projectId
    ? (db.prepare("SELECT * FROM projects WHERE id = ?").get(session.projectId) as
        | ProjectRow
        | undefined)
    : undefined;

  const key = jiraKey ? String(jiraKey).trim().toUpperCase() : null;
  const jiraUrl = key ? jiraIssueUrl(key, project?.jira_base_url) : null;

  const seq =
    (db.prepare("SELECT COUNT(*) AS c FROM documents WHERE source = 'upload'").get() as {
      c: number;
    }).c + 1;
  const sourceId = `UPLOAD-${seq}`;

  const embedding = JSON.stringify(await embed(`${cleanTitle}\n${content}`));
  db.prepare(
    `INSERT INTO documents
       (source, source_id, author, ts, title, content, embedding, project_id, member_id, linked_jira_key, linked_jira_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "upload",
    sourceId,
    memberName,
    new Date().toISOString().slice(0, 10),
    cleanTitle,
    content.trim(),
    embedding,
    session.projectId,
    session.memberId,
    key,
    jiraUrl
  );

  await logActivity({
    type: "capture",
    title: `Captured context: ${cleanTitle}`,
    detail: key ? `Linked to ${key}` : "No Jira ticket linked",
    ref: key ?? sourceId,
  });

  return {
    mode: "capture",
    staticText: `Captured **${cleanTitle}** into memory as \`${sourceId}\`${
      key ? ` and linked it to \`${key}\`` : ""
    }. It's now searchable.`,
  };
}

/** Smalltalk / help: a short conversational reply from the model. */
export async function runSmalltalk(message: string): Promise<HandlerResult> {
  return {
    mode: "smalltalk",
    prompt: message,
    system:
      "You are Tacit, an organizational-memory assistant. If the user greets you or asks what you can do, briefly explain you can: answer questions about the company's history (memory), surface hidden assumptions in a plan, run a grounded pre-mortem (foresight), list recorded decisions, and capture notes/transcripts into memory. Keep replies to 2-3 sentences.",
  };
}

function safeParse(s: string | null): unknown[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
