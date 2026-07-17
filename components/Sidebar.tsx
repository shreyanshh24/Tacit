"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Memory", desc: "Ask about any decision", icon: MemoryIcon },
  { href: "/assumptions", label: "Assumptions", desc: "Surface hidden bets", icon: AssumptionsIcon },
  { href: "/foresight", label: "Foresight", desc: "Grounded pre-mortems", icon: ForesightIcon },
  { href: "/interviewer", label: "Interviewer", desc: "Capture what's unwritten", icon: InterviewerIcon },
  { href: "/capture", label: "Capture", desc: "Upload docs & link tickets", icon: CaptureIcon },
  { href: "/decisions", label: "Decisions", desc: "Extracted decision log", icon: DecisionsIcon },
  { href: "/activity", label: "Activity", desc: "Team feed & comments", icon: ActivityIcon },
  { href: "/settings", label: "Settings", desc: "Members, roles & danger zone", icon: SettingsIcon },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[#0a0a0c]/80 px-3.5 py-6 backdrop-blur-xl">
      <div className="px-3 mb-9">
        <div className="flex items-center gap-2.5">
          <div className="relative h-7 w-7 rounded-lg bg-gradient-to-br from-amber-300 to-amber-500 shadow-lg shadow-amber-500/20">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-2.5 w-2.5 rounded-full bg-[#0a0a0c]" />
            </div>
          </div>
          <span className="text-[19px] font-semibold tracking-tight text-white">Tacit</span>
        </div>
        <p className="mt-2 text-[11px] leading-tight text-neutral-500">
          A company that never forgets.
        </p>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, desc, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`group relative rounded-xl px-3 py-2.5 transition-all duration-200 ${
                active
                  ? "bg-gradient-to-r from-amber-400/[0.12] to-transparent text-amber-200"
                  : "text-neutral-400 hover:bg-white/[0.04] hover:text-neutral-100"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-amber-400" />
              )}
              <div className="flex items-center gap-2.5">
                <Icon
                  className={
                    active
                      ? "text-amber-400"
                      : "text-neutral-500 transition-colors group-hover:text-neutral-300"
                  }
                />
                <span className="text-sm font-medium">{label}</span>
              </div>
              <p className="ml-[26px] mt-0.5 text-[11px] leading-tight text-neutral-600">
                {desc}
              </p>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-1 pt-6">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
          <div className="flex items-center gap-2">
            <span className="tacit-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <p className="text-[11px] text-neutral-500">
              Connected org
            </p>
          </div>
          <p className="mt-1 text-[13px] font-medium text-neutral-200">NimbusPay</p>
        </div>
      </div>
    </aside>
  );
}

function MemoryIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 3a9 9 0 100 18 9 9 0 000-18z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function AssumptionsIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 3l9 16H3l9-16z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 10v4M12 16.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function ForesightIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function InterviewerIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 5h16v11H8l-4 3V5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function ActivityIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M3 12h4l2 6 4-14 2 8h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CaptureIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 15V4m0 0L8 8m4-4l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function DecisionsIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function SettingsIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M19 12a7 7 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 00-2-1.2l-.4-2.6H8.9l-.4 2.6a7 7 0 00-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 000 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 002 1.2l.4 2.6h4.2l.4-2.6a7 7 0 002-1.2l2.4 1 2-3.4-2-1.6c.06-.4.1-.8.1-1.2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}
