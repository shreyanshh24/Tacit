"use client";

import { useEffect, useState } from "react";
import ConnectJira from "@/components/ConnectJira";
import { useSession } from "@/components/SessionProvider";

interface ConnStatus {
  connected: boolean;
  jira_base_url: string | null;
  jira_email: string | null;
  jira_project_key: string | null;
}

export default function JiraPage() {
  const { project } = useSession();
  const [status, setStatus] = useState<ConnStatus | null>(null);
  const [docCount, setDocCount] = useState<number | null>(null);

  async function load() {
    const s = await fetch("/api/projects/jira-connect").then((r) => r.json());
    setStatus(s);
    const caps = await fetch("/api/capture").then((r) => r.json()).catch(() => ({}));
    // rough count of jira-sourced docs isn't exposed; show captures as a proxy is misleading,
    // so we just leave docCount null unless we add an endpoint. Keep simple.
    void caps;
    setDocCount(null);
  }
  useEffect(() => {
    load();
  }, [project?.id]);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <h1 className="text-lg font-semibold text-white">Jira</h1>
      <p className="mt-1 text-xs text-neutral-500">
        Manage the Jira connection for{" "}
        <span className="text-neutral-300">{project?.name ?? "this project"}</span>. Credentials are
        stored per project — each project has its own isolated connection and memory.
      </p>

      <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              status?.connected ? "bg-emerald-400" : "bg-neutral-600"
            }`}
          />
          <span className="text-sm text-neutral-200">
            {status?.connected ? "Connected" : "Not connected"}
          </span>
          {status?.jira_project_key && (
            <span className="rounded bg-white/5 px-2 py-0.5 text-[11px] text-neutral-400">
              key: {status.jira_project_key}
            </span>
          )}
        </div>
        {status?.jira_base_url && (
          <p className="mt-2 text-[12px] text-neutral-500">
            {status.jira_base_url} · {status.jira_email}
          </p>
        )}
        {docCount != null && (
          <p className="mt-1 text-[12px] text-neutral-500">{docCount} imported issues in memory</p>
        )}
      </div>

      <ConnectJira defaultOpen />

      <p className="mt-4 text-[12px] text-neutral-600">
        Tip: switch projects from the top bar (e.g. NimbusPay ↔ CRM360). Each project&apos;s Jira
        connection and imported issues are completely separate.
      </p>
    </div>
  );
}
