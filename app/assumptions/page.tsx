"use client";

import { useState } from "react";

interface Assumption {
  text: string;
  why_load_bearing: string;
  risk: "high" | "medium" | "low";
  stated_or_implicit: "stated" | "implicit";
  validated?: boolean;
}

const SAMPLE_TITLE = "Partner Marketplace";
const SAMPLE_PLAN = `Proposal: Build a marketplace where partners can list payment solutions. Partners would get self-serve onboarding with no manual review, build integrations for free under a revenue-share model, and we would expose our APIs publicly for partners to integrate against. Rationale: expand the partner ecosystem beyond our direct integrations; revenue from higher volume. Timeline: launch by Q1 2025, marketplace platform estimated at 8 weeks to MVP. Status: in planning.`;

const riskStyle: Record<string, string> = {
  high: "bg-red-500/15 text-red-300 border-red-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  low: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

export default function AssumptionsPage() {
  const [title, setTitle] = useState("");
  const [plan, setPlan] = useState("");
  const [assumptions, setAssumptions] = useState<Assumption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    if (!plan.trim() || loading) return;
    setLoading(true);
    setError(null);
    setAssumptions(null);
    try {
      const res = await fetch("/api/assumptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setAssumptions(
        (data.assumptions as Assumption[]).map((a) => ({ ...a, validated: false }))
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function toggle(i: number) {
    setAssumptions((prev) =>
      prev
        ? prev.map((a, idx) => (idx === i ? { ...a, validated: !a.validated } : a))
        : prev
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-20">
      <header className="mb-9">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
          <span className="tacit-dot h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span className="text-[11px] font-medium uppercase tracking-widest text-amber-300/90">
            Assumptions
          </span>
        </div>
        <h1 className="text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-white">
          Surface the{" "}
          <span className="bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
            hidden bets.
          </span>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-neutral-400">
          Paste a plan. Tacit extracts what it treats as true without evidence —
          especially the implicit assumptions the author doesn&apos;t realize they&apos;re making.
        </p>
      </header>

      <div className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Plan title"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-amber-400/40"
        />
        <textarea
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          placeholder="Paste the plan here…"
          rows={7}
          className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-white placeholder:text-neutral-600 outline-none focus:border-amber-400/40"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={analyze}
            disabled={loading || !plan.trim()}
            className="rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-medium text-[#0b0b0d] transition-opacity disabled:opacity-40 hover:bg-amber-300"
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
          <button
            onClick={() => {
              setTitle(SAMPLE_TITLE);
              setPlan(SAMPLE_PLAN);
            }}
            className="text-xs text-neutral-500 hover:text-amber-300"
          >
            Load sample: Partner Marketplace proposal
          </button>
        </div>
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

      {loading && (
        <p className="mt-8 text-sm text-neutral-500">Extracting assumptions…</p>
      )}

      {assumptions && (
        <div className="mt-10 space-y-3 tacit-fade">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-widest text-neutral-600">
              {assumptions.length} assumptions · sorted by risk
            </p>
          </div>
          {assumptions.map((a, i) => (
            <div
              key={i}
              className={`rounded-xl border bg-white/[0.02] p-5 transition-opacity ${
                a.validated ? "border-emerald-500/20 opacity-60" : "border-white/8"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm font-medium leading-relaxed text-neutral-100">
                  {a.text}
                </p>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
                    riskStyle[a.risk] ?? riskStyle.medium
                  }`}
                >
                  {a.risk}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                <span className="text-neutral-500">If false: </span>
                {a.why_load_bearing}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span
                  className={`rounded px-2 py-0.5 text-[11px] ${
                    a.stated_or_implicit === "implicit"
                      ? "bg-amber-400/10 text-amber-300"
                      : "bg-white/5 text-neutral-400"
                  }`}
                >
                  {a.stated_or_implicit}
                </span>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-500">
                  <input
                    type="checkbox"
                    checked={!!a.validated}
                    onChange={() => toggle(i)}
                    className="h-3.5 w-3.5 accent-emerald-400"
                  />
                  Validated
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
