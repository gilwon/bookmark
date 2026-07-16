"use client";
// heyjames.ai/skills 카탈로그 목록 — 타입 필터 + 카드 그리드
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  HEYJAMES_SKILL_TYPES,
  heyjamesSkillTypeLabel,
  type HeyjamesSkillItem,
} from "@/lib/heyjames-skills";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function HeyjamesSkillList({ items }: { items: HeyjamesSkillItem[] }) {
  const [type, setType] = useState<string>("all");
  const filtered = useMemo(
    () => items.filter((s) => type === "all" || s.type === type),
    [items, type]
  );
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: items.length };
    for (const s of items) m[s.type] = (m[s.type] ?? 0) + 1;
    return m;
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {HEYJAMES_SKILL_TYPES.map((t) => {
          const active = type === t.id;
          const count = counts[t.id] ?? 0;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-indigo-500/50 bg-indigo-600/15 text-indigo-700 dark:text-indigo-200"
                  : "border-border bg-card text-muted-foreground hover:border-indigo-500/30 hover:text-foreground"
              )}
            >
              {t.label}
              <span className="tabular-nums opacity-70">{count}</span>
            </button>
          );
        })}
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          일치하는 항목이 없습니다.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <Link key={item.id} href={`/skills/${item.slug}`} className="block">
              <Card className="group h-full transition-colors hover:border-indigo-500/40">
                <CardContent className="space-y-2 p-4">
                  <div>
                    <span className="block text-sm font-semibold">
                      {item.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {heyjamesSkillTypeLabel(item.type)}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    조회 {item.views.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
