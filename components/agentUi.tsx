"use client";

import { useEffect, useRef } from "react";

export type AgentType = "scrum" | "tester" | "pr_security";

export const TYPE_LABEL: Record<AgentType, string> = {
  scrum: "Daily Scrum",
  tester: "Ticket Tester",
  pr_security: "PR Security Review",
};

export const TYPE_DESC: Record<AgentType, string> = {
  scrum:
    "Reads a standup transcript, posts a progress update to every Jira ticket mentioned, and logs any decisions it captures to the project's Decisions.",
  tester:
    "Clones a branch, generates and runs the ticket's tests, and posts a pass/fail verdict to Jira.",
  pr_security:
    "Watches a branch — when a PR targets it, reviews the diff for vulnerabilities and posts a security report on the PR.",
};

export interface RunResult {
  verdict?: string;
  severity?: string;
  summary?: string;
  tests?: string;
  comment?: string;
  error?: string;
  raw?: string;
  findings?: {
    title?: string;
    severity?: string;
    location?: string;
    detail?: string;
  }[];
  updates?: { ticketKey?: string; summary?: string; comment?: string }[];
  decisionsRecorded?: number;
}

export type Tone = "green" | "red" | "amber" | "blue" | "gray";

export function Badge({
  tone,
  children,
}: {
  tone: Tone;
  children: React.ReactNode;
}) {
  const map: Record<Tone, string> = {
    green: "bg-emerald-500/15 text-emerald-300",
    red: "bg-red-500/15 text-red-300",
    amber: "bg-amber-500/15 text-amber-300",
    blue: "bg-blue-500/15 text-blue-300",
    gray: "bg-white/5 text-neutral-400",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] ${map[tone]}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Tone =
    status === "done"
      ? "green"
      : status === "failed"
        ? "red"
        : status === "running"
          ? "amber"
          : "gray";
  return <Badge tone={tone}>{status}</Badge>;
}

export function sevTone(sev: string): Tone {
  if (sev === "critical" || sev === "high") return "red";
  if (sev === "medium") return "amber";
  if (sev === "low") return "blue";
  return "gray";
}

export interface TestCase {
  name: string;
  status: "pending" | "running" | "pass" | "fail";
  detail?: string;
}

/** Extract the current step (last "■ …" phase marker) from a run log. */
export function currentPhase(log: string): string {
  const phases = log
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("■"))
    .map((l) => l.replace(/^■\s*/, ""));
  return phases[phases.length - 1] || "";
}

