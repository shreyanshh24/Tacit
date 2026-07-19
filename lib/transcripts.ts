// Local transcript intake for the Daily Scrum agent. Reads standup transcripts
// from TRANSCRIPTS_DIR (default ./data/transcripts). A real Google Drive puller
// can replace this later behind the same interface.

import fs from "fs";
import path from "path";

const DIR = process.env.TRANSCRIPTS_DIR || path.join(process.cwd(), "data", "transcripts");

export interface TranscriptFile {
  name: string;
  path: string;
  mtime: number;
}

function ensureDir(): string {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  return DIR;
}

/** List transcript files (newest first). */
export function listTranscripts(): TranscriptFile[] {
  const dir = ensureDir();
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(txt|md|vtt|srt)$/i.test(f))
    .map((f) => {
      const p = path.join(dir, f);
      return { name: f, path: p, mtime: fs.statSync(p).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

/** Strip WebVTT/SRT timestamps and cue numbers to plain dialogue. */
export function stripTranscript(raw: string): string {
  return raw
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      if (!t) return false;
      if (/^WEBVTT/i.test(t)) return false;
      if (/^\d+$/.test(t)) return false; // SRT cue number
      if (/-->/.test(t)) return false; // timestamp line
      return true;
    })
    .join("\n");
}

/** Read the most recent transcript's text (stripped), or null if none. */
export function latestTranscript(): { name: string; text: string } | null {
  const files = listTranscripts();
  if (!files.length) return null;
  const raw = fs.readFileSync(files[0].path, "utf8");
  return { name: files[0].name, text: stripTranscript(raw) };
}

/** Read a specific transcript by file name. */
export function readTranscript(name: string): { name: string; text: string } | null {
  const p = path.join(ensureDir(), path.basename(name));
  if (!fs.existsSync(p)) return null;
  return { name, text: stripTranscript(fs.readFileSync(p, "utf8")) };
}
