"use client";
// 설치 현황 뷰 — 모델 탭(?tool=) + 검색 + 스킬·플러그인 구역
import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  HEAVY_USE,
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

/** 많이 쓴 항목 카드의 강조 색(amber). 기본 카드 hover 테두리도 amber 로 덮는다 */
function usageCardClass(uses: number) {
  return uses >= HEAVY_USE
    ? "border-amber-500/60 bg-amber-50 hover:border-amber-500 dark:border-amber-400/40 dark:bg-amber-400/10 dark:hover:border-amber-400/70"
    : undefined;
}

/** 사용 횟수 배지. 색에만 기대지 않도록 자주 쓴 항목은 '자주' 글자를 붙인다 */
function UsesBadge({ uses }: { uses: number }) {
  if (uses < 1) return null;
  const heavy = uses >= HEAVY_USE;
  return (
    <span
      className={cn(
        "shrink-0 rounded border px-1.5 text-[11px] tabular-nums",
        heavy
          ? "border-amber-400 bg-amber-100 font-medium text-amber-900 dark:border-amber-400/50 dark:bg-amber-400/15 dark:text-amber-200"
          : "border-border text-muted-foreground"
      )}
    >
      {heavy ? `자주 ${uses}회` : `${uses}회`}
    </span>
  );
}

/** 카드 설명. 한글 번역이 있으면 한글을 먼저, 영어 원문을 그 아래 흐리게 둔다 */
function Description({ text, ko }: { text: string; ko?: string }) {
  if (!ko) {
    return (
      <p className="line-clamp-2 break-words text-xs leading-relaxed text-muted-foreground">
        {text}
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <p className="line-clamp-2 break-words text-xs leading-relaxed text-muted-foreground">
        {ko}
      </p>
      <p
        lang="en"
        className="line-clamp-2 break-words text-[11px] leading-relaxed text-muted-foreground opacity-70"
      >
        {text}
      </p>
    </div>
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
  const skills =
    active?.skills.filter((s) =>
      matches(q, s.name, s.description, s.descriptionKo ?? "")
    ) ?? [];
  const plugins =
    active?.plugins.filter((p) =>
      matches(q, p.name, p.description, p.descriptionKo ?? "")
    ) ?? [];

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

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span
          aria-hidden
          className="inline-block h-2.5 w-2.5 rounded-sm border border-amber-500/60 bg-amber-100 dark:border-amber-400/50 dark:bg-amber-400/20"
        />
        자주 사용 = {HEAVY_USE}회 이상
      </p>

      <section className="space-y-3">
        <SectionTitle title="스킬" count={skills.length} />
        {skills.length === 0 ? (
          <Empty />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((s) => (
              <Card
                key={`${s.source}-${s.name}`}
                className={cn("h-full", usageCardClass(s.uses))}
              >
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-words text-sm font-semibold">
                      {s.name}
                    </span>
                    <div className="flex shrink-0 gap-1">
                      <UsesBadge uses={s.uses} />
                      <span className="rounded border border-border px-1.5 text-[11px] text-muted-foreground">
                        {skillSourceLabel(s.source)}
                      </span>
                    </div>
                  </div>
                  <Description text={s.description} ko={s.descriptionKo} />
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
              <Card
                key={`${p.marketplace}-${p.name}`}
                className={cn("h-full", usageCardClass(p.uses))}
              >
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="block break-words text-sm font-semibold">
                        {p.name}
                      </span>
                      <span className="block break-words text-[11px] text-muted-foreground">
                        {[p.version && `v${p.version}`, p.marketplace]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                    <UsesBadge uses={p.uses} />
                  </div>
                  {p.description && (
                    <Description text={p.description} ko={p.descriptionKo} />
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
