import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "tacit.db");

// Reuse a single connection across Next.js hot reloads in dev.
const globalForDb = globalThis as unknown as { __tacitDb?: Database.Database };

export function getDb(): Database.Database {
  if (globalForDb.__tacitDb) {
    // Connection may be cached across hot-reloads from before newer
    // migrations existed — apply them once per module evaluation.
    applyMigrations(globalForDb.__tacitDb);
    return globalForDb.__tacitDb;
  }

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  initSchema(db);
  applyMigrations(db);
  globalForDb.__tacitDb = db;
  return db;
}

// Runs at most once per module evaluation (resets on hot reload, so a cached
// connection still picks up newly-added columns without a full restart).
let migrationsApplied = false;
function applyMigrations(db: Database.Database) {
  if (migrationsApplied) return;
  ensureColumn(db, "interviews", "answered_by", "INTEGER");
  ensureColumn(db, "interviews", "project_id", "INTEGER");
  ensureColumn(db, "documents", "project_id", "INTEGER");
  ensureColumn(db, "documents", "member_id", "INTEGER");
  ensureColumn(db, "documents", "linked_jira_key", "TEXT");
  ensureColumn(db, "documents", "linked_jira_url", "TEXT");
  ensureColumn(db, "decisions", "project_id", "INTEGER");
  ensureColumn(db, "projects", "jira_base_url", "TEXT");
  ensureColumn(db, "projects", "jira_email", "TEXT");
  ensureColumn(db, "projects", "jira_token", "TEXT");
  ensureColumn(db, "members", "role", "TEXT");
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(activity_id, member_id)
    );
  `);
  migrationsApplied = true;
}

// Default export: the initialized database instance, so callers can do
//   import db from "@/lib/db";  db.prepare(...)
const db = getDb();
export default db;

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
      answered_by INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Multi-tenant / collaboration layer -------------------------------------

    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      owner_member_id INTEGER,
      jira_project_key TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Attributed activity feed across all views.
    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER,
      project_id INTEGER,
      member_id INTEGER,
      type TEXT NOT NULL,          -- 'memory' | 'assumptions' | 'foresight' | 'interview' | 'jira_import'
      title TEXT,
      detail TEXT,
      ref TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      activity_id INTEGER NOT NULL,
      member_id INTEGER,
      body TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Lightweight migrations for databases created before newer columns existed.
  ensureColumn(db, "interviews", "answered_by", "INTEGER");
  ensureColumn(db, "documents", "project_id", "INTEGER");
  ensureColumn(db, "documents", "member_id", "INTEGER");
  ensureColumn(db, "documents", "linked_jira_key", "TEXT");
  ensureColumn(db, "documents", "linked_jira_url", "TEXT");
}

/** Add a column to an existing table if it isn't already present. */
function ensureColumn(
  db: Database.Database,
  table: string,
  column: string,
  type: string
) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
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
  project_id: number | null;
  member_id: number | null;
  linked_jira_key: string | null;
  linked_jira_url: string | null;
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
  project_id: number | null;
}

export interface InterviewRow {
  id: number;
  trigger_type: string | null;
  trigger_ref: string | null;
  person: string | null;
  questions: string | null;
  answers: string | null;
  status: string;
  answered_by: number | null;
  project_id: number | null;
  created_at: string;
}

export interface TeamRow {
  id: number;
  name: string;
  created_at: string;
}

export interface MemberRow {
  id: number;
  team_id: number;
  name: string;
  email: string | null;
  role: string | null;
  created_at: string;
}

export interface ProjectRow {
  id: number;
  team_id: number;
  name: string;
  owner_member_id: number | null;
  jira_project_key: string | null;
  jira_base_url: string | null;
  jira_email: string | null;
  jira_token: string | null;
  created_at: string;
}

export interface ActivityRow {
  id: number;
  team_id: number | null;
  project_id: number | null;
  member_id: number | null;
  type: string;
  title: string | null;
  detail: string | null;
  ref: string | null;
  created_at: string;
}

export interface CommentRow {
  id: number;
  activity_id: number;
  member_id: number | null;
  body: string;
  created_at: string;
}
