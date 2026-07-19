"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CitationText from "@/components/CitationText";
import ConnectJira from "@/components/ConnectJira";
import { useSources } from "@/components/SourcesProvider";
import { useSession } from "@/components/SessionProvider";
import { type StreamSource } from "@/components/streamClient";

interface Cards {
  type: "assumptions" | "decisions";
  items: unknown[];
}

interface Msg {
  id?: number;
  role: "user" | "assistant";
  mode?: string;
  content: string;
  status?: string;
  sources?: StreamSource[] | null;
  cards?: Cards | null;
}

interface Conversation {
  id: number;
  title: string | null;
}

const EXAMPLES = [
  "Why did we kill the App Marketplace?",
  "What caused the September sync outage and how do we prevent it?",
  "Run a pre-mortem: launch a self-serve AI Agent Marketplace where partners publish plugins on our public API, no manual review.",
  "Show me the recorded decisions.",
];

// Every capability Chat can auto-route to, grouped for the "Prompt ideas" panel.
const CATEGORY_STYLE: Record<string, string> = {
  Memory: "bg-sky-500/15 text-sky-300",
  Status: "bg-indigo-500/15 text-indigo-300",
  Codebase: "bg-violet-500/15 text-violet-300",
  Foresight: "bg-fuchsia-500/15 text-fuchsia-300",
  Assumptions: "bg-amber-500/15 text-amber-300",
  Decisions: "bg-emerald-500/15 text-emerald-300",
  Capture: "bg-teal-500/15 text-teal-300",
  General: "bg-white/10 text-neutral-300",
};

const PROMPT_IDEAS: { category: string; prompt: string }[] = [
  { category: "Memory", prompt: "Why did we kill the App Marketplace?" },
  { category: "Memory", prompt: "What caused the September sync outage and how do we prevent it?" },
  { category: "Memory", prompt: "Why did we choose PostgreSQL over MongoDB?" },
  { category: "Status", prompt: "What happened with the contacts & accounts work (CRM360-22)?" },
  { category: "Status", prompt: "Do you think CRM360-24 (two-way email sync) is resolved?" },
  { category: "Status", prompt: "What's blocking the deal pipeline feature right now?" },
  { category: "Codebase", prompt: "How does multi-tenancy isolation work in CRM360?" },
  { category: "Codebase", prompt: "What's the async job queue design and why was it added?" },
  { category: "Codebase", prompt: "What's the design of the AI agent marketplace feature branch?" },
  { category: "Foresight", prompt: "Run a pre-mortem: launch a self-serve AI Agent Marketplace where partners publish plugins on our public API, with no manual review." },
  { category: "Foresight", prompt: "Pre-mortem: ship a CSV export that includes every field by default." },
  { category: "Assumptions", prompt: "Surface the assumptions in: we'll add real-time collaborative record editing for all tenants by Q4." },
  { category: "Decisions", prompt: "Show me the recorded decisions." },
  { category: "Capture", prompt: "Capture: we're deferring Outlook email sync until IT approves the app registration. Owner: Deepa." },
  { category: "General", prompt: "What can you do?" },
];

