import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "tacit.db");

// Reuse a single connection across Next.js hot reloads in dev.
const globalForDb = globalThis as unknown as { __tacitDb?: Database.Database };

export function getDb(): Database.Database {
  if (globalForDb.__tacitDb) return globalForDb.__tacitDb;

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  initSchema(db);
  globalForDb.__tacitDb = db;
  return db;
}

export function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      source_id TEXT,
      author TEXT,
      ts TEXT,
      title TEXT,
      content TEXT NOT NULL,
      embedding TEXT
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      decision TEXT,
      reasoning TEXT,
      alternatives TEXT,
      people TEXT,
      outcome TEXT,
      ts TEXT,
      source_ids TEXT
    );

    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      content TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assumptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER,
      text TEXT,
      why_load_bearing TEXT,
      risk TEXT,
      stated_or_implicit TEXT,
      validated INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS interviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trigger_type TEXT,
      trigger_ref TEXT,
      person TEXT,
      questions TEXT,
      answers TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// --- Row types ---------------------------------------------------------------

export interface DocumentRow {
  id: number;
  source: string;
  source_id: string | null;
  author: string | null;
  ts: string | null;
  title: string | null;
  content: string;
  embedding: string | null;
}

export interface DecisionRow {
  id: number;
  title: string | null;
  decision: string | null;
  reasoning: string | null;
  alternatives: string | null;
  people: string | null;
  outcome: string | null;
  ts: string | null;
  source_ids: string | null;
}

export interface InterviewRow {
  id: number;
  trigger_type: string | null;
  trigger_ref: string | null;
  person: string | null;
  questions: string | null;
  answers: string | null;
  status: string;
  created_at: string;
}
