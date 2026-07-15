"use client";

import { useEffect, useState } from "react";

interface Interview {
  id: number;
  trigger_type: string;
  trigger_ref: string;
  person: string;
  questions: string[];
  answers: { q: string; a: string }[];
  status: "pending" | "answered" | "synthesized";
}

// Demo aids: subtle placeholder hints the presenter can paste.
const DEMO_ANSWERS = [
  "Root cause was the legacy synchronous calls to Stripe. Each payment request blocks on Stripe's response, so when Stripe slowed down, every payment in the system stalled behind it.",
  "I first tried raising the client timeout — made it worse, just held threads longer. The actual fix was rerouting payment traffic through the async queue we built in June and letting the retry logic drain the backlog.",
  "Finish migrating the remaining legacy payment paths to the async queue pattern (NIMBUSPAY-4520). About 30% of payment code still makes direct sync calls. Until that's done this exact incident can recur.",
  "Watch for thread pool saturation alerts on the payments service — that was the earliest signal, about 10 minutes before merchant-visible failures started.",
];

const statusStyle: Record<string, string> = {
  pending: "bg-amber-400/15 text-amber-300",
  answered: "bg-sky-400/15 text-sky-300",
  synthesized: "bg-emerald-400/15 text-emerald-300",
};

export default function InterviewerPage() {
  const [interviews, setInterviews] = useState<Interview[] | null>(null);
  const [active, setActive] = useState<Interview | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetch("/api/interviews");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load interviews");
      setInterviews(data.interviews);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-8 py-20">
      <header className="mb-9">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
          <span className="tacit-dot h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span className="text-[11px] font-medium uppercase tracking-widest text-amber-300/90">
            Interviewer
          </span>
        </div>
        <h1 className="text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-white">
          Capture what was{" "}
          <span className="bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
            never written down.
          </span>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-neutral-400">
          When something notable happens, Tacit interviews the person who handled it —
          then folds their answers into the company brain.
        </p>
      </header>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-sm text-red-300">{error}</p>
          <button
            onClick={load}
            className="mt-3 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      )}

      {loadingList && !interviews && (
        <p className="text-sm text-neutral-500">Loading interview queue…</p>
      )}

      {!active && interviews && (
        <div className="space-y-2">
          {interviews.length === 0 && (
            <p className="text-sm text-neutral-500">No interviews triggered yet.</p>
          )}
          {interviews.map((iv) => (
            <button
              key={iv.id}
              onClick={() => setActive(iv)}
              className="flex w-full items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-5 py-4 text-left transition-colors hover:border-amber-400/30"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">
                    Incident resolved · {iv.trigger_ref}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                      statusStyle[iv.status]
                    }`}
                  >
                    {iv.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  Interviewee: {iv.person} · {iv.questions.length} questions
                </p>
              </div>
              <span className="text-neutral-600">›</span>
            </button>
          ))}
        </div>
      )}

      {active && (
        <InterviewSession
          interview={active}
          onBack={() => {
            setActive(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function InterviewSession({
  interview,
  onBack,
}: {
  interview: Interview;
  onBack: () => void;
}) {
  const alreadyDone = interview.status === "synthesized";
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<{ q: string; a: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ source_id: string; title: string; document: string } | null>(
    null
  );

  const questions = interview.questions;
  const done = step >= questions.length;

  async function submitAll(collected: { q: string; a: string }[]) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/interviews/${interview.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: collected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Synthesis failed");
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    if (!draft.trim()) return;
    const collected = [...answers, { q: questions[step], a: draft.trim() }];
    setAnswers(collected);
    setDraft("");
    const nextStep = step + 1;
    setStep(nextStep);
    if (nextStep >= questions.length) submitAll(collected);
  }

  return (
    <div className="tacit-fade">
      <button
        onClick={onBack}
        className="mb-6 text-xs text-neutral-500 hover:text-amber-300"
      >
        ‹ Back to queue
      </button>

      {alreadyDone && !result ? (
        <PriorSynthesis interview={interview} />
      ) : result ? (
        <Captured result={result} />
      ) : (
        <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
          <p className="text-xs text-neutral-500">
            Tacit is interviewing <span className="text-neutral-300">{interview.person}</span>{" "}
            about {interview.trigger_ref}
          </p>

          <div className="mt-5 space-y-4">
            {answers.map((qa, i) => (
              <div key={i} className="space-y-2">
                <Bubble role="tacit">{qa.q}</Bubble>
                <Bubble role="user">{qa.a}</Bubble>
              </div>
            ))}

            {!done && (
              <div className="space-y-2">
                <Bubble role="tacit">
                  <span className="text-neutral-500">
                    Question {step + 1} of {questions.length}
                  </span>
                  <br />
                  {questions[step]}
                </Bubble>
              </div>
            )}

            {submitting && (
              <p className="text-sm text-neutral-500">Synthesizing knowledge document…</p>
            )}
            {error && <p className="text-sm text-red-300">{error}</p>}
          </div>

          {!done && (
            <div className="mt-5">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") next();
                }}
                placeholder={DEMO_ANSWERS[step] ?? "Type your answer…"}
                rows={3}
                className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-white placeholder:text-neutral-700 outline-none focus:border-amber-400/40"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-neutral-600">
                  Tip: the greyed text is the suggested demo answer — ⌘/Ctrl + Enter to send
                </span>
                <button
                  onClick={next}
                  disabled={!draft.trim()}
                  className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-[#0b0b0d] transition-opacity disabled:opacity-40 hover:bg-amber-300"
                >
                  {step + 1 >= questions.length ? "Finish & capture" : "Send"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Captured({
  result,
}: {
  result: { source_id: string; title: string; document: string };
}) {
  return (
    <div>
      <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-5 py-3">
        <span className="text-emerald-400">✓</span>
        <p className="text-sm font-medium text-emerald-200">Knowledge captured</p>
      </div>
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded bg-amber-400/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
            {result.source_id}
          </span>
          <h3 className="text-sm font-semibold text-white">{result.title}</h3>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
          {result.document}
        </p>
      </div>
      <p className="mt-4 text-sm text-neutral-500">
        This is now part of company memory — try asking Memory:{" "}
        <span className="text-amber-300">
          &ldquo;What caused the September payments incident and how do we prevent it?&rdquo;
        </span>
      </p>
    </div>
  );
}

function PriorSynthesis({ interview }: { interview: Interview }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-emerald-400">✓</span>
        <p className="text-sm font-medium text-emerald-200">
          Already synthesized into company memory
        </p>
      </div>
      <div className="space-y-4">
        {interview.answers.map((qa, i) => (
          <div key={i} className="space-y-2">
            <Bubble role="tacit">{qa.q}</Bubble>
            <Bubble role="user">{qa.a}</Bubble>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-neutral-500">
        Ask Memory: &ldquo;What caused the September payments incident?&rdquo; — it now cites{" "}
        <span className="text-amber-300">INTERVIEW-{interview.id}</span>.
      </p>
    </div>
  );
}

function Bubble({ role, children }: { role: "tacit" | "user"; children: React.ReactNode }) {
  const isTacit = role === "tacit";
  return (
    <div className={`flex ${isTacit ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isTacit
            ? "bg-white/[0.04] text-neutral-200"
            : "bg-amber-400/15 text-amber-100"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
