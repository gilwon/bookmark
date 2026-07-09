// 노션형 코드 블록 NodeView — 언어 검색 선택 + 복사
"use client";

import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  filterLanguages,
  languageLabel,
  normalizeLanguageId,
} from "@/components/pages/extensions/code-languages";
import { cn } from "@/lib/utils";

/** Tiptap 코드 블록 — 상단 언어 선택·복사 버튼 */
export function CodeBlockView({
  node,
  updateAttributes,
  selected,
  editor,
}: NodeViewProps) {
  const language = normalizeLanguageId(
    (node.attrs.language as string | null) ?? ""
  );
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => filterLanguages(q), [q]);

  useEffect(() => {
    if (!open) return;
    const t = requestAnimationFrame(() => inputRef.current?.focus());
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQ("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => {
      cancelAnimationFrame(t);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open]);

  function pick(id: string) {
    updateAttributes({ language: id || null });
    setOpen(false);
    setQ("");
    // 본문 포커스 복귀
    editor.commands.focus();
  }

  async function copyCode() {
    const text = node.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <NodeViewWrapper
      className={cn(
        "notion-code-block group relative my-3 overflow-hidden rounded-xl border bg-[var(--pre-bg)]",
        selected
          ? "border-indigo-500 ring-1 ring-indigo-500/40"
          : "border-border"
      )}
      data-language={language || "plain"}
    >
      {/* 상단 바: 언어 선택 + 복사 (노션 유사) */}
      <div
        contentEditable={false}
        className="flex items-center justify-between gap-2 border-b border-border/60 px-2 py-1.5"
      >
        <div ref={rootRef} className="relative min-w-0">
          <button
            type="button"
            className={cn(
              "inline-flex h-7 max-w-full items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors",
              "text-muted-foreground hover:bg-muted hover:text-foreground",
              open && "bg-muted text-foreground ring-1 ring-indigo-500/40"
            )}
            onMouseDown={(e) => {
              // 에디터 포커스/선택 유지 방해 최소화
              e.preventDefault();
            }}
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span className="truncate">{languageLabel(language)}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </button>

          {open && (
            <div
              className={cn(
                "absolute left-0 top-[calc(100%+4px)] z-50 w-56 overflow-hidden rounded-xl",
                "border border-border bg-card shadow-2xl"
              )}
              role="listbox"
              aria-label="코드 언어"
            >
              <div className="border-b border-border p-2">
                <input
                  ref={inputRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="언어를 검색하세요"
                  className="h-8 w-full rounded-md border border-border bg-input px-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setOpen(false);
                      setQ("");
                    }
                    if (e.key === "Enter" && filtered[0]) {
                      e.preventDefault();
                      pick(filtered[0].id);
                    }
                  }}
                />
              </div>
              <ul className="max-h-64 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                    결과 없음
                  </li>
                ) : (
                  filtered.map((lang) => {
                    const active = lang.id === language;
                    return (
                      <li key={lang.id || "plain"}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          className={cn(
                            "flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors",
                            active
                              ? "bg-indigo-600/12 text-foreground"
                              : "text-foreground hover:bg-muted"
                          )}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pick(lang.id)}
                        >
                          <span>{lang.label}</span>
                          {active && (
                            <Check className="h-3.5 w-3.5 text-indigo-500" />
                          )}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          )}
        </div>

        <button
          type="button"
          title="코드 복사"
          aria-label="코드 복사"
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs transition-colors",
            "text-muted-foreground hover:bg-muted hover:text-foreground",
            "opacity-0 group-hover:opacity-100 focus:opacity-100"
          )}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void copyCode()}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span>복사됨</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>복사</span>
            </>
          )}
        </button>
      </div>

      {/* contentDOM = pre 내부 블록 (NodeViewContent) */}
      <pre
        className={cn(
          "m-0 overflow-x-auto !rounded-none !border-0 !bg-transparent p-3.5 font-mono text-[0.875rem] leading-relaxed text-foreground",
          language && `language-${language}`
        )}
      >
        <NodeViewContent className="whitespace-pre font-mono text-[0.875rem] leading-relaxed" />
      </pre>
    </NodeViewWrapper>
  );
}
