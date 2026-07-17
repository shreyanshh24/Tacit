"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";

interface Tag {
  member_id: number;
  member_name: string | null;
  member_role: string | null;
}
interface TeamMember {
  id: number;
  name: string;
  role: string | null;
}
interface Activity {
  id: number;
  type: string;
  title: string | null;
  detail: string | null;
  ref: string | null;
  member_name: string | null;
  comment_count: number;
  created_at: string;
  tags: Tag[];
}

interface Comment {
  id: number;
  body: string;
  member_name: string | null;
  created_at: string;
}

const TYPE_META: Record<string, { label: string; cls: string }> = {
  memory: { label: "Memory", cls: "bg-sky-400/15 text-sky-300" },
  assumptions: { label: "Assumptions", cls: "bg-amber-400/15 text-amber-300" },
  foresight: { label: "Foresight", cls: "bg-fuchsia-400/15 text-fuchsia-300" },
  interview: { label: "Interview", cls: "bg-emerald-400/15 text-emerald-300" },
  jira_import: { label: "Jira", cls: "bg-blue-400/15 text-blue-300" },
  capture: { label: "Capture", cls: "bg-teal-400/15 text-teal-300" },
};

function timeAgo(iso: string): string {
  const then = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function ActivityPage() {
  const { team } = useSession();
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/activities");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load activity");
      setActivities(data.activities);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!team) return;
    fetch(`/api/teams/${team.id}/members`)
      .then((r) => r.json())
      .then((d) => setTeamMembers(d.members ?? []))
      .catch(() => {});
  }, [team]);

  return (
    <div className="mx-auto max-w-3xl px-8 py-20">
      <header className="mb-9">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1">
          <span className="tacit-dot h-1.5 w-1.5 rounded-full bg-amber-400" />
          <span className="text-[11px] font-medium uppercase tracking-widest text-amber-300/90">
            Activity
          </span>
        </div>
        <h1 className="text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-white">
          What the team is{" "}
          <span className="bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
            doing.
          </span>
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-neutral-400">
          Every question, pre-mortem, and captured interview — attributed to who did it.
          Comment on anything to add context.
        </p>
      </header>

      {error && <p className="text-sm text-red-300">{error}</p>}
      {activities && activities.length === 0 && (
        <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-6 text-sm text-neutral-500">
          No activity yet. Ask a question in Memory, run a Foresight pre-mortem, or answer an
          interview — it&apos;ll show up here.
        </p>
      )}

      <div className="space-y-3">
        {activities?.map((a) => (
          <ActivityCard key={a.id} activity={a} teamMembers={teamMembers} />
        ))}
      </div>
    </div>
  );
}

function ActivityCard({
  activity,
  teamMembers,
}: {
  activity: Activity;
  teamMembers: TeamMember[];
}) {
  const { member } = useSession();
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [count, setCount] = useState(activity.comment_count);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [tags, setTags] = useState<Tag[]>(activity.tags ?? []);
  const [tagOpen, setTagOpen] = useState(false);

  async function toggleTag(m: TeamMember) {
    const tagged = tags.some((t) => t.member_id === m.id);
    const res = await fetch(`/api/activities/${activity.id}/tags`, {
      method: tagged ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: m.id }),
    });
    const data = await res.json();
    if (data.tags) setTags(data.tags);
  }

  const meta = TYPE_META[activity.type] ?? { label: activity.type, cls: "bg-white/10 text-neutral-300" };

  const loadComments = useCallback(async () => {
    const res = await fetch(`/api/activities/${activity.id}/comments`);
    const data = await res.json();
    setComments(data.comments ?? []);
  }, [activity.id]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && comments === null) await loadComments();
  }

  async function submit() {
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/activities/${activity.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.comment) {
        setComments((c) => [...(c ?? []), data.comment]);
        setCount((n) => n + 1);
        setDraft("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-bold text-neutral-300">
          {(activity.member_name ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-neutral-100">
              {activity.member_name ?? "Unknown"}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.cls}`}>
              {meta.label}
            </span>
            <span className="text-[11px] text-neutral-600">{timeAgo(activity.created_at)}</span>
          </div>
          {activity.title && (
            <p className="mt-1 text-sm text-neutral-300">{activity.title}</p>
          )}
          {activity.detail && (
            <p className="mt-0.5 text-[13px] text-neutral-500">{activity.detail}</p>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {tags.map((t) => (
              <span
                key={t.member_id}
                className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-200"
              >
                @{t.member_name}
                {t.member_role ? ` · ${t.member_role}` : ""}
              </span>
            ))}
            <div className="relative">
              <button
                onClick={() => setTagOpen((o) => !o)}
                className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-neutral-400 hover:border-amber-400/40 hover:text-amber-300"
              >
                ＋ Tag
              </button>
              {tagOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setTagOpen(false)} />
                  <div className="absolute left-0 top-7 z-20 max-h-56 w-56 overflow-y-auto rounded-lg border border-white/10 bg-[#0d0d10] p-1 shadow-2xl">
                    {teamMembers.length === 0 && (
                      <p className="px-2 py-1.5 text-[12px] text-neutral-500">No members</p>
                    )}
                    {teamMembers.map((m) => {
                      const on = tags.some((t) => t.member_id === m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => toggleTag(m)}
                          className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[13px] text-neutral-300 hover:bg-white/5"
                        >
                          <span>
                            {m.name}{" "}
                            <span className="text-[11px] text-neutral-500">{m.role}</span>
                          </span>
                          {on && <span className="text-amber-400">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          <button
            onClick={toggle}
            className="mt-2.5 text-xs text-neutral-500 hover:text-amber-300"
          >
            {count > 0 ? `${count} comment${count === 1 ? "" : "s"}` : "Add a comment"}
            <span className={`ml-1 inline-block transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
          </button>

          {open && (
            <div className="mt-3 space-y-3 border-t border-white/[0.06] pt-3">
              {comments?.map((c) => (
                <div key={c.id} className="flex gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-[10px] font-bold text-amber-300">
                    {(c.member_name ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                  <div>
                    <p className="text-[13px]">
                      <span className="font-medium text-neutral-200">{c.member_name ?? "Unknown"}</span>{" "}
                      <span className="text-[11px] text-neutral-600">{timeAgo(c.created_at)}</span>
                    </p>
                    <p className="text-[13px] text-neutral-400">{c.body}</p>
                  </div>
                </div>
              ))}

              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder={`Comment as ${member?.name ?? "you"}…`}
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white placeholder:text-neutral-600 outline-none focus:border-amber-400/40"
                />
                <button
                  onClick={submit}
                  disabled={!draft.trim() || busy}
                  className="rounded-lg bg-amber-400 px-3 py-2 text-[13px] font-semibold text-[#0a0a0c] transition-opacity hover:bg-amber-300 disabled:opacity-40"
                >
                  Post
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
