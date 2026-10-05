"use client";
// 설치 현황 뷰 — 모델 탭(?tool=) + 검색 + 스킬·플러그인 구역
import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  skillSourceLabel,
  type InstalledTool,
} from "@/lib/installed-tools";
import { cn } from "@/lib/utils";

/** 이름·설명에 검색어가 들어 있는지 본다(대소문자 무시). */
function matches(q: string, ...fields: string[]) {
  return !q || fields.some((f) => f.toLowerCase().includes(q));
}

/** 빈 구역 안내 */
function Empty() {
  return (
    <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
      설치된 항목이 없습니다
    </div>
  );
}

/** 구역 제목과 개수 */
function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <h2 className="text-sm font-medium">
      {title} <span className="tabular-nums text-muted-foreground">{count}</span>
    </h2>
  );
}

export function InstalledToolsView({
  tools,
  activeId,
}: {
  tools: InstalledTool[];
  activeId: string;
}) {
  const [query, setQuery] = useState("");
  const active = tools.find((t) => t.id === activeId) ?? tools[0];
  const q = query.trim().toLowerCase();
  const skills = active?.skills.filter((s) => matches(q, s.name, s.description)) ?? [];
  const plugins =
    active?.plugins.filter((p) => matches(q, p.name, p.description)) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {tools.map((t) => {
          const on = t.id === active?.id;
          return (
            <Link
              key={t.id}
              href={{ pathname: "/installed-tools", query: { tool: t.id } }}
              aria-current={on ? "page" : undefined}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors",
                on
                  ? "border-indigo-500/50 bg-indigo-600/15 text-indigo-700 dark:text-indigo-200"
                  : "border-border bg-card text-muted-foreground hover:border-indigo-500/30 hover:text-foreground"
              )}
            >
              {t.label}
              <span className="tabular-nums opacity-70">
                스킬 {t.skills.length} · 플러그인 {t.plugins.length}
              </span>
            </Link>
          );
        })}
      </div>

      <label className="relative block max-w-md">
        <span className="sr-only">이름·설명 검색</span>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름·설명 검색"
          className="h-9 w-full rounded-md border border-border bg-transparent pl-8 pr-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-indigo-500/50 focus-visible:ring-2 focus-visible:ring-indigo-500/20"
        />
      </label>

      <section className="space-y-3">
        <SectionTitle title="스킬" count={skills.length} />
        {skills.length === 0 ? (
          <Empty />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((s) => (
              <Card key={`${s.source}-${s.name}`} className="h-full">
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-words text-sm font-semibold">
                      {s.name}
                    </span>
                    <span className="shrink-0 rounded border border-border px-1.5 text-[11px] text-muted-foreground">
                      {skillSourceLabel(s.source)}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {s.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle title="플러그인" count={plugins.length} />
        {plugins.length === 0 ? (
          <Empty />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plugins.map((p) => (
              <Card key={`${p.marketplace}-${p.name}`} className="h-full">
                <CardContent className="space-y-2 p-4">
                  <div>
                    <span className="block break-words text-sm font-semibold">
                      {p.name}
                    </span>
                    <span className="block break-words text-[11px] text-muted-foreground">
                      {[p.version && `v${p.version}`, p.marketplace]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  {p.description && (
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {p.description}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    포함 스킬 {p.skillCount}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
