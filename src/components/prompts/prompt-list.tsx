// 프롬프트 라이브러리 목록 — 상위 그룹 필터·접이식 섹션·즐겨찾기
"use client";

import {
  ChevronDown,
  Copy,
  MessageSquareText,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Prompt } from "@/lib/types";
import { useSelection } from "@/hooks/use-selection";
import { bulkDeleteByIds } from "@/lib/bulk-delete";
import {
  compareIsoDesc,
  compareTitleAsc,
  DEFAULT_PAGE_SIZE,
  formatListDate,
  type ListSortKey,
  matchesSearchTokens,
  slicePage,
} from "@/lib/list-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  SearchSuggestInput,
  type SearchSuggestItem,
} from "@/components/ui/search-suggest-input";
import { Select } from "@/components/ui/select";
import { SelectionToolbar } from "@/components/ui/selection-toolbar";
import { cn } from "@/lib/utils";

const SORT_OPTIONS: { value: ListSortKey; label: string }[] = [
  { value: "created_desc", label: "등록일 최신" },
  { value: "updated_desc", label: "수정일 최신" },
  { value: "title_asc", label: "제목 가나다" },
];

const ALL = "__all__";
const UNCATEGORIZED = "미분류";
const FAVORITES = "⭐ 즐겨찾기";
const countFormatter = new Intl.NumberFormat("ko-KR");

function formatCount(count: number): string {
  return countFormatter.format(count);
}

/** 목차 라벨 정규화 (빈 값 → 미분류) */
function categoryLabel(p: Prompt): string {
  return p.category?.trim() || UNCATEGORIZED;
}

/**
 * 상위 그룹 키 — 칩 폭증 방지.
 * - "GPT공식 · 마케팅" → "GPT공식"
 * - "클로드 · 후킹 문장" → "클로드"
 * - "1-2. 미팅…" → "일잘러 · 1"
 */
function categoryGroup(label: string): string {
  if (label === UNCATEGORIZED) return UNCATEGORIZED;
  const sep = label.indexOf(" · ");
  if (sep > 0) return label.slice(0, sep).trim();
  const m = label.match(/^(\d+)-\d+\./);
  if (m) return `일잘러 · ${m[1]}`;
  return label;
}

/** 그룹 표시 이름 */
function groupDisplayName(group: string): string {
  if (group.startsWith("일잘러 · ")) {
    const n = group.replace("일잘러 · ", "");
    const map: Record<string, string> = {
      "1": "일잘러 1 · 시작/미팅",
      "2": "일잘러 2 · 보고서·기획",
      "3": "일잘러 3 · 마감·판단",
      "4": "일잘러 4 · 일상",
    };
    return map[n] ?? group;
  }
  return group;
}

/**
 * 목차 정렬: "1-1.", "2-10." 숫자 자연순. 미분류는 맨 뒤.
 */
function compareCategory(a: string, b: string): number {
  if (a === UNCATEGORIZED && b !== UNCATEGORIZED) return 1;
  if (b === UNCATEGORIZED && a !== UNCATEGORIZED) return -1;
  return a.localeCompare(b, "ko", { numeric: true, sensitivity: "base" });
}

function compareGroup(a: string, b: string): number {
  return compareCategory(a, b);
}

/** 즐겨찾기 우선 → 선택 정렬 */
function comparePrompt(a: Prompt, b: Prompt, sort: ListSortKey): number {
  if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
  if (sort === "title_asc") return compareTitleAsc(a.title, b.title);
  if (sort === "updated_desc") {
    return compareIsoDesc(a.updatedAt, b.updatedAt);
  }
  return compareIsoDesc(a.createdAt, b.createdAt);
}

