"use client";

import { useCallback, useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { useSession, Team, Member, Project } from "./SessionProvider";

export default function LoginGate({ children }: { children: React.ReactNode }) {
  const { loading, team, member, project, setSession, refresh } = useSession();

  if (loading) {
    return <Splash label="Loading Tacit…" />;
  }

  if (!team) {
    return (
      <AuthShell
        step={1}
        title="Sign in to your workspace"
        subtitle="Pick your team, or create a new one."
      >
        <TeamStep onPick={(t) => setSession({ teamId: t.id, memberId: null, projectId: null })} />
      </AuthShell>
    );
  }

  if (!member) {
    return (
      <AuthShell
        step={2}
        title={`Who's signing in to ${team.name}?`}
        subtitle="Choose your member profile so your activity is attributed to you."
        onBack={() => setSession({ teamId: null, memberId: null, projectId: null })}
      >
        <MemberStep team={team} onPick={(m) => setSession({ memberId: m.id })} />
      </AuthShell>
    );
  }

  if (!project) {
    return (
      <AuthShell
        step={3}
        title="Open a project"
        subtitle="Projects hold your memory. Create one (you'll own it and connect Jira) or open an existing one."
        onBack={() => setSession({ memberId: null })}
      >
        <ProjectStep onPick={(p) => setSession({ projectId: p.id })} onCreated={refresh} />
      </AuthShell>
    );
  }

  // Fully authenticated — render the app shell.
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

/* ----------------------------- shared UI ------------------------------ */

function Splash({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex items-center gap-3 text-neutral-500">
        <span className="flex gap-1">
          <span className="tacit-dot h-2 w-2 rounded-full bg-amber-400" style={{ animationDelay: "0ms" }} />
          <span className="tacit-dot h-2 w-2 rounded-full bg-amber-400" style={{ animationDelay: "200ms" }} />
          <span className="tacit-dot h-2 w-2 rounded-full bg-amber-400" style={{ animationDelay: "400ms" }} />
        </span>
        {label}
      </div>
    </div>
  );
}

function AuthShell({
  step,
  title,
  subtitle,
  onBack,
  children,
}: {
  step: number;
  title: string;
  subtitle: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md tacit-fade">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-amber-300 to-amber-500 shadow-lg shadow-amber-500/20">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-3 w-3 rounded-full bg-[#08080a]" />
            </div>
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight text-white">Tacit</div>
            <div className="text-[11px] text-neutral-500">A company that never forgets.</div>
          </div>
        </div>

        <div className="mb-1 flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <span
              key={s}
              className={`h-1 flex-1 rounded-full ${s <= step ? "bg-amber-400" : "bg-white/10"}`}
            />
          ))}
        </div>
        <p className="mb-5 text-[11px] uppercase tracking-widest text-neutral-600">Step {step} of 3</p>

        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-1.5 text-sm text-neutral-400">{subtitle}</p>

        <div className="mt-6">{children}</div>

        {onBack && (
          <button onClick={onBack} className="mt-5 text-xs text-neutral-500 hover:text-amber-300">
            ‹ Back
          </button>
        )}
      </div>
    </div>
  );
}

function PickList<T extends { id: number; name: string }>({
  items,
  onPick,
  emptyLabel,
  subtitleFor,
}: {
  items: T[];
  onPick: (item: T) => void;
  emptyLabel: string;
  subtitleFor?: (item: T) => string | null;
}) {
  if (items.length === 0) {
    return <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-neutral-500">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onPick(item)}
          className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-amber-400/40 hover:bg-amber-400/[0.05]"
        >
          <span>
            <span className="block text-sm font-medium text-neutral-100">{item.name}</span>
            {subtitleFor && subtitleFor(item) && (
              <span className="block text-[11px] text-neutral-500">{subtitleFor(item)}</span>
            )}
          </span>
          <span className="text-neutral-600">›</span>
        </button>
      ))}
    </div>
  );
}

