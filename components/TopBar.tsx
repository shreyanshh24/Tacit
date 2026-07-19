"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "./SessionProvider";
import ProjectSwitcher from "./ProjectSwitcher";

const TOP_LINKS = [
  { href: "/jira", label: "Jira" },
  { href: "/decisions", label: "Decisions" },
  { href: "/activity", label: "Activity" },
  { href: "/settings", label: "Settings" },
];

export default function TopBar() {
  const { team, member, project, isOwner, setSession, logout } = useSession();
  const [menu, setMenu] = useState(false);
  const pathname = usePathname();

  const initials = (member?.name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#08080a]/80 px-6 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="truncate text-neutral-500">{team?.name}</span>
        <span className="text-neutral-700">/</span>
        <ProjectSwitcher />
        {isOwner && (
          <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
            owner
          </span>
        )}
        {project?.jira_project_key && (
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-neutral-400">
            Jira: {project.jira_project_key}
          </span>
        )}
      </div>

      <nav className="mr-2 hidden items-center gap-1 sm:flex">
        {TOP_LINKS.map((l) => {
          const active = pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
                active
                  ? "bg-white/[0.06] text-amber-300"
                  : "text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-200"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="relative">
        <button
          onClick={() => setMenu((m) => !m)}
          className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] py-1 pl-1 pr-3 transition-colors hover:border-amber-400/30"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold text-[#0a0a0c]">
            {initials}
          </span>
          <span className="text-sm text-neutral-200">{member?.name}</span>
          <span className={`text-neutral-500 transition-transform ${menu ? "rotate-180" : ""}`}>⌄</span>
        </button>

        {menu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
            <div className="absolute right-0 top-11 z-20 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#0d0d10] shadow-2xl">
              <div className="border-b border-white/[0.06] px-4 py-3">
                <p className="text-sm font-medium text-white">{member?.name}</p>
                <p className="text-[11px] text-neutral-500">
                  {member?.role ? `${member.role} · ` : ""}
                  {team?.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setMenu(false);
                  setSession({ memberId: null });
                }}
                className="block w-full px-4 py-2.5 text-left text-sm text-neutral-300 hover:bg-white/5"
              >
                Switch member
              </button>
              <button
                onClick={() => {
                  setMenu(false);
                  setSession({ projectId: null });
                }}
                className="block w-full px-4 py-2.5 text-left text-sm text-neutral-300 hover:bg-white/5"
              >
                Switch project
              </button>
              <button
                onClick={() => {
                  setMenu(false);
                  logout();
                }}
                className="block w-full border-t border-white/[0.06] px-4 py-2.5 text-left text-sm text-red-300 hover:bg-red-500/10"
              >
                Log out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