/** 프롬프트 목록 UI */
export function PromptList({ prompts }: { prompts: Prompt[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<ListSortKey>("created_desc");
  const [page, setPage] = useState(1);
  /** 상위 그룹 필터 (GPT공식 / 클로드 / 일잘러 · n …) */
  const [activeGroup, setActiveGroup] = useState(ALL);
  /** 세부 카테고리 필터 (그룹 내) */
  const [activeCat, setActiveCat] = useState(ALL);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [favoritingId, setFavoritingId] = useState<string | null>(null);
  /** 접이식 섹션 — 기본 접힘, 즐겨찾기만 펼침 */
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set([FAVORITES])
  );

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of prompts) {
      const c = categoryLabel(p);
      map.set(c, (map.get(c) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => compareCategory(a[0], b[0]))
      .map(([label, count]) => ({ label, count }));
  }, [prompts]);

  /** 상위 그룹 집계 (칩 수 축소) */
  const groupsMeta = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of categories) {
      const g = categoryGroup(c.label);
      map.set(g, (map.get(g) ?? 0) + c.count);
    }
    return [...map.entries()]
      .sort((a, b) =>
        compareGroup(groupDisplayName(a[0]), groupDisplayName(b[0]))
      )
      .map(([key, count]) => ({
        key,
        label: groupDisplayName(key),
        count,
      }));
  }, [categories]);

  /** 현재 그룹에 속한 세부 카테고리 */
  const subCategories = useMemo(() => {
    if (activeGroup === ALL) return [];
    return categories.filter((c) => categoryGroup(c.label) === activeGroup);
  }, [categories, activeGroup]);

  // 그룹 변경 시 세부 카테고리 초기화
  useEffect(() => {
    setActiveCat(ALL);
  }, [activeGroup]);

  // 검색·필터·정렬 변경 시 1페이지로
  useEffect(() => {
    setPage(1);
  }, [q, sort, activeGroup, activeCat]);

  // 필터 후 정렬
  const filtered = useMemo(() => {
    return prompts
      .filter((p) => {
        const cat = categoryLabel(p);
        const group = categoryGroup(cat);
        if (activeGroup !== ALL && group !== activeGroup) return false;
        if (activeCat !== ALL && cat !== activeCat) return false;
        const hay = [
          p.title,
          p.category ?? "",
          p.summary ?? "",
          p.whenToUse ?? "",
          ...p.sections.flatMap((s) => [s.title, s.body]),
        ].join(" ");
        return matchesSearchTokens(hay, q);
      })
      .sort((a, b) => comparePrompt(a, b, sort));
  }, [prompts, q, activeGroup, activeCat, sort]);

  /** 현재 페이지에 표시할 항목 (필터 결과 슬라이스) */
  const pageItems = useMemo(
    () => slicePage(filtered, page, DEFAULT_PAGE_SIZE),
    [filtered, page]
  );

  /**
   * 섹션 그룹:
   * - 세부 카테고리 미선택: 즐겨찾기 + 목차별 (접이식)
   * - 세부 카테고리 선택: 단일 섹션
   * 페이징된 pageItems 기준으로 그룹핑
   */
  const groups = useMemo(() => {
    const singleSection = activeCat !== ALL;
    if (singleSection) {
      return [
        {
          label: activeCat,
          items: pageItems,
          isFavoriteGroup: false,
        },
      ];
    }
    const favs = pageItems.filter((p) => p.isFavorite);
    const rest = pageItems.filter((p) => !p.isFavorite);
    const map = new Map<string, Prompt[]>();
    for (const p of rest) {
      const c = categoryLabel(p);
      const list = map.get(c);
      if (list) list.push(p);
      else map.set(c, [p]);
    }
    const catGroups = [...map.entries()]
      .sort((a, b) => compareCategory(a[0], b[0]))
      .map(([label, items]) => ({ label, items, isFavoriteGroup: false }));
    if (favs.length > 0) {
      return [
        { label: FAVORITES, items: favs, isFavoriteGroup: true },
        ...catGroups,
      ];
    }
    return catGroups;
  }, [pageItems, activeCat]);

  const showSectionHeaders = activeCat === ALL && groups.length > 1;
  const hasActiveFilter = activeGroup !== ALL || activeCat !== ALL;

  function toggleSection(label: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function clearFilters() {
    setActiveGroup(ALL);
    setActiveCat(ALL);
  }

  const suggestions = useMemo((): SearchSuggestItem[] => {
    const items: SearchSuggestItem[] = [];
    for (const p of prompts) {
      if (p.title.trim()) {
        items.push({ value: p.title, label: p.title, group: "제목" });
      }
      if (p.category?.trim()) {
        items.push({
          value: p.category.trim(),
          label: p.category.trim(),
          group: "목차",
        });
      }
    }
    return items;
  }, [prompts]);

  const ids = useMemo(() => pageItems.map((p) => p.id), [pageItems]);
  const selection = useSelection(ids);

  async function deleteSelected() {
    if (selection.selectedCount === 0) return;
    if (
      !confirm(`선택한 프롬프트 ${selection.selectedCount}개를 삭제할까요?`)
    ) {
      return;
    }
    setDeleting(true);
    try {
      const { ok, fail } = await bulkDeleteByIds(
        selection.selectedIds,
        (id) => `/api/prompts/${id}`
      );
      selection.clear();
      router.refresh();
      if (fail > 0) alert(`${ok}개 삭제, ${fail}개 실패`);
    } finally {
      setDeleting(false);
    }
  }

  async function copyAll(p: Prompt) {
    const text = p.sections
      .map((s) => `## ${s.title}\n\n${s.body}`)
      .join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(p.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      alert("복사에 실패했습니다.");
    }
  }

  /** 즐겨찾기 on/off */
  async function toggleFavorite(p: Prompt) {
    if (favoritingId) return;
    setFavoritingId(p.id);
    try {
      const res = await fetch(`/api/prompts/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !p.isFavorite }),
      });
      if (res.ok) router.refresh();
    } finally {
      setFavoritingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-[200px] max-w-md flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">
            검색 (제목·목차·본문 · 공백 AND)
          </label>
          <SearchSuggestInput
            placeholder="예: Muse 광고 · 버그 찾기"
            value={q}
            onChange={setQ}
            suggestions={suggestions}
          />
        </div>
        <div className="w-full space-y-1 sm:w-44">
          <label
            htmlFor="prompt-sort"
            className="text-xs text-muted-foreground"
          >
            정렬 (즐겨찾기 우선)
          </label>
          <Select
            id="prompt-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as ListSortKey)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <Link
          href="/prompts/new"
          className="mt-auto inline-flex h-9 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" />
          새 프롬프트
        </Link>
      </div>

      {/* 상위 그룹만 한 줄 스크롤 — 세부 29개를 한꺼번에 펼치지 않음 */}
      {groupsMeta.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              카테고리 그룹
            </p>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
                필터 초기화
              </button>
            )}
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
            <FilterChip
              label={`전체 (${formatCount(prompts.length)})`}
              active={activeGroup === ALL}
              onClick={() => setActiveGroup(ALL)}
              tone="indigo"
            />
            {groupsMeta.map((g) => (
              <FilterChip
                key={g.key}
                label={`${g.label} (${formatCount(g.count)})`}
                active={activeGroup === g.key}
                onClick={() =>
                  setActiveGroup((prev) => (prev === g.key ? ALL : g.key))
                }
                tone="amber"
              />
            ))}
          </div>

          {/* 그룹 선택 시에만 세부 카테고리 한 줄 표시 */}
          {activeGroup !== ALL && subCategories.length > 0 && (
            <div className="rounded-lg border border-border/70 bg-muted/30 p-2">
              <p className="mb-1.5 text-[11px] text-muted-foreground">
                {groupDisplayName(activeGroup)} · 세부
              </p>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
                <FilterChip
                  label={`그룹 전체 (${formatCount(subCategories.reduce((s, c) => s + c.count, 0))})`}
                  active={activeCat === ALL}
                  onClick={() => setActiveCat(ALL)}
                  tone="indigo"
                  compact
                />
                {subCategories.map((c) => (
                  <FilterChip
                    key={c.label}
                    label={`${shortCatLabel(c.label, activeGroup)} (${formatCount(c.count)})`}
                    active={activeCat === c.label}
                    onClick={() =>
                      setActiveCat((prev) =>
                        prev === c.label ? ALL : c.label
                      )
                    }
                    tone="amber"
                    compact
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {prompts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          등록된 프롬프트가 없습니다. 새 프롬프트를 만들어 보세요.
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          조건에 맞는 프롬프트가 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              검색 결과 {formatCount(filtered.length)}개
              {filtered.length > DEFAULT_PAGE_SIZE
                ? ` · 이 페이지 ${formatCount(pageItems.length)}개`
                : ""}
              {hasActiveFilter ? " · 필터 적용 중" : ""}
              {showSectionHeaders
                ? " · 섹션을 눌러 펼치기"
                : ""}
            </p>
            {showSectionHeaders && (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() =>
                    setExpanded(new Set(groups.map((g) => g.label)))
                  }
                >
                  모두 펼치기
                </button>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setExpanded(new Set([FAVORITES]))}
                >
                  모두 접기
                </button>
              </div>
            )}
          </div>

          <SelectionToolbar
            total={pageItems.length}
            selectedCount={selection.selectedCount}
            allSelected={selection.allSelected}
            someSelected={selection.someSelected}
            deleting={deleting}
            onToggleAll={selection.toggleAll}
            onDeleteSelected={() => void deleteSelected()}
          />

          {groups.map((group) => {
            const isOpen =
              !showSectionHeaders ||
              expanded.has(group.label) ||
              // 섹션이 하나뿐이면 항상 펼침
              groups.length === 1;
            const showCatBadge =
              group.isFavoriteGroup || !showSectionHeaders;

            return (
              <section
                key={group.label}
                className="overflow-hidden rounded-xl border border-border/80"
              >
                {showSectionHeaders ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(group.label)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                      group.isFavoriteGroup
                        ? "bg-amber-500/5"
                        : "bg-muted/20"
                    )}
                    aria-expanded={isOpen}
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        !isOpen && "-rotate-90"
                      )}
                    />
                    <h2
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm font-semibold tracking-tight",
                        group.isFavoriteGroup
                          ? "text-amber-800 dark:text-amber-200"
                          : "text-foreground"
                      )}
                    >
                      {group.label}
                    </h2>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {formatCount(group.items.length)}
                    </span>
                  </button>
                ) : null}

                {isOpen && (
                  <div
                    className={cn(
                      "grid gap-3 p-3 sm:grid-cols-2",
                      showSectionHeaders && "border-t border-border/60"
                    )}
                  >
                    {group.items.map((p) => {
                      const selected = selection.isSelected(p.id);
                      const cat = categoryLabel(p);
                      return (
                        <Card
                          key={p.id}
                          className={cn(
                            "group transition-colors hover:border-border",
                            selected &&
                              "border-indigo-500 ring-1 ring-indigo-500/40",
                            p.isFavorite && "border-amber-500/40"
                          )}
                        >
                          <CardContent className="flex items-start gap-3 p-4">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
                              checked={selected}
                              onChange={() => selection.toggle(p.id)}
                              aria-label={`${p.title} 선택`}
                            />
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-600/15 text-violet-600 dark:text-violet-300">
                              <MessageSquareText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1 space-y-1.5">
                              {showCatBadge && cat !== UNCATEGORIZED && (
                                <Badge
                                  variant="outline"
                                  className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                                >
                                  {cat}
                                </Badge>
                              )}
                              <Link
                                href={`/prompts/${p.id}`}
                                className="block font-medium leading-snug hover:text-indigo-500"
                              >
                                {p.title}
                              </Link>
                              {p.whenToUse && (
                                <p className="line-clamp-2 text-xs text-muted-foreground">
                                  {p.whenToUse}
                                </p>
                              )}
                              <p className="text-[11px] text-muted-foreground">
                                섹션 {p.sections.length}
                                {p.sections.length > 1 ? " (1·2차)" : ""}
                                {" · "}
                                등록 {formatListDate(p.createdAt)}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-col gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  p.isFavorite
                                    ? "text-amber-500"
                                    : "text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                                )}
                                title={
                                  p.isFavorite
                                    ? "즐겨찾기 해제"
                                    : "즐겨찾기"
                                }
                                aria-label={
                                  p.isFavorite
                                    ? "즐겨찾기 해제"
                                    : "즐겨찾기"
                                }
                                aria-pressed={p.isFavorite}
                                disabled={favoritingId === p.id}
                                onClick={() => void toggleFavorite(p)}
                              >
                                <Star
                                  className={cn(
                                    "h-4 w-4",
                                    p.isFavorite && "fill-current"
                                  )}
                                />
                              </Button>
                              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="전체 복사"
                                  aria-label="전체 복사"
                                  onClick={() => void copyAll(p)}
                                >
                                  <Copy
                                    className={cn(
                                      "h-4 w-4",
                                      copiedId === p.id && "text-emerald-500"
                                    )}
                                  />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-400"
                                  aria-label="삭제"
                                  onClick={async () => {
                                    if (
                                      !confirm("이 프롬프트를 삭제할까요?")
                                    )
                                      return;
                                    const res = await fetch(
                                      `/api/prompts/${p.id}`,
                                      { method: "DELETE" }
                                    );
                                    if (res.ok) router.refresh();
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}

          <ListPagination
            page={page}
            total={filtered.length}
            pageSize={DEFAULT_PAGE_SIZE}
            onChange={setPage}
          />
        </div>
      )}
    </div>
  );
}

/** 그룹/세부 필터 칩 (가로 스크롤용 shrink-0) */
function FilterChip({
  label,
  active,
  onClick,
  tone,
  compact,
  title,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone: "indigo" | "amber";
  compact?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border font-medium transition-colors whitespace-nowrap",
        compact ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        active
          ? tone === "indigo"
            ? "border-indigo-500/50 bg-indigo-600/15 text-indigo-700 dark:text-indigo-300"
            : "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200"
          : "border-border text-muted-foreground hover:bg-muted"
      )}
    >
      {label}
    </button>
  );
}

/** 세부 칩에서 그룹 접두어를 짧게 표시 */
function shortCatLabel(full: string, group: string): string {
  if (full.startsWith(group + " · ")) {
    return full.slice(group.length + 3);
  }
  // 일잘러 1-2. 제목 → 1-2. 제목 유지(이미 짧음)
  return full;
}
