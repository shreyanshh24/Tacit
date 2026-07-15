"use client";

import { useRef, useState } from "react";
import { useSources } from "@/components/SourcesProvider";
import CitationText from "@/components/CitationText";
import { consumeStream, StreamSource } from "@/components/streamClient";

const EXAMPLES = [
  "Why did we kill the Partner Portal?",
  "Why did we choose Stripe?",
  "What did we decide about on-call rotations?",
  "What caused the September payments incident and how do we prevent it?",
];

export default function MemoryPage() {
  const { register, open } = useSources();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<StreamSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asked, setAsked] = useState(false);
  const lastQuestion = useRef("");

  async function ask(q: string) {
    const query = q.trim();
    if (!query || loading) return;
    lastQuestion.current = query;
    setQuestion(query);
    setAnswer("");
    setSources([]);
    setError(null);
    setLoading(true);
    setAsked(true);

    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);

      await consumeStream(res, {
        onSources: (s) => {
          setSources(s);
          register(s);
        },
        onDelta: (t) => setAnswer((prev) => prev + t),
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-20">
      <header className="mb-9">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
          <span className="tacit-dot h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span className="text-[11px] font-medium uppercase tracking-widest text-amber-300/90">
            Memory
          </span>
        </div>
        <h1 className="text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-white">
          Ask about any{" "}
          <span className="bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
            decision.
          </span>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-neutral-400">
          Tacit reconstructs the decision trail from your company&apos;s work history —
          who raised it, what alternatives existed, and what tipped the call.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="group relative"
      >
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
            <path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </span>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about any decision…"
          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-4 pl-12 pr-28 text-[15px] text-white shadow-xl shadow-black/20 outline-none transition-all placeholder:text-neutral-600 focus:border-amber-400/50 focus:bg-white/[0.05] focus:shadow-amber-500/5"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-[#0a0a0c] shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-300 disabled:opacity-40 disabled:shadow-none"
        >
          {loading ? "Thinking…" : "Ask"}
        </button>
      </form>

      {!asked && (
        <div className="mt-7">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-neutral-600">
            Try asking
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => ask(ex)}
                className="group flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-3.5 py-2 text-[13px] text-neutral-400 transition-all hover:border-amber-400/40 hover:bg-amber-400/[0.06] hover:text-amber-200"
              >
                <span className="text-neutral-600 transition-colors group-hover:text-amber-400">↗</span>
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-sm text-red-300">{error}</p>
          <button
            onClick={() => ask(lastQuestion.current)}
            className="mt-3 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      )}

      {asked && !error && (
        <div className="mt-10 tacit-fade">
          {loading && !answer && <ThinkingLoader label="Searching company memory…" />}
          {answer && (
            <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-7 shadow-xl shadow-black/20">
              <CitationText text={answer} streaming={loading} />
            </div>
          )}

          {sources.length > 0 && (
            <div className="mt-6">
              <p className="mb-2.5 text-xs font-medium uppercase tracking-widest text-neutral-600">
                Sources
              </p>
              <div className="flex flex-wrap gap-2">
                {sources.map((s) => (
                  <button
                    key={s.source_id}
                    onClick={() => open(s.source_id)}
                    className="group flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-left transition-colors hover:border-amber-400/30"
                  >
                    <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                      {s.source_id}
                    </span>
                    <span className="max-w-[220px] truncate text-xs text-neutral-400 group-hover:text-neutral-200">
                      {s.title}
                    </span>
                  </button>
                ))}
              </div>
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
