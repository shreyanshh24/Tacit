"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/components/SessionProvider";

interface IssueOption {
  key: string;
  summary: string;
  url: string;
}

interface Capture {
  id: number;
  source_id: string;
  title: string;
  content: string;
  ts: string;
  author: string | null;
  member_name: string | null;
  linked_jira_key: string | null;
  linked_jira_url: string | null;
}

/** Strip VTT/SRT headers, cue indices and timestamps into readable text. */
function cleanTranscript(text: string, filename: string): string {
  if (!/\.(vtt|srt)$/i.test(filename)) return text;
  return text
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (t === "WEBVTT") return false;
      if (/^\d+$/.test(t)) return false; // SRT cue index
      if (/-->/.test(t)) return false; // timestamp line
      return true;
    })
    .join("\n");
}

export default function CapturePage() {
  const { project, member } = useSession();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [jiraKey, setJiraKey] = useState("");
  const [issues, setIssues] = useState<IssueOption[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [issuesError, setIssuesError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadCaptures = useCallback(async () => {
    const res = await fetch("/api/capture");
    const data = await res.json();
    setCaptures(data.captures ?? []);
  }, []);

  useEffect(() => {
    loadCaptures();
  }, [loadCaptures]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setContent(cleanTranscript(text, file.name));
    if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ""));
  }

  async function loadIssues() {
    setLoadingIssues(true);
    setIssuesError(null);
    try {
      const res = await fetch("/api/jira/issues");
      const data = await res.json();
      setIssues(data.issues ?? []);
      if (data.error) setIssuesError(data.error);
    } catch (e) {
      setIssuesError(String((e as Error).message ?? e));
    } finally {
      setLoadingIssues(false);
    }
  }

  async function autoSuggest() {
    if (!content.trim() || suggesting) return;
    setSuggesting(true);
    setSuggestion(null);
    try {
      const res = await fetch("/api/capture/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          issues: issues.map((i) => ({ key: i.key, summary: i.summary })),
        }),
      });
      const data = await res.json();
      if (data.error) {
        setSuggestion(`Couldn't suggest: ${data.error}`);
      } else {
        if (data.suggested_key) setJiraKey(data.suggested_key);
        if (data.title && !title.trim()) setTitle(data.title);
        setSuggestion(
          data.suggested_key
            ? `Suggested ${data.suggested_key} (${data.confidence} confidence)`
            : "No strong ticket match found."
        );
      }
    } finally {
      setSuggesting(false);
    }
  }

  async function save() {
    if (!content.trim() || saving) return;
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, jiraKey: jiraKey || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setSaved(`Saved as ${data.source_id}${data.linked_jira_key ? ` · linked to ${data.linked_jira_key}` : ""}.`);
      setTitle("");
      setContent("");
      setJiraKey("");
      setSuggestion(null);
      if (fileRef.current) fileRef.current.value = "";
      loadCaptures();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-20">
      <header className="mb-9">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
          <span className="tacit-dot h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span className="text-[11px] font-medium uppercase tracking-widest text-amber-300/90">
            Capture
          </span>
        </div>
        <h1 className="text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-white">
          Capture the{" "}
          <span className="bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
            context.
          </span>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-neutral-400">
          Upload a spec, decision doc, or meeting transcript into{" "}
          <span className="text-neutral-300">{project?.name}</span>&apos;s memory — and link it to
          the Jira ticket it belongs to. It becomes searchable, with the ticket attached.
        </p>
      </header>

      <div className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional — auto-generated if blank)"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-amber-400/40"
        />

        <div className="relative">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste what you're building, the decision, or meeting notes… or upload a file below."
            rows={9}
            className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-white placeholder:text-neutral-600 outline-none focus:border-amber-400/40"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.markdown,.vtt,.srt,.log,text/plain"
            onChange={onFile}
            className="hidden"
            id="capture-file"
          />
          <label
            htmlFor="capture-file"
            className="cursor-pointer rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm text-neutral-300 transition-colors hover:border-amber-400/40 hover:text-amber-200"
          >
            ↑ Upload file (.txt, .md, .vtt, .srt)
          </label>
          <span className="text-[11px] text-neutral-600">
            Transcripts are cleaned automatically. Google Meet / Slack auto-capture comes later.
          </span>
        </div>

        {/* Jira ticket linking */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-200">Link a Jira ticket</p>
            <div className="flex gap-2">
              <button
                onClick={loadIssues}
                disabled={loadingIssues}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-neutral-300 hover:border-amber-400/40 disabled:opacity-40"
              >
                {loadingIssues ? "Loading…" : "Load tickets"}
              </button>
              <button
                onClick={autoSuggest}
                disabled={suggesting || !content.trim()}
                className="rounded-lg border border-amber-400/30 bg-amber-400/[0.06] px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-400/[0.12] disabled:opacity-40"
                title="Let Tacit suggest the best ticket from the text"
              >
                {suggesting ? "Thinking…" : "✦ Auto-suggest"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {issues.length > 0 && (
              <select
                value={jiraKey}
                onChange={(e) => setJiraKey(e.target.value)}
                className="flex-1 rounded-lg border border-white/10 bg-[#0d0d10] px-3 py-2 text-sm text-white outline-none focus:border-amber-400/40"
              >
                <option value="">— Select a ticket —</option>
                {issues.map((i) => (
                  <option key={i.key} value={i.key}>
                    {i.key} · {i.summary}
                  </option>
                ))}
              </select>
            )}
            <input
              value={jiraKey}
              onChange={(e) => setJiraKey(e.target.value.toUpperCase())}
              placeholder="or type a key (e.g. TACIT-2)"
              className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm uppercase text-white placeholder:normal-case placeholder:text-neutral-600 outline-none focus:border-amber-400/40"
            />
          </div>
          {issuesError && <p className="mt-2 text-[12px] text-neutral-500">{issuesError}</p>}
          {suggestion && <p className="mt-2 text-[12px] text-amber-300/80">{suggestion}</p>}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving || !content.trim()}
            className="rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-semibold text-[#0a0a0c] transition-opacity hover:bg-amber-300 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save to memory"}
          </button>
          <span className="text-[11px] text-neutral-600">Capturing as {member?.name}</span>
        </div>

        {saved && (
          <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2 text-[13px] text-emerald-200">
            ✓ {saved} It&apos;s searchable in Memory now.
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[13px] text-red-300">
            {error}
          </p>
        )}
      </div>

      {/* Captured so far */}
      <div className="mt-12">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-neutral-600">
          Captured context ({captures.length})
        </p>
        {captures.length === 0 ? (
          <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-5 text-sm text-neutral-500">
            Nothing captured yet. Upload a spec or paste a decision above.
          </p>
        ) : (
          <div className="space-y-2">
            {captures.map((c) => (
              <div key={c.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
                        {c.source_id}
                      </span>
                      <span className="text-sm font-medium text-neutral-100">{c.title}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13px] text-neutral-500">{c.content}</p>
                    <p className="mt-1.5 text-[11px] text-neutral-600">
                      {c.member_name ?? c.author ?? "Unknown"} · {c.ts}
                    </p>
                  </div>
                  {c.linked_jira_key && c.linked_jira_url && (
                    <a
                      href={c.linked_jira_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-md bg-blue-400/15 px-2 py-1 text-[11px] font-medium text-blue-300 hover:bg-blue-400/25"
                    >
                      {c.linked_jira_key} ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
