"use client";

import { useState } from "react";
import { useSources } from "@/components/SourcesProvider";
import CitationText from "@/components/CitationText";
import { consumeStream, StreamSource } from "@/components/streamClient";

const SAMPLE_PROPOSAL = `Proposal: Build a marketplace where partners can list payment solutions. Partners would get self-serve onboarding with no manual review, build integrations for free under a revenue-share model, and we would expose our APIs publicly for partners to integrate against. Rationale: expand the partner ecosystem beyond our direct integrations; revenue from higher volume. Timeline: launch by Q1 2025, marketplace platform estimated at 8 weeks to MVP. Status: in planning.`;

export default function ForesightPage() {
  const { register, open } = useSources();
  const [proposal, setProposal] = useState("");
  const [report, setReport] = useState("");
  const [sources, setSources] = useState<StreamSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  async function analyze() {
    if (!proposal.trim() || loading) return;
    setReport("");
    setSources([]);
    setError(null);
    setLoading(true);
    setStarted(true);

    try {
      const res = await fetch("/api/foresight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      await consumeStream(res, {
        onSources: (s) => {
          setSources(s);
          register(s);
        },
        onDelta: (t) => setReport((prev) => prev + t),
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const topMatch = sources[0];

  return (
    <div className="mx-auto max-w-3xl px-8 py-20">
      <header className="mb-9">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
          <span className="tacit-dot h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span className="text-[11px] font-medium uppercase tracking-widest text-amber-300/90">
            Foresight
          </span>
        </div>
        <h1 className="text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-white">
          Has this been{" "}
          <span className="bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
            tried before?
          </span>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-neutral-400">
          Describe something new. Tacit writes a pre-mortem grounded only in your own
          history — naming past initiatives and the assumptions this proposal repeats.
        </p>
      </header>

      <textarea
        value={proposal}
        onChange={(e) => setProposal(e.target.value)}
        placeholder="Paste the proposal here…"
        rows={7}
        className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-white placeholder:text-neutral-600 outline-none focus:border-amber-400/40"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={analyze}
          disabled={loading || !proposal.trim()}
          className="rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-medium text-[#0b0b0d] transition-opacity disabled:opacity-40 hover:bg-amber-300"
        >
          {loading ? "Analyzing…" : "Run pre-mortem"}
        </button>
        <button
          onClick={() => setProposal(SAMPLE_PROPOSAL)}
          className="text-xs text-neutral-500 hover:text-amber-300"
        >
          Load sample: Partner Marketplace proposal
        </button>
      </div>

      {error && (
        <div className="mt-8 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-sm text-red-300">{error}</p>
          <button
            onClick={analyze}
            className="mt-3 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      )}

      {started && !error && (
        <div className="mt-10 tacit-fade">
          {sources.length > 0 && (
            <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5">
              <div className="flex items-center gap-2">
                <span className="text-amber-400">⚠</span>
                <p className="text-sm font-semibold text-amber-200">
                  Similar past initiative found
                </p>
              </div>
              {topMatch && (
                <p className="mt-1.5 text-xs text-amber-200/70">
                  Closest match: {topMatch.title}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {sources.map((s) => (
                  <button
                    key={s.source_id}
                    onClick={() => open(s.source_id)}
                    className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-2.5 py-1.5 text-left transition-colors hover:border-amber-400/40"
                  >
                    <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
                      {s.source_id}
                    </span>
                    <span className="max-w-[200px] truncate text-xs text-amber-100/70">
                      {s.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && !report && <ThinkingLoader label="Consulting company history…" />}

          {report && (
            <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-7 shadow-xl shadow-black/20">
              <p className="mb-4 text-[11px] font-medium uppercase tracking-widest text-neutral-600">
                Pre-mortem
              </p>
              <CitationText text={report} streaming={loading} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ThinkingLoader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-neutral-500">
      <span className="flex gap-1">
        <span className="tacit-dot h-1.5 w-1.5 rounded-full bg-amber-400" style={{ animationDelay: "0ms" }} />
        <span className="tacit-dot h-1.5 w-1.5 rounded-full bg-amber-400" style={{ animationDelay: "200ms" }} />
        <span className="tacit-dot h-1.5 w-1.5 rounded-full bg-amber-400" style={{ animationDelay: "400ms" }} />
      </span>
      {label}
    </div>
  );
}
