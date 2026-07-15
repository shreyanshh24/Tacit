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

  db.exec("DELETE FROM documents; DELETE FROM interviews;");

  const insertDoc = db.prepare(
    `INSERT INTO documents (source, source_id, author, ts, title, content, embedding)
     VALUES (@source, @source_id, @author, @ts, @title, @content, @embedding)`
  );

  for (const doc of seed.documents) {
    const embedding = JSON.stringify(await embed(`${doc.title}\n${doc.content}`));
    insertDoc.run({ ...doc, embedding });
  }

  const insertInterview = db.prepare(
    `INSERT INTO interviews (trigger_type, trigger_ref, person, questions, answers, status)
     VALUES (@trigger_type, @trigger_ref, @person, '[]', '[]', 'pending')`
  );
  for (const t of seed.interview_triggers) {
    insertInterview.run(t);
  }

  return {
    documents: seed.documents.length,
    interviews: seed.interview_triggers.length,
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
