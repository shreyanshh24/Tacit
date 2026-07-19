"use client";

import { useEffect, useState } from "react";
import { useSession } from "./SessionProvider";

interface ProjectLite {
  id: number;
  name: string;
  jira_project_key: string | null;
}

export default function ProjectSwitcher() {
  const { project, setSession } = useSession();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const d = await fetch("/api/projects").then((r) => r.json());
    setProjects(d.projects ?? []);
  }
  useEffect(() => {
    if (open) load();
  }, [open]);

  async function switchTo(id: number) {
    if (id === project?.id) {
      setOpen(false);
      return;
    }
    setOpen(false);
    await setSession({ projectId: id });
  }

  async function newProject() {
    const name = window.prompt("New project name");
    if (!name?.trim()) return;
    setBusy(true);
    const d = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    }).then((r) => r.json());
    setBusy(false);
    setOpen(false);
    if (d.project?.id) await setSession({ projectId: d.project.id });
  }

  async function loadSample() {
    setBusy(true);
    const d = await fetch("/api/projects/sample", { method: "POST" }).then((r) => r.json());
    setBusy(false);
    setOpen(false);
    const id = d.project?.id ?? d.projectId;
    if (id) await setSession({ projectId: id });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 truncate font-medium text-neutral-200 hover:text-amber-300"
        title="Switch project"
      >
        {project?.name ?? "Select project"}
        <span className={`text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-8 z-20 w-64 overflow-hidden rounded-xl border border-white/10 bg-[#0d0d10] shadow-2xl">
            <p className="border-b border-white/[0.06] px-3 py-2 text-[10px] uppercase tracking-widest text-neutral-500">
              Projects
            </p>
            <div className="max-h-64 overflow-y-auto py-1">
              {projects.length === 0 && (
                <p className="px-3 py-2 text-[12px] text-neutral-500">Loading…</p>
              )}
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => switchTo(p.id)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/5 ${
                    p.id === project?.id ? "text-amber-300" : "text-neutral-200"
                  }`}
                >
                  <span className="truncate">{p.name}</span>
                  <span className="ml-2 flex shrink-0 items-center gap-1">
                    {p.jira_project_key && (
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-400">
                        {p.jira_project_key}
                      </span>
                    )}
                    {p.id === project?.id && <span className="text-amber-400">✓</span>}
                  </span>
                </button>
              ))}
            </div>
            <div className="border-t border-white/[0.06]">
              <button
                onClick={newProject}
                disabled={busy}
                className="block w-full px-3 py-2 text-left text-sm text-neutral-300 hover:bg-white/5 disabled:opacity-50"
              >
                + New project
              </button>
              <button
                onClick={loadSample}
                disabled={busy}
                className="block w-full px-3 py-2 text-left text-sm text-neutral-300 hover:bg-white/5 disabled:opacity-50"
              >
                ✦ Load NimbusPay sample
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
