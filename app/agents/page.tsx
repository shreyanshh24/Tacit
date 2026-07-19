"use client";

import { useEffect, useState } from "react";

type AgentType = "scrum" | "tester" | "pr_security";

interface RunResult {
  verdict?: string;
  severity?: string;
  summary?: string;
  tests?: string;
  comment?: string;
  error?: string;
  raw?: string;
  findings?: { title?: string; severity?: string; location?: string; detail?: string }[];
}

interface LastRun {
  id: number;
  status: string;
  started_at?: string;
  finished_at?: string;
  result: RunResult | null;
  jira_ref: string | null;
  pr_ref: string | null;
}

interface Agent {
  id: number;
  type: AgentType;
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  schedule_cron: string | null;
  last_run: LastRun | null;
}

const TYPE_LABEL: Record<AgentType, string> = {
  scrum: "Daily Scrum",
  tester: "Ticket Tester",
  pr_security: "PR Security Review",
};

const TYPE_DESC: Record<AgentType, string> = {
  scrum: "Reads a standup transcript, checks the repo, and comments progress on a Jira ticket — daily.",
  tester: "Clones a branch, runs the ticket's tests, and posts a pass/fail verdict to Jira.",
  pr_security: "Reviews a PR's diff for vulnerabilities and posts a security report on the PR.",
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [logs, setLogs] = useState<Record<number, string>>({});

  async function load() {
    setLoading(true);
    const r = await fetch("/api/agents").then((x) => x.json());
    setAgents(r.agents ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function runNow(id: number) {
    setRunningId(id);
    try {
      const r = await fetch(`/api/agents/${id}/run`, { method: "POST" }).then((x) => x.json());
      if (r.run?.log) setLogs((l) => ({ ...l, [id]: r.run.log }));
      await load();
    } catch (e) {
      alert("Run failed: " + (e as Error).message);
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Agents</h1>
          <p className="text-xs text-neutral-500">
            Autonomous agents run locally via <code>claude -p</code> with repo + Jira access.
          </p>
        </div>
        <button
          onClick={() => setShowNew((s) => !s)}
          className="rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-medium text-[#0a0a0c]"
        >
          {showNew ? "Close" : "+ New agent"}
        </button>
      </div>

      {showNew && <NewAgentForm onCreated={() => { setShowNew(false); load(); }} />}

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : agents.length === 0 ? (
          <p className="text-sm text-neutral-500">No agents yet. Create one to get started.</p>
        ) : (
          agents.map((a) => (
            <AgentCard
              key={a.id}
              agent={a}
              running={runningId === a.id}
              log={logs[a.id]}
              onRun={() => runNow(a.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function AgentCard({
  agent,
  running,
  log,
  onRun,
}: {
  agent: Agent;
  running: boolean;
  log?: string;
  onRun: () => void;
}) {
  const [showLog, setShowLog] = useState(false);
  const run = agent.last_run;
  const res = run?.result;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-amber-400/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
              {TYPE_LABEL[agent.type]}
            </span>
            <span className="text-sm font-medium text-white">{agent.name}</span>
            {agent.schedule_cron && (
              <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-400">
                ⏱ {agent.schedule_cron}
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] text-neutral-500">
            {Object.entries(agent.config)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ") || TYPE_DESC[agent.type]}
          </p>
        </div>
        <button
          onClick={onRun}
          disabled={running}
          className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-200 hover:bg-white/5 disabled:opacity-50"
        >
          {running ? "Running…" : "Run now"}
        </button>
      </div>

      {running && (
        <p className="mt-3 animate-pulse text-[12px] text-amber-300/80">
          Agent working — cloning, exploring, running… this can take a minute.
        </p>
      )}

      {run && !running && (
        <div className="mt-3 rounded-lg border border-white/[0.05] bg-black/20 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={run.status} />
            {res?.verdict && <Badge tone={res.verdict === "pass" ? "green" : "red"}>{res.verdict}</Badge>}
            {res?.severity && (
              <Badge tone={sevTone(res.severity)}>severity: {res.severity}</Badge>
            )}
            {run.jira_ref && <span className="text-[11px] text-blue-300">→ posted to {run.jira_ref}</span>}
            {run.pr_ref && <span className="text-[11px] text-blue-300">→ commented on PR #{run.pr_ref}</span>}
          </div>
          {res?.summary && <p className="mt-2 text-[13px] text-neutral-200">{res.summary}</p>}
          {res?.tests && <p className="mt-1 text-[12px] text-neutral-400">{res.tests}</p>}
          {res?.error && <p className="mt-2 text-[12px] text-red-300">⚠ {res.error}</p>}
          {res?.findings && res.findings.length > 0 && (
            <ul className="mt-2 space-y-1">
              {res.findings.map((f, i) => (
                <li key={i} className="text-[12px] text-neutral-300">
                  <span className="text-red-300">●</span> <b>{f.title}</b>
                  {f.location ? <span className="text-neutral-500"> ({f.location})</span> : null}
                  {f.detail ? <> — {f.detail}</> : null}
                </li>
              ))}
            </ul>
          )}
          {(log || res) && (
            <button
              onClick={() => setShowLog((s) => !s)}
              className="mt-2 text-[11px] text-neutral-500 hover:text-neutral-300"
            >
              {showLog ? "Hide" : "Show"} run log
            </button>
          )}
          {showLog && log && (
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-black/40 p-2 text-[11px] leading-relaxed text-neutral-400">
              {log}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function NewAgentForm({ onCreated }: { onCreated: () => void }) {
  const [type, setType] = useState<AgentType>("tester");
  const [saving, setSaving] = useState(false);
  // shared config fields
  const [ticketKey, setTicketKey] = useState("CRM360-22");
  const [branch, setBranch] = useState("feature/contacts-api");
  const [cron, setCron] = useState("0 9 * * *");
  const [prNumber, setPrNumber] = useState<string>("");
  const [prs, setPrs] = useState<{ number: number; title: string }[]>([]);
  const [transcripts, setTranscripts] = useState<{ name: string }[]>([]);
  const [transcriptName, setTranscriptName] = useState("");
  const [pasteText, setPasteText] = useState("");

  useEffect(() => {
    fetch("/api/github/prs")
      .then((r) => r.json())
      .then((d) => {
        setPrs(d.prs ?? []);
        if (d.prs?.[0]) setPrNumber(String(d.prs[0].number));
      });
    fetch("/api/transcripts")
      .then((r) => r.json())
      .then((d) => {
        setTranscripts(d.transcripts ?? []);
        if (d.transcripts?.[0]) setTranscriptName(d.transcripts[0].name);
      });
  }, []);

  async function uploadTranscript() {
    if (!pasteText.trim()) return;
    const r = await fetch("/api/transcripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `standup-${Date.now()}`, text: pasteText }),
    }).then((x) => x.json());
    if (r.name) {
      setTranscripts((t) => [{ name: r.name }, ...t]);
      setTranscriptName(r.name);
      setPasteText("");
    }
  }

  async function create() {
    setSaving(true);
    const config: Record<string, unknown> =
      type === "tester"
        ? { branch, ticketKey }
        : type === "pr_security"
          ? { prNumber: Number(prNumber) }
          : { ticketKey, transcriptName, branch: "main" };
    const body: Record<string, unknown> = { type, config };
    if (type === "scrum" && cron) body.schedule_cron = cron;
    await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    onCreated();
  }

  return (
    <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex gap-2">
        {(["tester", "pr_security", "scrum"] as AgentType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-lg px-3 py-1.5 text-xs ${
              type === t ? "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30" : "bg-white/[0.03] text-neutral-400"
            }`}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-neutral-500">{TYPE_DESC[type]}</p>

      <div className="mt-3 space-y-2">
        {type === "tester" && (
          <>
            <Field label="Branch">
              <input value={branch} onChange={(e) => setBranch(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Jira ticket">
              <input value={ticketKey} onChange={(e) => setTicketKey(e.target.value)} className={inputCls} />
            </Field>
          </>
        )}
        {type === "pr_security" && (
          <Field label="Pull request">
            <select value={prNumber} onChange={(e) => setPrNumber(e.target.value)} className={inputCls}>
              {prs.length === 0 && <option value="">No open PRs found</option>}
              {prs.map((p) => (
                <option key={p.number} value={p.number}>
                  #{p.number} — {p.title}
                </option>
              ))}
            </select>
          </Field>
        )}
        {type === "scrum" && (
          <>
            <Field label="Jira ticket">
              <input value={ticketKey} onChange={(e) => setTicketKey(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Transcript">
              <select value={transcriptName} onChange={(e) => setTranscriptName(e.target.value)} className={inputCls}>
                {transcripts.length === 0 && <option value="">No transcripts — paste one below</option>}
                {transcripts.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={3}
                placeholder="…or paste a standup transcript and click Upload"
                className={inputCls}
              />
              <button onClick={uploadTranscript} className="mt-1 rounded-md bg-white/5 px-2 py-1 text-[11px] text-neutral-300">
                Upload transcript
              </button>
            </div>
            <Field label="Schedule (cron)">
              <input value={cron} onChange={(e) => setCron(e.target.value)} className={inputCls} placeholder="0 9 * * *" />
            </Field>
          </>
        )}
      </div>

      <button
        onClick={create}
        disabled={saving}
        className="mt-3 rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-[#0a0a0c] disabled:opacity-50"
      >
        {saving ? "Creating…" : "Create agent"}
      </button>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-neutral-100 focus:border-amber-400/40 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "done" ? "green" : status === "failed" ? "red" : "amber";
  return <Badge tone={tone as Tone}>{status}</Badge>;
}

type Tone = "green" | "red" | "amber" | "blue" | "gray";
function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const map: Record<Tone, string> = {
    green: "bg-emerald-500/15 text-emerald-300",
    red: "bg-red-500/15 text-red-300",
    amber: "bg-amber-500/15 text-amber-300",
    blue: "bg-blue-500/15 text-blue-300",
    gray: "bg-white/5 text-neutral-400",
  };
  return <span className={`rounded px-1.5 py-0.5 text-[10px] ${map[tone]}`}>{children}</span>;
}

function sevTone(sev: string): Tone {
  if (sev === "critical" || sev === "high") return "red";
  if (sev === "medium") return "amber";
  if (sev === "low") return "blue";
  return "gray";
}