function CreateRow({
  placeholder,
  onCreate,
}: {
  placeholder: string;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await onCreate(name.trim());
      setName("");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 flex gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && go()}
        placeholder={placeholder}
        className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-amber-400/40"
      />
      <button
        onClick={go}
        disabled={!name.trim() || busy}
        className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-[#0a0a0c] transition-opacity hover:bg-amber-300 disabled:opacity-40"
      >
        {busy ? "…" : "Create"}
      </button>
    </div>
  );
}

/* ------------------------------ steps -------------------------------- */

function TeamStep({ onPick }: { onPick: (t: Team) => void }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const load = useCallback(async () => {
    const res = await fetch("/api/teams");
    const data = await res.json();
    setTeams(data.teams ?? []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PickList items={teams} onPick={onPick} emptyLabel="No teams yet — create the first one below." />
      <CreateRow
        placeholder="New team name (e.g. NimbusPay)"
        onCreate={async (name) => {
          const res = await fetch("/api/teams", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          });
          const data = await res.json();
          if (data.team) onPick(data.team);
        }}
      />
    </>
  );
}

const ROLES = ["Admin", "Product Manager", "Engineer", "Designer", "Stakeholder"];

function MemberStep({ team, onPick }: { team: Team; onPick: (m: Member) => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Engineer");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const res = await fetch(`/api/teams/${team.id}/members`);
    const data = await res.json();
    setMembers(data.members ?? []);
  }, [team.id]);
  useEffect(() => {
    load();
  }, [load]);

  const isFirst = members.length === 0;

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/teams/${team.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), role }),
      });
      const data = await res.json();
      if (data.member) onPick(data.member);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PickList
        items={members}
        onPick={onPick}
        emptyLabel="No members yet — add yourself below."
        subtitleFor={(m) => (m as Member).role ?? null}
      />
      <div className="mt-4 space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="Your name"
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-amber-400/40"
        />
        <div className="flex gap-2">
          <select
            value={isFirst ? "Admin" : role}
            onChange={(e) => setRole(e.target.value)}
            disabled={isFirst}
            className="flex-1 rounded-lg border border-white/10 bg-[#0d0d10] px-3 py-2 text-sm text-white outline-none focus:border-amber-400/40 disabled:opacity-60"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            onClick={create}
            disabled={!name.trim() || busy}
            className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-[#0a0a0c] transition-opacity hover:bg-amber-300 disabled:opacity-40"
          >
            {busy ? "…" : "Add"}
          </button>
        </div>
        {isFirst && (
          <p className="text-[11px] text-neutral-600">
            The first member becomes the team Admin.
          </p>
        )}
      </div>
    </>
  );
}

function ProjectStep({
  onPick,
  onCreated,
}: {
  onPick: (p: Project) => void;
  onCreated: () => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingSample, setLoadingSample] = useState(false);
  const load = useCallback(async () => {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(data.projects ?? []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function loadSample() {
    if (loadingSample) return;
    setLoadingSample(true);
    try {
      const res = await fetch("/api/projects/sample", { method: "POST" });
      const data = await res.json();
      if (data.project) {
        onCreated(); // refresh session (endpoint already set projectId)
        onPick(data.project);
      }
    } finally {
      setLoadingSample(false);
    }
  }

  return (
    <>
      <PickList
        items={projects}
        onPick={onPick}
        emptyLabel="No projects yet — create one below, or load the sample."
        subtitleFor={(p) => (p.jira_project_key ? `Jira: ${p.jira_project_key}` : "Not connected to Jira")}
      />
      <CreateRow
        placeholder="New project name"
        onCreate={async (name) => {
          const res = await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          });
          const data = await res.json();
          onCreated();
          if (data.project) onPick(data.project);
        }}
      />
      <button
        onClick={loadSample}
        disabled={loadingSample}
        className="mt-4 w-full rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-2.5 text-sm text-amber-200 transition-colors hover:bg-amber-400/[0.12] disabled:opacity-50"
      >
        {loadingSample ? "Loading sample (embedding + extracting)…" : "✦ Load NimbusPay sample project"}
      </button>
      <p className="mt-2 text-[11px] text-neutral-600">
        The sample is a self-contained demo dataset. New projects start empty and fill from
        your Jira imports and captured docs.
      </p>
    </>
  );
}
