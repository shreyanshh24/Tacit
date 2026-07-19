import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { listTranscripts } from "@/lib/transcripts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIR =
  process.env.TRANSCRIPTS_DIR || path.join(process.cwd(), "data", "transcripts");

/** List available transcript files (for the scrum agent form). */
export async function GET() {
  const files = listTranscripts().map((f) => ({ name: f.name, mtime: f.mtime }));
  return NextResponse.json({ transcripts: files });
}

/** Upload a transcript (name + text) into the transcripts folder. */
export async function POST(req: Request) {
  try {
    const { name, text } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }
    if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
    const safeName = (name ? String(name) : `standup-${Date.now()}`)
      .replace(/[^a-z0-9._-]/gi, "_")
      .replace(/\.(txt|md|vtt|srt)$/i, "");
    const file = path.join(DIR, `${safeName}.txt`);
    fs.writeFileSync(file, text, "utf8");
    return NextResponse.json({ ok: true, name: path.basename(file) });
  } catch (e) {
    return NextResponse.json(
      { error: String((e as Error).message ?? e) },
      { status: 500 }
    );
  }
}