function CategoryTag({ category }: { category: string }) {
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
        CATEGORY_STYLE[category] ?? CATEGORY_STYLE.General
      }`}
    >
      {category}
    </span>
  );
}

export default function ChatPage() {
  const { project } = useSession();
  const { register } = useSources();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showHints, setShowHints] = useState(false);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const applyMessages = useCallback(
    (msgs: Msg[]) => {
      setMessages(msgs);
      for (const m of msgs) if (m.sources?.length) register(m.sources);
    },
    [register]
  );

  const loadConversations = useCallback(async () => {
    const d = await fetch("/api/conversations").then((r) => r.json());
    const list: Conversation[] = d.conversations ?? [];
    setConversations(list);
    return list;
  }, []);

  // Fetch the active conversation; keep polling while any message is streaming
  // (this is what makes an in-progress answer resume after a tab switch/reload).
  const refresh = useCallback(
    async (id: number) => {
      const d = await fetch(`/api/conversations/${id}`)
        .then((r) => r.json())
        .catch(() => null);
      if (!d || activeIdRef.current !== id) return;
      applyMessages(d.messages ?? []);
      if ((d.messages ?? []).some((m: Msg) => m.status === "streaming")) {
        if (pollRef.current) clearTimeout(pollRef.current);
        pollRef.current = setTimeout(() => refresh(id), 400);
      }
    },
    [applyMessages]
  );

  const openConversation = useCallback(
    (id: number) => {
      if (pollRef.current) clearTimeout(pollRef.current);
      activeIdRef.current = id;
      setActiveId(id);
      setMessages([]);
      refresh(id);
    },
    [refresh]
  );

  // Initial load: list conversations + open the most recent.
  useEffect(() => {
    (async () => {
      const list = await loadConversations();
      if (list[0]) openConversation(list[0].id);
    })();
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function newChat() {
    if (pollRef.current) clearTimeout(pollRef.current);
    activeIdRef.current = null;
    setActiveId(null);
    setMessages([]);
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || sending) return;
    setInput("");
    setSending(true);
    // Optimistic echo.
    setMessages((m) => [
      ...m,
      { role: "user", content: q },
      { role: "assistant", content: "", status: "streaming" },
    ]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, conversationId: activeIdRef.current }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setMessages((m) => {
          const c = [...m];
          for (let i = c.length - 1; i >= 0; i--)
            if (c[i].role === "assistant") {
              c[i] = { ...c[i], content: `⚠ ${err.error ?? "Request failed"}`, status: "error" };
              break;
            }
          return c;
        });
        return;
      }
      const { conversationId } = await res.json();
      if (activeIdRef.current == null) {
        activeIdRef.current = conversationId;
        setActiveId(conversationId);
        loadConversations();
      } else {
        loadConversations();
      }
      refresh(conversationId);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: `⚠ ${(e as Error).message}`, status: "error" }]);
    } finally {
      setSending(false);
    }
  }

  const empty = messages.length === 0;
  const streaming = messages.some((m) => m.status === "streaming");

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full">
      {/* Conversation list */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/[0.06] md:flex">
        <div className="p-3">
          <button
            onClick={newChat}
            className="w-full rounded-lg bg-amber-400 px-3 py-2 text-sm font-medium text-[#0a0a0c]"
          >
            + New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {conversations.length === 0 ? (
            <p className="px-2 py-3 text-[12px] text-neutral-600">No conversations yet.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => openConversation(c.id)}
                className={`mb-1 block w-full truncate rounded-lg px-3 py-2 text-left text-[13px] ${
                  c.id === activeId
                    ? "bg-white/[0.06] text-neutral-100"
                    : "text-neutral-400 hover:bg-white/[0.04]"
                }`}
                title={c.title ?? "Untitled"}
              >
                {c.title || "Untitled"}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Chat thread */}
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
        <div className="flex items-center justify-between px-6 pt-6">
          <div>
            <h1 className="text-lg font-semibold text-white">Chat</h1>
            <p className="text-xs text-neutral-500">
              Ask, analyze, and capture — {project?.name ?? "this project"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHints((s) => !s)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/5"
            >
              💡 Prompt ideas
            </button>
            <button
              onClick={newChat}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/5 md:hidden"
            >
              + New
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {empty ? (
            <div className="mt-6">
              <p className="text-center text-sm text-neutral-400">
                Ask about this project&apos;s memory, paste a plan for a pre-mortem, or capture a note.
              </p>
              <div className="mx-auto mt-5 grid max-w-xl gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => send(ex)}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left text-[13px] text-neutral-300 hover:border-amber-400/30 hover:bg-white/[0.04]"
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <div className="mx-auto mt-6 max-w-xl">
                <ConnectJira />
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <MessageView
                key={m.id ?? `tmp-${i}`}
                msg={m}
                streaming={m.role === "assistant" && m.status === "streaming"}
              />
            ))
          )}
        </div>

        {showHints && (
          <div className="mx-6 mb-2 max-h-[45vh] overflow-y-auto rounded-xl border border-white/10 bg-[#0d0d10] p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-medium text-neutral-200">
                Prompt ideas — chat auto-routes each to the right capability
              </p>
              <button
                onClick={() => setShowHints(false)}
                className="text-[11px] text-neutral-500 hover:text-neutral-300"
              >
                Close
              </button>
            </div>
            <div className="space-y-1.5">
              {PROMPT_IDEAS.map((p) => (
                <button
                  key={p.prompt}
                  onClick={() => {
                    setShowHints(false);
                    send(p.prompt);
                  }}
                  className="flex w-full items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left hover:border-amber-400/30 hover:bg-white/[0.04]"
                >
                  <CategoryTag category={p.category} />
                  <span className="text-[13px] text-neutral-300">{p.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-white/[0.06] px-6 py-4">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Ask a question, paste a plan, or type / for a command…"
              className="max-h-40 flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-amber-400/40 focus:outline-none"
            />
            <button
              onClick={() => send(input)}
              disabled={sending || !input.trim()}
              className="rounded-xl bg-amber-400 px-4 py-3 text-sm font-medium text-[#0a0a0c] transition-opacity disabled:opacity-40"
            >
              {sending ? "…" : "Send"}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-neutral-600">
            {streaming ? "Generating… (keeps running if you switch tabs)" : "Auto-routes to memory, foresight, assumptions, decisions, or capture"} · Enter to send
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageView({ msg, streaming }: { msg: Msg; streaming: boolean }) {
  const { open } = useSources();
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-amber-400/[0.12] px-4 py-2.5 text-sm text-amber-50">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] space-y-3">
        {msg.mode && (
          <span className="inline-block rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
            {msg.mode}
          </span>
        )}
        <div className="rounded-2xl rounded-bl-sm bg-white/[0.03] px-4 py-3 text-sm text-neutral-200">
          {msg.content ? (
            <CitationText text={msg.content} streaming={streaming} />
          ) : (
            <span className="animate-pulse text-neutral-500">Thinking…</span>
          )}
        </div>

        {msg.cards?.type === "assumptions" && (
          <AssumptionCards items={msg.cards.items as AssumptionItem[]} />
        )}
        {msg.cards?.type === "decisions" && (
          <DecisionCards items={msg.cards.items as DecisionItem[]} />
        )}

        {msg.sources && msg.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.sources.map((s) => (
              <button
                key={s.source_id}
                onClick={() => s.source_id && open(s.source_id)}
                className="rounded-md bg-white/[0.04] px-2 py-1 text-[11px] text-neutral-300 hover:bg-white/[0.08]"
                title={s.title ?? ""}
              >
                {s.source_id}
                {s.linked_jira_key ? ` · ${s.linked_jira_key}` : ""}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface AssumptionItem {
  text: string;
  why_load_bearing: string;
  risk: string;
  stated_or_implicit: string;
}

function AssumptionCards({ items }: { items: AssumptionItem[] }) {
  const riskColor: Record<string, string> = {
    high: "bg-red-500/15 text-red-300",
    medium: "bg-amber-500/15 text-amber-300",
    low: "bg-emerald-500/15 text-emerald-300",
  };
  return (
    <div className="space-y-2">
      {items.map((a, i) => (
        <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[13px] font-medium text-neutral-100">{a.text}</p>
            <div className="flex shrink-0 gap-1">
              <span className={`rounded px-1.5 py-0.5 text-[10px] ${riskColor[a.risk] ?? "bg-white/5 text-neutral-400"}`}>
                {a.risk}
              </span>
              <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-400">
                {a.stated_or_implicit}
              </span>
            </div>
          </div>
          {a.why_load_bearing && (
            <p className="mt-1.5 text-[12px] text-neutral-400">
              <span className="text-neutral-500">If false: </span>
              {a.why_load_bearing}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

interface DecisionItem {
  title: string;
  decision: string;
  reasoning: string;
  outcome: string;
  alternatives?: { option?: string; why_rejected?: string }[];
  people?: { name?: string; role_in_decision?: string }[];
  source_ids?: string[];
}

function DecisionCards({ items }: { items: DecisionItem[] }) {
  const outcomeColor: Record<string, string> = {
    killed: "bg-red-500/15 text-red-300",
    failed: "bg-red-500/15 text-red-300",
    succeeded: "bg-emerald-500/15 text-emerald-300",
    active: "bg-blue-500/15 text-blue-300",
    unknown: "bg-white/5 text-neutral-400",
  };
  if (!items.length) return null;
  return (
    <div className="space-y-2">
      {items.map((d, i) => (
        <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] font-semibold text-neutral-100">{d.title}</p>
            {d.outcome && (
              <span className={`rounded px-1.5 py-0.5 text-[10px] ${outcomeColor[d.outcome] ?? "bg-white/5 text-neutral-400"}`}>
                {d.outcome}
              </span>
            )}
          </div>
          {d.decision && <p className="mt-1 text-[12px] text-neutral-300">{d.decision}</p>}
          {d.reasoning && <p className="mt-1 text-[12px] text-neutral-500">{d.reasoning}</p>}
        </div>
      ))}
    </div>
  );
}
