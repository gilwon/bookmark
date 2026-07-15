// Claude Prompts 300 목록 — 카테고리·검색·페이징·바로 복사
"use client";

import { Copy, ExternalLink, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CLAUDE_PROMPT_CATEGORIES,
  CLAUDE_PROMPTS_CREDIT,
  CLAUDE_PROMPTS_SOURCE,
  claudePromptCategoryLabel,
  type ClaudePromptItem,
} from "@/lib/claude-prompts-kr";
import {
  DEFAULT_PAGE_SIZE,
  matchesSearchTokens,
  slicePage,
  totalPages,
} from "@/lib/list-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListPagination } from "@/components/ui/list-pagination";
import { cn } from "@/lib/utils";

type Props = {
  items: ClaudePromptItem[];
};

/** 클립보드 복사 후 짧은 토스트 상태 */
function useCopyFlash() {
  const [flash, setFlash] = useState<string | null>(null);
  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFlash(key);
      window.setTimeout(() => setFlash((f) => (f === key ? null : f)), 1200);
    } catch {
      alert("복사에 실패했습니다.");
    }
  }
  return { flash, copy };
}

/** Claude Prompts 카탈로그 목록 UI */
export function ClaudePromptList({ items }: Props) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [page, setPage] = useState(1);
  const { flash, copy } = useCopyFlash();

  const filtered = useMemo(() => {
    return items.filter((p) => {
      if (cat !== "all" && p.category !== cat) return false;
      const hay = [
        p.title,
        p.titleKo,
        p.prompt,
        p.promptKo,
        claudePromptCategoryLabel(p.category),
        String(p.displayId),
      ].join(" ");
      return matchesSearchTokens(hay, q);
    });
  }, [items, cat, q]);

  const pageSize = DEFAULT_PAGE_SIZE;
  const pages = totalPages(filtered.length, pageSize);
  const safePage = Math.min(page, pages);
  const pageItems = slicePage(filtered, safePage, pageSize);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: items.length };
    for (const p of items) {
      m[p.category] = (m[p.category] ?? 0) + 1;
    }
    return m;
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>
          {CLAUDE_PROMPTS_CREDIT} · 결과 {filtered.length}건
          {q.trim() ? ` · “${q.trim()}”` : ""}
        </p>
        <a
          href={CLAUDE_PROMPTS_SOURCE}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-indigo-500"
        >
          원본 사이트
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="제목·본문·카테고리·번호 검색"
          className="pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {CLAUDE_PROMPT_CATEGORIES.map((c) => {
          const active = cat === c.id;
          const count = counts[c.id] ?? 0;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCat(c.id);
                setPage(1);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-indigo-500/50 bg-indigo-600/15 text-indigo-700 dark:text-indigo-200"
                  : "border-border bg-card text-muted-foreground hover:border-indigo-500/30 hover:text-foreground"
              )}
            >
              {c.label}
              <span className="tabular-nums opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {pageItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          일치하는 프롬프트가 없습니다.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {pageItems.map((p) => {
            const copyKey = `card-${p.displayId}`;
            const bodyKo = p.promptKo?.trim();
            const copyText = bodyKo
              ? `${bodyKo}\n\n---\n\n${p.prompt}`
              : p.prompt;
            return (
              <Card
                key={p.displayId}
                className="group transition-colors hover:border-indigo-500/40"
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          #{p.displayId}
                        </span>
                        <Badge variant="secondary">
                          {claudePromptCategoryLabel(p.category)}
                        </Badge>
                      </div>
                      <Link
                        href={`/claude-prompts/${p.displayId}`}
                        className="mt-1 block truncate text-sm font-semibold hover:text-indigo-600 dark:hover:text-indigo-300"
                      >
                        {p.titleKo || p.title}
                      </Link>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {p.title}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="shrink-0"
                      onClick={() => void copy(copyText, copyKey)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {flash === copyKey ? "복사됨" : "복사"}
                    </Button>
                  </div>

                  {/* 한글 위 · 영문 아래 미리보기 */}
                  {bodyKo ? (
                    <p className="line-clamp-3 text-xs leading-relaxed text-foreground/90">
                      {bodyKo}
                    </p>
                  ) : null}
                  <p
                    className={cn(
                      "line-clamp-2 text-[11px] leading-relaxed text-muted-foreground",
                      bodyKo && "border-t border-border/60 pt-2"
                    )}
                  >
                    {p.prompt}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ListPagination
        page={safePage}
        total={filtered.length}
        pageSize={pageSize}
        onChange={setPage}
      />
    </div>
  );
}
