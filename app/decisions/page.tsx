"use client";

import { useCallback, useEffect, useState } from "react";

interface Alternative {
  option?: string;
  why_rejected?: string;
}
interface Person {
  name?: string;
  role_in_decision?: string;
}
interface Decision {
  id: number;
  title: string | null;
  decision: string | null;
  reasoning: string | null;
  outcome: string | null;
  ts: string | null;
  alternatives: Alternative[];
  people: Person[];
  source_ids: string[];
}

const outcomeStyle: Record<string, string> = {
  succeeded: "bg-emerald-400/15 text-emerald-300",
  active: "bg-emerald-400/15 text-emerald-300",
  killed: "bg-red-400/15 text-red-300",
  failed: "bg-red-400/15 text-red-300",
  unknown: "bg-white/10 text-neutral-400",
};

export default function DecisionsPage() {
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/decisions");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load decisions");
      setDecisions(data.decisions);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function extract() {
    if (extracting) return;
    setExtracting(true);
    setError(null);
    try {
      const res = await fetch("/api/decisions", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed");
      await load();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-20">
      <header className="mb-9">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
          <span className="tacit-dot h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span className="text-[11px] font-medium uppercase tracking-widest text-amber-300/90">
            Decisions
          </span>
        </div>
        <h1 className="text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-white">
          The decision{" "}
          <span className="bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
            log.
          </span>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-neutral-400">
          Every decision Tacit extracted from this project&apos;s memory — what was chosen, why,
          what was rejected, and how it turned out.
        </p>
      </header>

      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={extract}
          disabled={extracting}
          className="rounded-lg border border-amber-400/30 bg-amber-400/[0.06] px-4 py-2 text-sm text-amber-200 transition-colors hover:bg-amber-400/[0.12] disabled:opacity-50"
        >
          {extracting ? "Extracting decisions…" : "↻ Re-extract from memory"}
        </button>
        <span className="text-[11px] text-neutral-600">
          Run after importing Jira or capturing docs to refresh this log.
        </span>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[13px] text-red-300">
          {error}
        </p>
      )}

      {decisions && decisions.length === 0 && (
        <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-6 text-sm text-neutral-500">
          No decisions extracted yet. Import Jira issues or capture docs, then click
          &ldquo;Re-extract from memory.&rdquo;
        </p>
      )}

      <div className="space-y-3">
        {decisions?.map((d) => {
          const oc = (d.outcome ?? "unknown").toLowerCase();
          return (
            <div key={d.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-white">{d.title ?? "Untitled decision"}</h3>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
                    outcomeStyle[oc] ?? outcomeStyle.unknown
                  }`}
                >
                  {oc}
                </span>
              </div>
              {d.decision && <p className="mt-2 text-sm text-neutral-200">{d.decision}</p>}
              {d.reasoning && (
                <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-400">
                  <span className="text-neutral-500">Why: </span>
                  {d.reasoning}
                </p>
              )}

              {d.alternatives.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-medium uppercase tracking-widest text-neutral-600">
                    Alternatives considered
                  </p>
                  <ul className="mt-1 space-y-1">
                    {d.alternatives.map((a, i) => (
                      <li key={i} className="text-[13px] text-neutral-400">
                        <span className="text-neutral-300">{a.option}</span>
                        {a.why_rejected ? ` — ${a.why_rejected}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {d.people.map((p, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-neutral-400"
                  >
                    {p.name}
                    {p.role_in_decision ? ` · ${p.role_in_decision}` : ""}
                  </span>
                ))}
                {d.source_ids.map((s) => (
                  <span
                    key={s}
                    className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300"
                  >
                    {String(s)}
                  </span>
                ))}
                {d.ts && <span className="text-[11px] text-neutral-600">{d.ts}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
