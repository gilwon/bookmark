"use client";
// 설치 현황 뷰 — 모델 탭(?tool=) + 검색 + 정렬(?sort=) + 스킬·플러그인 구역
import { Check, Copy, Download, ExternalLink, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  HEAVY_USE,
  SORT_MODES,
  parseSortMode,
  skillSourceLabel,
  sortItems,
  type InstalledTool,
  type SortMode,
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

/** 카드 하단 액션 버튼·링크 공통 모양. 터치 타겟 36px, hover·포커스 링 포함 */
const actionClass =
  "inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-indigo-500/40 hover:bg-indigo-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background";

/**
 * 출처 액션 묶음. GitHub 링크, 설치 명령 복사, ZIP 다운로드를 있는 것만 보인다.
 * 복사 상태는 카드마다 따로 둔다. 복사에 실패하면 명령을 선택 가능한 블록으로 펼친다
 */
function SourceActions({
  repoUrl,
  installCommands,
  zipKey,
}: {
  repoUrl?: string;
  installCommands?: string[];
  zipKey?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 언마운트 때 남은 타이머를 지운다
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!repoUrl && !installCommands?.length && !zipKey) return null;
  const text = installCommands?.join("\n") ?? "";

  async function copy() {
    try {
      // 비보안 컨텍스트에서는 clipboard 자체가 없어 실패로 본다
      if (!navigator.clipboard) throw new Error("clipboard 없음");
      await navigator.clipboard.writeText(text);
      setFailed(false);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="space-y-2 pt-1">
      <div className="flex flex-wrap gap-2">
        {repoUrl && (
          <a href={repoUrl} target="_blank" rel="noopener noreferrer" className={actionClass}>
            <ExternalLink aria-hidden className="h-3.5 w-3.5" />
            GitHub
            <span className="sr-only">(새 탭)</span>
          </a>
        )}
        {installCommands?.length ? (
          <button type="button" onClick={copy} className={actionClass}>
            {copied ? (
              <Check aria-hidden className="h-3.5 w-3.5" />
            ) : (
              <Copy aria-hidden className="h-3.5 w-3.5" />
            )}
            <span aria-live="polite">{copied ? "복사됨" : "설치 명령 복사"}</span>
          </button>
        ) : null}
        {zipKey && (
          <a
            href={`/api/installed-tools/download?key=${encodeURIComponent(zipKey)}`}
            className={actionClass}
          >
            <Download aria-hidden className="h-3.5 w-3.5" />
            ZIP 다운로드
          </a>
        )}
      </div>
      {failed && (
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground">
            복사하지 못했습니다. 아래 명령을 직접 선택해 복사하세요.
          </p>
          <pre className="select-all overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-border bg-muted px-2 py-1.5 font-mono text-[11px] text-foreground">
            {text}
          </pre>
        </div>
      )}
    </div>
  );
}

export function InstalledToolsView({
  tools,
  activeId,
  sortMode,
}: {
  tools: InstalledTool[];
  activeId: string;
  sortMode: SortMode;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  // URL 왕복을 기다리지 않고 바로 다시 정렬하도록 로컬 상태로 들고, URL 에도 적는다
  const [sort, setSort] = useState(sortMode);
  const active = tools.find((t) => t.id === activeId) ?? tools[0];
  const q = query.trim().toLowerCase();
  const skills = sortItems(
    active?.skills.filter((s) =>
      matches(q, s.name, s.description, s.descriptionKo ?? "")
    ) ?? [],
    sort
  );
  const plugins = sortItems(
    active?.plugins.filter((p) =>
      matches(q, p.name, p.description, p.descriptionKo ?? "")
    ) ?? [],
    sort
  );

  /** 탭 링크·정렬 변경에 쓰는 쿼리. 기본 정렬(이름순)은 URL 에서 뺀다 */
  function queryFor(tool: string, sort: SortMode): Record<string, string> {
    return sort === "name" ? { tool } : { tool, sort };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {tools.map((t) => {
          const on = t.id === active?.id;
          return (
            <Link
              key={t.id}
              href={{ pathname: "/installed-tools", query: queryFor(t.id, sort) }}
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

      {/* 검색창과 정렬. 좁은 화면에서는 정렬이 아랫줄로 내려간다 */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative block w-full max-w-md">
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
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          정렬
          <select
            value={sort}
            onChange={(e) => {
              const next = parseSortMode(e.target.value);
              setSort(next);
              const params = new URLSearchParams(queryFor(active?.id ?? activeId, next));
              // 쿼리만 바꾸고 스크롤 위치는 그대로 둔다
              router.replace(`/installed-tools?${params}`, { scroll: false });
            }}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none transition-colors focus-visible:border-indigo-500/50 focus-visible:ring-2 focus-visible:ring-indigo-500/20"
          >
            {SORT_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

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
                  <SourceActions
                    repoUrl={s.repoUrl}
                    installCommands={s.installCommands}
                    zipKey={s.zipKey}
                  />
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
                  <SourceActions
                    repoUrl={p.repoUrl}
                    installCommands={p.installCommands}
                    zipKey={p.zipKey}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
