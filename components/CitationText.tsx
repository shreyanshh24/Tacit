"use client";

import React from "react";
import { useSources } from "./SourcesProvider";

/**
 * Renders model output as lightweight markdown (paragraphs, headings, bullet /
 * numbered lists, **bold**) with [SOURCE-ID] tokens turned into clickable
 * citation chips. A streaming caret shows on the final block while generating.
 */
export default function CitationText({
  text,
  streaming = false,
}: {
  text: string;
  streaming?: boolean;
}) {
  const { open, get } = useSources();

  const renderInline = (s: string, keyBase: string): React.ReactNode[] => {
    // Split on **bold** and [citation] tokens, keeping delimiters.
    const parts = s.split(/(\*\*[^*]+\*\*|\[[^\]\n]+\])/g);
    return parts.map((part, i) => {
      const bold = part.match(/^\*\*([^*]+)\*\*$/);
      if (bold) return <strong key={`${keyBase}-${i}`}>{bold[1]}</strong>;

      const cite = part.match(/^\[([^\]\n]+)\]$/);
      if (cite) {
        const id = cite[1].trim();
        const known = !!get(id);
        return (
          <button
            key={`${keyBase}-${i}`}
            onClick={() => open(id)}
            disabled={!known}
            className={`mx-0.5 inline-flex items-center rounded-md px-1.5 py-0.5 align-baseline text-[12px] font-medium transition-colors ${
              known
                ? "cursor-pointer bg-amber-400/15 text-amber-300 hover:bg-amber-400/25"
                : "cursor-default bg-white/5 text-neutral-400"
            }`}
            title={known ? "View source" : "Source not in current context"}
          >
            {id}
          </button>
        );
      }
      return <span key={`${keyBase}-${i}`}>{part}</span>;
    });
  };

  // Break into blocks on blank lines, preserving single newlines within a block.
  const lines = text.split("\n");
  const blocks: { type: "p" | "h" | "li"; marker?: string; content: string }[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length) {
      blocks.push({ type: "p", content: paragraph.join(" ") });
      paragraph = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const numbered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);

    if (heading) {
      flush();
      blocks.push({ type: "h", content: heading[1] });
    } else if (bullet) {
      flush();
      blocks.push({ type: "li", marker: "•", content: bullet[1] });
    } else if (numbered) {
      flush();
      blocks.push({ type: "li", marker: `${numbered[1]}.`, content: numbered[2] });
    } else {
      paragraph.push(line);
    }
  }
  flush();

  return (
    <div className="prose-tacit">
      {blocks.map((b, i) => {
        const isLast = i === blocks.length - 1;
        const caret = streaming && isLast ? " tacit-caret" : "";
        if (b.type === "h") {
          return (
            <div key={i} className={`h${caret}`}>
              {renderInline(b.content, `h${i}`)}
            </div>
          );
        }
        if (b.type === "li") {
          return (
            <div key={i} className={`li${caret}`}>
              <span className="li-marker">{b.marker}</span>
              <span>{renderInline(b.content, `li${i}`)}</span>
            </div>
          );
        }
        return (
          <div key={i} className={`p${caret}`}>
            {renderInline(b.content, `p${i}`)}
          </div>
        );
      })}
    </div>
  );
}
