// Git 치트시트 목록 — 카테고리 필터 + 카드 그리드
"use client";

import { useMemo, useState } from "react";
import {
  GIT_CHEATSHEET_CATEGORIES,
  gitCheatsheetCategoryLabel,
  type GitCheatsheetItem,
} from "@/lib/git-cheatsheet";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  items: GitCheatsheetItem[];
};

/** Git 명령어 치트시트 카탈로그 목록 UI */
export function GitCheatsheetList({ items }: Props) {
  const [cat, setCat] = useState<string>("all");

  const filtered = useMemo(() => {
    return items.filter((c) => cat === "all" || c.category === cat);
  }, [items, cat]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: items.length };
    for (const c of items) {
      m[c.category] = (m[c.category] ?? 0) + 1;
    }
    return m;
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {GIT_CHEATSHEET_CATEGORIES.map((c) => {
          const active = cat === c.id;
          const count = counts[c.id] ?? 0;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCat(c.id)}
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

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          일치하는 명령어가 없습니다.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Card
              key={c.id}
              className="group transition-colors hover:border-indigo-500/40"
            >
              <CardContent className="space-y-2 p-4">
                <div>
                  <span className="block text-sm font-semibold">
                    {c.title}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {gitCheatsheetCategoryLabel(c.category)}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {c.description}
                </p>
                <p className="rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs text-foreground/90">
                  {c.command}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
