"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AgentType,
  TYPE_LABEL,
  TYPE_DESC,
  StatusBadge,
  Badge,
  sevTone,
  RunResult,
} from "@/components/agentUi";

interface LastRun {
  id: number;
  status: string;
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

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/agents").then((x) => x.json());
    setAgents(r.agents ?? []);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

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

      {showNew && (
        <NewAgentForm
          onCreated={(newId) => {
            setShowNew(false);
            if (newId) router.push(`/agents/${newId}`);
            else load();
          }}
        />
      )}

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
              onOpen={() => router.push(`/agents/${a.id}`)}
              onRun={() =>
                router.push(
                  a.type === "scrum" ? `/agents/${a.id}` : `/agents/${a.id}?run=1`
                )
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

function AgentCard({
  agent,
  onOpen,
  onRun,
}: {
  agent: Agent;
  onOpen: () => void;
  onRun: () => void;
}) {
  const run = agent.last_run;
  const res = run?.result;
  const watchInfo =
    agent.type === "pr_security"
      ? `watching ${String(agent.config.baseBranch || agent.config.branch || "main")}`
      : "";

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <button onClick={onOpen} className="min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-amber-400/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
              {TYPE_LABEL[agent.type]}
            </span>
            <span className="text-sm font-medium text-white hover:underline">{agent.name}</span>
            {agent.schedule_cron && (
              <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-400">
                ⏱ {agent.schedule_cron}
              </span>
            )}
            {watchInfo && (
              <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-300">
                👀 {watchInfo}
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] text-neutral-500">
            {Object.entries(agent.config)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ") || TYPE_DESC[agent.type]}
          </p>
        </button>
        <button
          onClick={onRun}
          className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-200 hover:bg-white/5"
        >
          {agent.type === "scrum" ? "Open" : "Run now"}
        </button>
      </div>

      {run && (
        <button
          onClick={onOpen}
          className="mt-3 flex w-full flex-wrap items-center gap-2 rounded-lg border border-white/[0.05] bg-black/20 p-3 text-left"
        >
          <StatusBadge status={run.status} />
          {res?.verdict && (
            <Badge tone={res.verdict === "pass" ? "green" : res.verdict === "fail" ? "red" : "gray"}>
              {res.verdict}
            </Badge>
          )}
          {res?.severity && <Badge tone={sevTone(res.severity)}>severity: {res.severity}</Badge>}
          {run.jira_ref && <span className="text-[11px] text-blue-300">→ {run.jira_ref}</span>}
          {run.pr_ref && <span className="text-[11px] text-blue-300">→ PR #{run.pr_ref}</span>}
          {res?.summary && (
            <span className="w-full text-[12px] text-neutral-300">{res.summary}</span>
          )}
        </button>
      )}
    </div>
  );
}

function NewAgentForm({ onCreated }: { onCreated: (newId?: number) => void }) {
  const [type, setType] = useState<AgentType>("tester");
  const [saving, setSaving] = useState(false);
  const [ticketKey, setTicketKey] = useState("CRM360-22");
  const [branch, setBranch] = useState("feature/contacts-api");
  const [baseBranch, setBaseBranch] = useState("main");
  const [cron, setCron] = useState("0 9 * * *");
  const [folder, setFolder] = useState("data/crm360/01_Meeting_Transcripts");
  const [branches, setBranches] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/github/branches")
      .then((r) => r.json())
      .then((d) => setBranches(d.branches ?? []));
  }, []);

  async function create() {
    setSaving(true);
    const config: Record<string, unknown> =
      type === "tester"
        ? { branch, ticketKey }
        : type === "pr_security"
          ? { baseBranch }
          : { folder, branch: "main" };
    const body: Record<string, unknown> = { type, config };
    if (type === "scrum" && cron) body.schedule_cron = cron;
    const r = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((x) => x.json());
    setSaving(false);
    onCreated(r?.id);
  }

  return (
    <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex gap-2">
        {(["tester", "pr_security", "scrum"] as AgentType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-lg px-3 py-1.5 text-xs ${
              type === t
                ? "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30"
                : "bg-white/[0.03] text-neutral-400"
            }`}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-neutral-500">{TYPE_DESC[type]}</p>

      <datalist id="repo-branches">
        {branches.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>

      <div className="mt-3 space-y-2">
        {type === "tester" && (
          <>
            <Field label="Branch">
              <input
                list="repo-branches"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Jira ticket">
              <input value={ticketKey} onChange={(e) => setTicketKey(e.target.value)} className={inputCls} />
            </Field>
          </>
        )}
        {type === "pr_security" && (
          <Field label="Branch to watch (PRs targeting this branch get reviewed)">
            <input
              list="repo-branches"
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
              className={inputCls}
              placeholder="main"
            />
          </Field>
        )}
        {type === "scrum" && (
          <>
            <p className="text-[12px] text-neutral-500">
              Watches a folder of transcripts. A daily scan processes each new transcript in one
              run, auto-detecting the tickets it mentions (e.g. <code>CRM360-22</code>) and logging
              any decisions.
            </p>
            <Field label="Transcripts folder">
              <input
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className={inputCls}
                placeholder="data/crm360/01_Meeting_Transcripts"
              />
            </Field>
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
