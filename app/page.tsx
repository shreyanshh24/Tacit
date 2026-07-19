"use client";

import { useEffect, useRef, useState } from "react";
import CitationText from "@/components/CitationText";
import ConnectJira from "@/components/ConnectJira";
import { useSources } from "@/components/SourcesProvider";
import { consumeMetaStream, type StreamSource } from "@/components/streamClient";
import { useSession } from "@/components/SessionProvider";

type Mode = "auto" | "memory" | "foresight" | "assumptions" | "decisions" | "capture";

const MODES: { id: Mode; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "memory", label: "Memory" },
  { id: "foresight", label: "Foresight" },
  { id: "assumptions", label: "Assumptions" },
  { id: "decisions", label: "Decisions" },
  { id: "capture", label: "Capture" },
];

interface Cards {
  type: "assumptions" | "decisions";
  items: unknown[];
}

interface Msg {
  role: "user" | "assistant";
  mode?: string;
  content: string;
  sources?: StreamSource[] | null;
  cards?: Cards | null;
}

const EXAMPLES = [
  "Why did we kill the App Marketplace?",
  "What caused the September sync outage and how do we prevent it?",
  "Run a pre-mortem: launch a self-serve AI Agent Marketplace where partners publish plugins on our public API, no manual review.",
  "Show me the recorded decisions.",
];

export default function ChatPage() {
  const { project } = useSession();
  const { register } = useSources();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("auto");
  const [loading, setLoading] = useState(false);
  const convId = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    setInput("");
    setLoading(true);
    setMessages((m) => [
      ...m,
      { role: "user", content: q },
      { role: "assistant", content: "", mode: mode === "auto" ? undefined : mode },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          mode: mode === "auto" ? undefined : mode,
          conversationId: convId.current,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        patchLast((a) => ({ ...a, content: `⚠ ${err.error ?? "Request failed"}` }));
        return;
      }
      await consumeMetaStream(res, {
        onMeta: (meta) => {
          convId.current = meta.conversationId;
          if (meta.sources?.length) register(meta.sources);
          patchLast((a) => ({
            ...a,
            mode: meta.mode,
            sources: meta.sources,
            cards: meta.cards,
          }));
        },
        onDelta: (t) => patchLast((a) => ({ ...a, content: a.content + t })),
      });
    } catch (e) {
      patchLast((a) => ({ ...a, content: `⚠ ${(e as Error).message}` }));
    } finally {
      setLoading(false);
    }
  }

  function patchLast(fn: (a: Msg) => Msg) {
    setMessages((m) => {
      const copy = [...m];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === "assistant") {
          copy[i] = fn(copy[i]);
          break;
        }
      }
      return copy;
    });
  }

  function newChat() {
    convId.current = null;
    setMessages([]);
  }

  const empty = messages.length === 0;

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] w-full max-w-3xl flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6">
        <div>
          <h1 className="text-lg font-semibold text-white">Chat</h1>
          <p className="text-xs text-neutral-500">
            One place to ask, analyze, and capture — {project?.name ?? "this project"}
          </p>
        </div>
        <button
          onClick={newChat}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white/5"
        >
          + New chat
        </button>
      </div>

      {/* Mode chips */}
      <div className="flex flex-wrap gap-1.5 px-6 pt-3">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`rounded-full px-3 py-1 text-[12px] transition-colors ${
              mode === m.id
                ? "bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30"
                : "bg-white/[0.03] text-neutral-400 hover:bg-white/[0.06]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Messages */}
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
              key={i}
              msg={m}
              streaming={loading && i === messages.length - 1 && m.role === "assistant"}
            />
          ))
        )}
      </div>

      {/* Input */}
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
            placeholder={
              mode === "capture"
                ? "Paste a note or transcript to capture…"
                : "Ask a question, paste a plan, or type / for a command…"
            }
            className="max-h-40 flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-amber-400/40 focus:outline-none"
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-amber-400 px-4 py-3 text-sm font-medium text-[#0a0a0c] transition-opacity disabled:opacity-40"
          >
            {loading ? "…" : "Send"}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-neutral-600">
          {mode === "auto" ? "Auto-routing" : `Forced: ${mode}`} · Enter to send · Shift+Enter for newline
        </p>
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
            <span className="text-neutral-500">Thinking…</span>
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
