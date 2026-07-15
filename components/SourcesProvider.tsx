"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

export interface SourceDoc {
  source_id: string;
  title?: string | null;
  author?: string | null;
  ts?: string | null;
  source?: string | null;
  content?: string | null;
}

interface SourcesContextValue {
  register: (docs: SourceDoc[]) => void;
  open: (sourceId: string) => void;
  get: (sourceId: string) => SourceDoc | undefined;
}

const SourcesContext = createContext<SourcesContextValue | null>(null);

export function useSources(): SourcesContextValue {
  const ctx = useContext(SourcesContext);
  if (!ctx) throw new Error("useSources must be used within SourcesProvider");
  return ctx;
}

export function SourcesProvider({ children }: { children: React.ReactNode }) {
  const mapRef = useRef<Map<string, SourceDoc>>(new Map());
  const [selected, setSelected] = useState<SourceDoc | null>(null);
  const [, force] = useState(0);

  const register = useCallback((docs: SourceDoc[]) => {
    let changed = false;
    for (const d of docs) {
      if (d.source_id) {
        mapRef.current.set(d.source_id, { ...mapRef.current.get(d.source_id), ...d });
        changed = true;
      }
    }
    if (changed) force((n) => n + 1);
  }, []);

  const get = useCallback((id: string) => mapRef.current.get(id), []);

  const open = useCallback((id: string) => {
    const doc = mapRef.current.get(id);
    if (doc) setSelected(doc);
  }, []);

  return (
    <SourcesContext.Provider value={{ register, open, get }}>
      {children}
      <SlideOver doc={selected} onClose={() => setSelected(null)} />
    </SourcesContext.Provider>
  );
}

function SlideOver({ doc, onClose }: { doc: SourceDoc | null; onClose: () => void }) {
  return (
    <div
      className={`fixed inset-0 z-50 ${doc ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!doc}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
          doc ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`absolute right-0 top-0 h-full w-full max-w-md border-l border-white/10 bg-[#0d0d10] shadow-2xl transition-transform duration-300 ${
          doc ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {doc && (
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between border-b border-white/5 px-6 py-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-amber-400/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                    {doc.source_id}
                  </span>
                  {doc.source && (
                    <span className="rounded bg-white/5 px-2 py-0.5 text-[11px] text-neutral-400">
                      {doc.source}
                    </span>
                  )}
                </div>
                <h3 className="mt-2 text-sm font-semibold text-white">{doc.title}</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  {doc.author} {doc.ts ? `· ${doc.ts}` : ""}
                </p>
              </div>
              <button
                onClick={onClose}
                className="ml-3 shrink-0 rounded-md p-1.5 text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">
                {doc.content}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
