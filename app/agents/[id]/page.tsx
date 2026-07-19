"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AgentType,
  TYPE_LABEL,
  TYPE_DESC,
  StatusBadge,
  LogTerminal,
  ResultView,
  RunResult,
  TestGrid,
  TestCase,
  currentPhase,
} from "@/components/agentUi";

interface RunSummary {
  id: number;
  status: string;
  trigger?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  result: RunResult | null;
  jira_ref?: string | null;
  pr_ref?: string | null;
}
interface RunFull extends RunSummary {
  log: string;
  tests?: TestCase[];
}
interface AgentDetail {
  id: number;
  type: AgentType;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  schedule_cron: string | null;
}

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const id = Number(params.id);

  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [run, setRun] = useState<RunFull | null>(null);
  const [starting, setStarting] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const autoStarted = useRef(false);

  const loadAgent = useCallback(async () => {
    const d = await fetch(`/api/agents/${id}`).then((r) => r.json());
    if (d.agent) setAgent(d.agent);
    if (d.runs) setRuns(d.runs);
    return d;
  }, [id]);

  const start = useCallback(async () => {
    setStarting(true);
    try {
      const d = await fetch(`/api/agents/${id}/run`, { method: "POST" }).then((r) =>
        r.json()
      );
      if (d.runId) {
        setActiveRunId(d.runId);
        setRun(null);
      } else if (d.error) {
        alert("Run failed: " + d.error);
      }
    } finally {
      setStarting(false);
      await loadAgent();
    }
  }, [id, loadAgent]);

  // Initial load + optional auto-start (when arriving via "Run now").
  useEffect(() => {
    (async () => {
      const d = await loadAgent();
      if (search.get("run") === "1" && !autoStarted.current) {
        autoStarted.current = true;
        router.replace(`/agents/${id}`);
        await start();
      } else {
        const list: RunSummary[] = d.runs || [];
        const running = list.find((r) => r.status === "running");
        setActiveRunId((running ?? list[0])?.id ?? null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll the active run's full log while it streams.
  useEffect(() => {
    if (activeRunId == null) return;
    let stop = false;
    let t: ReturnType<typeof setTimeout>;
    const loop = async () => {
      const d = await fetch(`/api/agents/${id}/runs/${activeRunId}`)
        .then((r) => r.json())
        .catch(() => null);
      if (stop) return;
      if (d?.run) {
        setRun(d.run);
        if (d.run.status !== "running") {
          await loadAgent();
          return;
        }
      }
      t = setTimeout(loop, 800);
    };
    loop();
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [activeRunId, id, loadAgent]);

  // Idle detection: pick up a watcher-triggered run while sitting on the page.
  useEffect(() => {
    const iv = setInterval(async () => {
      if (run?.status === "running") return;
      const d = await fetch(`/api/agents/${id}`)
        .then((r) => r.json())
        .catch(() => null);
      if (!d?.runs) return;
      setRuns(d.runs);
      const running = d.runs.find((r: RunSummary) => r.status === "running");
      if (running && running.id !== activeRunId) setActiveRunId(running.id);
    }, 3000);
    return () => clearInterval(iv);
  }, [id, run?.status, activeRunId]);

  if (!agent) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-8 text-sm text-neutral-500">
        Loading…
      </div>
    );
  }

  const isRunning = run?.status === "running" || starting;
  const configStr = Object.entries(agent.config)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <Link href="/agents" className="text-[12px] text-neutral-500 hover:text-neutral-300">
        ← Agents
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-amber-400/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
              {TYPE_LABEL[agent.type]}
            </span>
            <h1 className="text-lg font-semibold text-white">{agent.name}</h1>
          </div>
          <p className="mt-1 text-[12px] text-neutral-500">{configStr || TYPE_DESC[agent.type]}</p>
          {agent.type === "pr_security" && (
            <p className="mt-1 text-[11px] text-sky-300/80">
              👀 Watching branch{" "}
              <b>{String(agent.config.baseBranch || agent.config.branch || "main")}</b> — any new PR
              targeting it is reviewed automatically.
            </p>
          )}
          {agent.schedule_cron && (
            <p className="mt-1 text-[11px] text-neutral-500">⏱ schedule: {agent.schedule_cron}</p>
          )}
        </div>
        <button
          onClick={start}
          disabled={isRunning}
          className="shrink-0 rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-[#0a0a0c] disabled:opacity-50"
        >
          {isRunning ? "Running…" : "Run now"}
        </button>
      </div>

      {/* Live run panel */}
      <div className="mt-6">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-medium text-neutral-200">
            {run ? (run.status === "running" ? "Live run" : `Run #${run.id}`) : "Run"}
          </h2>
          {run && <StatusBadge status={run.status} />}
          {run?.status === "running" && (
            <span className="animate-pulse text-[11px] text-amber-300/80">working…</span>
          )}
        </div>

        {/* Friendly "what's happening now" banner */}
        {run && run.status === "running" && currentPhase(run.log || "") && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-[13px] text-amber-200">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            {currentPhase(run.log || "")}…
          </div>
        )}

        {agent.type === "tester" ? (
          run ? (
            <>
              <TestGrid tests={run.tests || []} running={run.status === "running"} />
              <button
                onClick={() => setShowLog((s) => !s)}
                className="mt-3 text-[11px] text-neutral-500 hover:text-neutral-300"
              >
                {showLog ? "Hide" : "Show"} technical log
              </button>
              {showLog && (
                <div className="mt-2">
                  <LogTerminal log={run.log || ""} live={run.status === "running"} />
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-white/[0.06] bg-black/30 p-6 text-center text-[13px] text-neutral-400">
              {isRunning
                ? "Starting the agent…"
                : "Click Run now — you'll watch each test appear and turn green or red."}
            </div>
          )
        ) : run ? (
          <LogTerminal log={run.log || ""} live={run.status === "running"} />
        ) : (
          <div className="rounded-lg border border-white/[0.06] bg-black/30 p-6 text-center text-[12px] text-neutral-500">
            {isRunning ? "Starting the agent…" : "Click Run now to start a run and watch it live."}
          </div>
        )}

        {run?.result && (
          <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <h3 className="mb-2 text-[12px] font-medium text-neutral-300">Result</h3>
            <ResultView res={run.result} jira_ref={run.jira_ref} pr_ref={run.pr_ref} />
          </div>
        )}
      </div>

      {/* History */}
      {runs.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-medium text-neutral-200">History</h2>
          <div className="space-y-1.5">
            {runs.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveRunId(r.id)}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12px] ${
                  r.id === activeRunId
                    ? "border-amber-400/30 bg-amber-400/[0.06]"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                <span className="text-neutral-500">#{r.id}</span>
                <StatusBadge status={r.status} />
                {r.trigger && <span className="text-neutral-600">{r.trigger}</span>}
                <span className="ml-auto text-neutral-500">
                  {r.jira_ref ? `→ ${r.jira_ref}` : r.pr_ref ? `→ PR #${r.pr_ref}` : ""}
                </span>
                <span className="text-neutral-600">{r.finished_at || r.started_at || ""}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
