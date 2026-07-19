"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "./SessionProvider";

interface ConnStatus {
  connected: boolean;
  isOwner: boolean;
  jira_base_url: string | null;
  jira_email: string | null;
  jira_project_key: string | null;
}

export default function ConnectJira({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const { isOwner, project, refresh } = useSession();
  const [open, setOpen] = useState(defaultOpen);
  const [status, setStatus] = useState<ConnStatus | null>(null);

  // connection form
  const [baseUrl, setBaseUrl] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectMsg, setConnectMsg] = useState<string | null>(null);

  // import
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/projects/jira-connect");
    const data = await res.json();
    setStatus(data);
    if (data.jira_base_url) setBaseUrl(data.jira_base_url);
    if (data.jira_email) setEmail(data.jira_email);
    if (data.jira_project_key) setProjectKey(data.jira_project_key);
  }, []);

  useEffect(() => {
    if (open && !status) loadStatus();
  }, [open, status, loadStatus]);

  async function connect() {
    if (connecting) return;
    setConnecting(true);
    setConnectMsg(null);
    try {
      const res = await fetch("/api/projects/jira-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, email, token, projectKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setConnectMsg(
        data.validatedIssueCount != null
          ? `✓ Connected — verified ${data.validatedIssueCount} issue(s) in ${data.jira_project_key}.`
          : "✓ Connection saved."
      );
      setToken("");
      await loadStatus();
      refresh();
    } catch (e) {
      setConnectMsg(`✕ ${String((e as Error).message ?? e)}`);
    } finally {
      setConnecting(false);
    }
  }

  async function runImport() {
    const key = projectKey.trim();
    if (!key || importing) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await fetch("/api/ingest-jira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectKey: key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`);
      setImportMsg({
        ok: true,
        text: `Imported ${data.documentsInserted} issue(s) from ${data.projectKey}. Ask Memory about them.`,
      });
      refresh();
    } catch (e) {
      setImportMsg({ ok: false, text: String((e as Error).message ?? e) });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.02]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2.5">
          <JiraGlyph />
          <span className="text-sm font-medium text-neutral-200">Connect Jira</span>
          <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
            live connector
          </span>
          {project?.jira_project_key && (
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-neutral-400">
              linked: {project.jira_project_key}
            </span>
          )}
        </span>
        <span className={`text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-white/[0.06] px-4 py-4">
          {!isOwner ? (
            <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[13px] text-neutral-500">
              Only the project owner can connect Jira for{" "}
              <span className="text-neutral-300">{project?.name}</span>. Ask the owner, or open a
              project you own.
            </p>
          ) : (
            <>
              {/* Connection form */}
              <div>
                <p className="mb-2 text-[12px] font-medium uppercase tracking-widest text-neutral-600">
                  Jira connection {status?.connected && <span className="text-emerald-400">· connected</span>}
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://your-team.atlassian.net"
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-amber-400/40"
                  />
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-amber-400/40"
                  />
                  <input
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    type="password"
                    placeholder={status?.connected ? "API token (saved — re-enter to change)" : "API token"}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-neutral-600 outline-none focus:border-amber-400/40"
                  />
                  <input
                    value={projectKey}
                    onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                    placeholder="Project key (e.g. TACIT)"
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm uppercase text-white placeholder:normal-case placeholder:text-neutral-600 outline-none focus:border-amber-400/40"
                  />
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    onClick={connect}
                    disabled={connecting || !baseUrl || !email || !token}
                    className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-[#0a0a0c] transition-opacity hover:bg-amber-300 disabled:opacity-40"
                  >
                    {connecting ? "Connecting…" : status?.connected ? "Update connection" : "Connect"}
                  </button>
                  <span className="text-[11px] text-neutral-600">
                    Token from id.atlassian.com/manage-profile/security/api-tokens
                  </span>
                </div>
                {connectMsg && (
                  <p className="mt-2 text-[12px] text-neutral-400">{connectMsg}</p>
                )}
              </div>

              {/* Import — pulls the tickets into memory using the key above */}
              <div className="border-t border-white/[0.06] pt-3">
                <p className="mb-2 text-[12px] font-medium uppercase tracking-widest text-neutral-600">
                  Import issues into memory
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={runImport}
                    disabled={importing || !projectKey.trim()}
                    className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-[#0a0a0c] transition-opacity hover:bg-amber-300 disabled:opacity-40"
                  >
                    {importing ? "Importing…" : projectKey.trim() ? `Import ${projectKey.trim()}` : "Import"}
                  </button>
                  <span className="text-[11px] text-neutral-600">
                    {projectKey.trim()
                      ? "Pulls tickets from the project key above into this project's memory. Re-run anytime to re-sync."
                      : "Enter a project key above first."}
                  </span>
                </div>
                {importMsg && (
                  <p
                    className={`mt-2 rounded-lg border px-3 py-2 text-[13px] ${
                      importMsg.ok
                        ? "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-200"
                        : "border-red-500/20 bg-red-500/[0.06] text-red-300"
                    }`}
                  >
                    {importMsg.ok ? "✓ " : ""}
                    {importMsg.text}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function JiraGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2l9 9-9 9-4.5-4.5L12 11 7.5 6.5 12 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        className="text-amber-400"
      />
    </svg>
  );
}
