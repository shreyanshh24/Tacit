"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession, Member } from "@/components/SessionProvider";

export default function SettingsPage() {
  const { team, member, project, isOwner, refresh } = useSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const isAdmin = member?.role === "Admin";

  const loadMembers = useCallback(async () => {
    if (!team) return;
    const res = await fetch(`/api/teams/${team.id}/members`);
    const data = await res.json();
    setMembers(data.members ?? []);
  }, [team]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  async function deleteMember(m: Member) {
    if (!team) return;
    const self = m.id === member?.id;
    if (!confirm(`Remove ${m.name}${self ? " (you)" : ""} from ${team.name}?`)) return;
    setBusy(`m${m.id}`);
    try {
      const res = await fetch(`/api/teams/${team.id}/members/${m.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) return alert(data.error || "Failed to remove member");
      if (self) {
        await refresh(); // dropped back to member picker
      } else {
        await loadMembers();
      }
    } finally {
      setBusy(null);
    }
  }

  async function deleteProject() {
    if (!project) return;
    if (!confirm(`Delete project "${project.name}" and all its memory? This cannot be undone.`)) return;
    setBusy("project");
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) return alert(data.error || "Failed to delete project");
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function deleteTeam() {
    if (!team) return;
    if (!confirm(`Delete the entire team "${team.name}"? This removes all members, projects and memory. This cannot be undone.`)) return;
    setBusy("team");
    try {
      const res = await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) return alert(data.error || "Failed to delete team");
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-20">
      <header className="mb-9">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
          <span className="tacit-dot h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span className="text-[11px] font-medium uppercase tracking-widest text-amber-300/90">
            Settings
          </span>
        </div>
        <h1 className="text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-white">
          Team &amp;{" "}
          <span className="bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
            members.
          </span>
        </h1>
        <p className="mt-3 text-[15px] text-neutral-400">
          {team?.name} · you are{" "}
          <span className="text-neutral-200">{member?.name}</span>{" "}
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-neutral-400">
            {member?.role ?? "Member"}
          </span>
        </p>
      </header>

      {/* Members */}
      <section className="mb-10">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-neutral-600">
          Members ({members.length})
        </p>
        <div className="space-y-2">
          {members.map((m) => {
            const self = m.id === member?.id;
            const canDelete = isAdmin || self;
            return (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-bold text-neutral-300">
                    {m.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-neutral-100">
                      {m.name} {self && <span className="text-[11px] text-neutral-500">(you)</span>}
                    </p>
                    <p className="text-[11px] text-neutral-500">{m.role ?? "Member"}</p>
                  </div>
                </div>
                {canDelete && (
                  <button
                    onClick={() => deleteMember(m)}
                    disabled={busy === `m${m.id}`}
                    className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {self ? "Leave" : "Remove"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Danger zone */}
      <section className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-5">
        <p className="mb-1 text-sm font-semibold text-red-300">Danger zone</p>
        <p className="mb-4 text-[13px] text-neutral-500">These actions are permanent.</p>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-200">Delete this project</p>
              <p className="text-[12px] text-neutral-500">
                {project?.name} — removes its memory, decisions and interviews.
              </p>
            </div>
            <button
              onClick={deleteProject}
              disabled={(!isOwner && !isAdmin) || busy === "project"}
              className="rounded-lg border border-red-500/25 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40"
              title={!isOwner && !isAdmin ? "Owner or Admin only" : ""}
            >
              {busy === "project" ? "Deleting…" : "Delete project"}
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-white/[0.06] pt-3">
            <div>
              <p className="text-sm text-neutral-200">Delete team</p>
              <p className="text-[12px] text-neutral-500">
                Removes {team?.name}, all members, projects and memory.
              </p>
            </div>
            <button
              onClick={deleteTeam}
              disabled={!isAdmin || busy === "team"}
              className="rounded-lg border border-red-500/25 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40"
              title={!isAdmin ? "Admin only" : ""}
            >
              {busy === "team" ? "Deleting…" : "Delete team"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
