import fs from "fs";
import path from "path";
import { getDb } from "./db";
import { embed } from "./embeddings";
import { generateJSON } from "./gemini";
import { extractionPrompt } from "./prompts";

interface SeedDoc {
  source: string;
  source_id: string;
  author: string;
  ts: string;
  title: string;
  content: string;
}

interface SeedTrigger {
  trigger_type: string;
  trigger_ref: string;
  person: string;
}

interface Seed {
  documents: SeedDoc[];
  interview_triggers: SeedTrigger[];
  demo_interview_answers: string[];
}

function loadSeed(): Seed {
  const p = path.join(process.cwd(), "data", "seed.json");
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

/**
 * Idempotent: wipe documents + interviews, reload seed docs with embeddings,
 * and create pending interview rows from triggers.
 */
export async function runIngest(): Promise<{
  documents: number;
  interviews: number;
}> {
  const db = getDb();
  const seed = loadSeed();

  db.exec("DELETE FROM documents;");

  const insertDoc = db.prepare(
    `INSERT INTO documents (source, source_id, author, ts, title, content, embedding)
     VALUES (@source, @source_id, @author, @ts, @title, @content, @embedding)`
  );

  for (const doc of seed.documents) {
    const embedding = JSON.stringify(await embed(`${doc.title}\n${doc.content}`));
    insertDoc.run({ ...doc, embedding });
  }

  return {
    documents: seed.documents.length,
    interviews: 0,
  };
}

/**
 * Run the extraction prompt over every document, storing found decisions.
 * Idempotent: clears the decisions table first.
 */
export async function runExtract(): Promise<{ decisions: number }> {
  const db = getDb();
  db.exec("DELETE FROM decisions;");

  const docs = db
    .prepare("SELECT * FROM documents")
    .all() as { source_id: string; ts: string; content: string }[];

  const insertDecision = db.prepare(
    `INSERT INTO decisions (title, decision, reasoning, alternatives, people, outcome, ts, source_ids)
     VALUES (@title, @decision, @reasoning, @alternatives, @people, @outcome, @ts, @source_ids)`
  );

  let count = 0;
  for (const doc of docs) {
    try {
      const result = await generateJSON(extractionPrompt(doc.content));
      if (result && result.has_decision) {
        insertDecision.run({
          title: result.title ?? null,
          decision: result.decision ?? null,
          reasoning: result.reasoning ?? null,
          alternatives: JSON.stringify(result.alternatives ?? []),
          people: JSON.stringify(result.people ?? []),
          outcome: result.outcome ?? "unknown",
          ts: doc.ts ?? null,
          source_ids: JSON.stringify([doc.source_id]),
        });
        count++;
      }
    } catch (e) {
      console.error(`Extraction failed for ${doc.source_id}:`, e);
    }
  }

  return { decisions: count };
}

/** Run extraction over one project's documents, tagging decisions with it. */
export async function runExtractForProject(
  projectId: number
): Promise<{ decisions: number }> {
  const db = getDb();
  db.prepare("DELETE FROM decisions WHERE project_id = ?").run(projectId);

  const docs = db
    .prepare("SELECT source_id, ts, content FROM documents WHERE project_id = ?")
    .all(projectId) as { source_id: string; ts: string; content: string }[];

  const insertDecision = db.prepare(
    `INSERT INTO decisions (title, decision, reasoning, alternatives, people, outcome, ts, source_ids, project_id)
     VALUES (@title, @decision, @reasoning, @alternatives, @people, @outcome, @ts, @source_ids, @project_id)`
  );

  let count = 0;
  for (const doc of docs) {
    try {
      const result = await generateJSON(extractionPrompt(doc.content));
      if (result && result.has_decision) {
        insertDecision.run({
          title: result.title ?? null,
          decision: result.decision ?? null,
          reasoning: result.reasoning ?? null,
          alternatives: JSON.stringify(result.alternatives ?? []),
          people: JSON.stringify(result.people ?? []),
          outcome: result.outcome ?? "unknown",
          ts: doc.ts ?? null,
          source_ids: JSON.stringify([doc.source_id]),
          project_id: projectId,
        });
        count++;
      }
    } catch (e) {
      console.error(`Extraction failed for ${doc.source_id}:`, e);
    }
  }
  return { decisions: count };
}

/**
 * Load the NimbusPay sample dataset into a specific project (its own isolated
 * memory), replacing any prior sample data for that project.
 */
export async function loadSampleIntoProject(
  projectId: number
): Promise<{ documents: number; interviews: number; decisions: number }> {
  const db = getDb();
  const seed = loadSeed();

  db.prepare("DELETE FROM documents WHERE project_id = ?").run(projectId);
  db.prepare("DELETE FROM decisions WHERE project_id = ?").run(projectId);

  const insertDoc = db.prepare(
    `INSERT INTO documents (source, source_id, author, ts, title, content, embedding, project_id)
     VALUES (@source, @source_id, @author, @ts, @title, @content, @embedding, @project_id)`
  );
  for (const doc of seed.documents) {
    const embedding = JSON.stringify(await embed(`${doc.title}\n${doc.content}`));
    insertDoc.run({ ...doc, embedding, project_id: projectId });
  }

  const ext = await runExtractForProject(projectId);
  return {
    documents: seed.documents.length,
    interviews: 0,
    decisions: ext.decisions,
  };
}
