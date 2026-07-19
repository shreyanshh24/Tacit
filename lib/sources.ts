// Unified knowledge ingestion for chat retrieval. Pulls three source types into
// the embedded `documents` table (project-scoped), on top of Jira:
//   - drive:      Google Drive CRM360 docs downloaded to data/crm360/**
//   - transcript: meeting transcripts (data/crm360/01_Meeting_Transcripts + data/transcripts)
//   - docs:       the CRM360 repo docs/ tree on main (fetched via gh)
// Re-runnable: upserts by source_id and dedupes identical content by hash.

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getDb } from "./db";
import { embed } from "./embeddings";
import { stripTranscript } from "./transcripts";
import { listRepoFiles, getFileContent, DEFAULT_REPO } from "./github";

const DATA_DIR = path.join(process.cwd(), "data");
const CRM_DIR = path.join(DATA_DIR, "crm360");
const TRANSCRIPTS_DIR =
  process.env.TRANSCRIPTS_DIR || path.join(DATA_DIR, "transcripts");

export interface SyncResult {
  docs: number;
  drive: number;
  transcript: number;
  skipped: number;
}

interface Candidate {
  source: "drive" | "transcript" | "docs";
  source_id: string;
  title: string;
  content: string;
  ts: string;
}

/** First markdown H1 as a title, else the filename stem. */
function titleFrom(content: string, fallback: string): string {
  const m = content.match(/^#\s+(.+)$/m);
  return (m?.[1] || fallback).trim().slice(0, 160);
}

/** Recursively collect text files under a directory. */
function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.(md|txt|vtt|srt)$/i.test(entry.name)) out.push(p);
  }
  return out;
}

/** Gather local file candidates from data/crm360 and data/transcripts. */
function localCandidates(): Candidate[] {
  const out: Candidate[] = [];

  for (const file of walk(CRM_DIR)) {
    const rel = path.relative(DATA_DIR, file).split(path.sep).join("/");
    const isTranscript = /01_Meeting_Transcripts/i.test(rel);
    const raw = fs.readFileSync(file, "utf8");
    const content = isTranscript ? stripTranscript(raw) : raw;
    out.push({
      source: isTranscript ? "transcript" : "drive",
      source_id: rel, // e.g. crm360/02_Architecture/data-model.md
      title: titleFrom(content, path.basename(file)),
      content,
      ts: new Date().toISOString().slice(0, 10),
    });
  }

  for (const file of walk(TRANSCRIPTS_DIR)) {
    const rel = path.relative(DATA_DIR, file).split(path.sep).join("/");
    const content = stripTranscript(fs.readFileSync(file, "utf8"));
    out.push({
      source: "transcript",
      source_id: rel, // e.g. transcripts/standup-2026-07-19.md
      title: titleFrom(content, path.basename(file)),
      content,
      ts: new Date().toISOString().slice(0, 10),
    });
  }

  return out;
}

/** Fetch the CRM360 repo docs/ tree on main as candidates. */
async function repoDocCandidates(): Promise<Candidate[]> {
  if (!DEFAULT_REPO) return [];
  const files = (await listRepoFiles("main")).filter(
    (p) => p.startsWith("docs/") && /\.md$/i.test(p)
  );
  const out: Candidate[] = [];
  for (const p of files) {
    const content = await getFileContent(p, "main");
    if (!content) continue;
    out.push({
      source: "docs",
      source_id: p, // e.g. docs/04-decisions/ADR-009-....md
      title: titleFrom(content, path.basename(p)),
      content,
      ts: new Date().toISOString().slice(0, 10),
    });
  }
  return out;
}

/**
 * (Re)ingest all non-Jira knowledge sources into the project's memory.
 * Upserts by source_id; dedupes identical content across sources.
 */
export async function syncSources(projectId: number | null): Promise<SyncResult> {
  const db = getDb();
  const candidates = [...localCandidates(), ...(await repoDocCandidates())];

  const upsert = db.prepare(
    `INSERT INTO documents (source, source_id, author, ts, title, content, embedding, project_id)
     VALUES (@source, @source_id, @author, @ts, @title, @content, @embedding, @project_id)`
  );
  const del = db.prepare(
    "DELETE FROM documents WHERE source_id = ? AND project_id IS ?"
  );

  const res: SyncResult = { docs: 0, drive: 0, transcript: 0, skipped: 0 };
  const seenHashes = new Set<string>();

  for (const c of candidates) {
    const body = c.content.trim();
    if (!body) {
      res.skipped++;
      continue;
    }
    const hash = crypto.createHash("sha1").update(body).digest("hex");
    if (seenHashes.has(hash)) {
      res.skipped++;
      continue;
    }
    seenHashes.add(hash);

    const embedding = JSON.stringify(await embed(`${c.title}\n${body}`));
    del.run(c.source_id, projectId);
    upsert.run({
      source: c.source,
      source_id: c.source_id,
      author: null,
      ts: c.ts,
      title: c.title,
      content: body,
      embedding,
      project_id: projectId,
    });
    res[c.source]++;
  }

  return res;
}