/** Non-technical live view: each test is a card that fills in pass/fail. */
export function TestGrid({
  tests,
  running,
}: {
  tests: TestCase[];
  running: boolean;
}) {
  const passed = tests.filter((t) => t.status === "pass").length;
  const failed = tests.filter((t) => t.status === "fail").length;
  const pending = tests.filter(
    (t) => t.status === "pending" || t.status === "running"
  ).length;

  if (tests.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-black/20 p-6 text-center text-[13px] text-neutral-400">
        {running ? (
          <span className="animate-pulse">
            The agent is reading the ticket and figuring out what to test…
          </span>
        ) : (
          "No tests yet."
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px]">
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 font-medium text-emerald-300">
          ✓ {passed} passed
        </span>
        <span className="rounded-full bg-red-500/15 px-2.5 py-1 font-medium text-red-300">
          ✗ {failed} failed
        </span>
        {pending > 0 && (
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-neutral-400">
            {pending} {running ? "running…" : "pending"}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {tests.map((t, i) => (
          <TestCard key={i} test={t} />
        ))}
      </div>
    </div>
  );
}

function TestCard({ test }: { test: TestCase }) {
  const style: Record<
    TestCase["status"],
    { box: string; icon: string; label: string }
  > = {
    pass: {
      box: "border-emerald-500/30 bg-emerald-500/[0.07]",
      icon: "✓",
      label: "text-emerald-300",
    },
    fail: {
      box: "border-red-500/30 bg-red-500/[0.07]",
      icon: "✗",
      label: "text-red-300",
    },
    running: {
      box: "border-amber-400/30 bg-amber-400/[0.06] animate-pulse",
      icon: "⋯",
      label: "text-amber-300",
    },
    pending: {
      box: "border-white/[0.08] bg-white/[0.02]",
      icon: "○",
      label: "text-neutral-500",
    },
  };
  const s = style[test.status];
  return (
    <div className={`flex gap-2.5 rounded-lg border p-3 ${s.box}`}>
      <span className={`mt-0.5 text-[15px] leading-none ${s.label}`}>{s.icon}</span>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-neutral-100">{test.name}</p>
        {test.detail && (
          <p className="mt-0.5 text-[12px] leading-snug text-neutral-400">
            {test.detail}
          </p>
        )}
      </div>
    </div>
  );
}

export interface StepCard {
  id: string;
  label: string;
  status: "running" | "done" | "fail" | "skipped" | "info";
  detail?: string;
  tone?: "green" | "red" | "amber" | "blue" | "gray";
}

/** Non-technical live view for Scrum / PR-Security: outcome cards. */
export function StepGrid({
  steps,
  running,
  emptyLabel,
}: {
  steps: StepCard[];
  running: boolean;
  emptyLabel?: string;
}) {
  if (steps.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-black/20 p-6 text-center text-[13px] text-neutral-400">
        {running ? (
          <span className="animate-pulse">{emptyLabel ?? "Working…"}</span>
        ) : (
          "Nothing yet."
        )}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {steps.map((s) => (
        <StepCardView key={s.id} step={s} />
      ))}
    </div>
  );
}

function StepCardView({ step }: { step: StepCard }) {
  const toneBox: Record<string, string> = {
    green: "border-emerald-500/30 bg-emerald-500/[0.07]",
    red: "border-red-500/30 bg-red-500/[0.07]",
    amber: "border-amber-400/30 bg-amber-400/[0.06]",
    blue: "border-sky-500/30 bg-sky-500/[0.07]",
    gray: "border-white/[0.08] bg-white/[0.02]",
  };
  const icon: Record<StepCard["status"], string> = {
    running: "⋯",
    done: "✓",
    fail: "✗",
    skipped: "—",
    info: "•",
  };
  const box =
    step.status === "running"
      ? "border-amber-400/30 bg-amber-400/[0.06] animate-pulse"
      : toneBox[step.tone ?? "gray"] ?? toneBox.gray;
  return (
    <div className={`flex gap-2.5 rounded-lg border p-3 ${box}`}>
      <span className="mt-0.5 text-[15px] leading-none text-neutral-200">
        {icon[step.status]}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-neutral-100">{step.label}</p>
        {step.detail && (
          <p className="mt-0.5 text-[12px] leading-snug text-neutral-400">{step.detail}</p>
        )}
      </div>
    </div>
  );
}

/** A live, auto-scrolling terminal that renders the agent run log with light styling. */
export function LogTerminal({ log, live }: { log: string; live?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (live && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log, live]);

  const lines = log.split("\n");
  return (
    <div
      ref={ref}
      className="max-h-[28rem] overflow-auto rounded-lg border border-white/[0.06] bg-black/50 p-3 font-mono text-[11.5px] leading-relaxed"
    >
      {log.trim() === "" ? (
        <span className="text-neutral-600">Waiting for the agent to start…</span>
      ) : (
        lines.map((l, i) => <LogLine key={i} line={l} />)
      )}
    </div>
  );
}

function LogLine({ line }: { line: string }) {
  const t = line.trimStart();
  if (t.startsWith("■"))
    return (
      <div className="mt-2 font-semibold text-amber-300">
        {line.replace(/^\s*■\s*/, "▸ ")}
      </div>
    );
  if (t.startsWith("▸")) return <div className="text-sky-300/90">{line}</div>;
  if (t.startsWith("⚙"))
    return <div className="text-emerald-300/90 whitespace-pre-wrap">{line}</div>;
  if (t.startsWith("→"))
    return <div className="text-neutral-500 whitespace-pre-wrap">{line}</div>;
  if (t.startsWith("✖"))
    return <div className="text-red-300 whitespace-pre-wrap">{line}</div>;
  return <div className="text-neutral-300 whitespace-pre-wrap">{line || " "}</div>;
}

/** Render the structured result of a finished run (all three agent types). */
export function ResultView({
  res,
  jira_ref,
  pr_ref,
}: {
  res: RunResult | null;
  jira_ref?: string | null;
  pr_ref?: string | null;
}) {
  if (!res) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {res.verdict && (
          <Badge tone={res.verdict === "pass" ? "green" : res.verdict === "fail" ? "red" : "gray"}>
            {res.verdict}
          </Badge>
        )}
        {res.severity && (
          <Badge tone={sevTone(res.severity)}>severity: {res.severity}</Badge>
        )}
        {jira_ref && (
          <span className="text-[11px] text-blue-300">→ posted to {jira_ref}</span>
        )}
        {pr_ref && (
          <span className="text-[11px] text-blue-300">
            → commented on PR #{pr_ref}
          </span>
        )}
      </div>

      {res.summary && <p className="text-[13px] text-neutral-200">{res.summary}</p>}
      {res.tests && <p className="text-[12px] text-neutral-400">{res.tests}</p>}
      {res.error && <p className="text-[12px] text-red-300">⚠ {res.error}</p>}

      {res.findings && res.findings.length > 0 && (
        <ul className="space-y-1.5">
          {res.findings.map((f, i) => (
            <li key={i} className="text-[12px] text-neutral-300">
              <span className="text-red-300">●</span> <b>{f.title}</b>
              {f.severity ? <> <Badge tone={sevTone(f.severity)}>{f.severity}</Badge></> : null}
              {f.location ? (
                <span className="text-neutral-500"> ({f.location})</span>
              ) : null}
              {f.detail ? <> — {f.detail}</> : null}
            </li>
          ))}
        </ul>
      )}

      {res.decisionsRecorded ? (
        <p className="text-[12px] text-sky-300">
          🗂 Recorded {res.decisionsRecorded} decision
          {res.decisionsRecorded === 1 ? "" : "s"} to the project&apos;s Decisions log.
        </p>
      ) : null}

      {res.updates && res.updates.length > 0 && (
        <div className="space-y-2">
          {res.updates.map((u, i) => (
            <div
              key={i}
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
            >
              <div className="flex items-center gap-2">
                <Badge tone="blue">{u.ticketKey}</Badge>
                {u.summary && (
                  <span className="text-[12px] text-neutral-300">{u.summary}</span>
                )}
              </div>
              {u.comment && (
                <pre className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-neutral-400">
                  {u.comment}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}

      {res.comment && !res.updates && (
        <details className="text-[12px]">
          <summary className="cursor-pointer text-neutral-500 hover:text-neutral-300">
            Posted comment
          </summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-black/30 p-3 leading-relaxed text-neutral-300">
            {res.comment}
          </pre>
        </details>
      )}
    </div>
  );
}
