// 프롬프트 라이브러리 목록 — 큰 검색창 + 카테고리 칩 + 카드 그리드 + 팝업 상세
"use client";

import { Copy, Plus, Star, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { ListPagination } from "@/components/ui/list-pagination";
import { PromptModal } from "@/components/prompts/prompt-modal";
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

/** 세부 칩에서 그룹 접두어를 짧게 표시 */
function shortCatLabel(full: string, group: string): string {
  if (full.startsWith(group + " · ")) {
    return full.slice(group.length + 3);
  }
  // 일잘러 1-2. 제목 → 1-2. 제목 유지(이미 짧음)
  return full;
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
  /** 팝업으로 열려 있는 프롬프트 id */
  const [openId, setOpenId] = useState<string | null>(null);

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

  /** 검색어 변경 — 1페이지로 리셋 */
  function updateQuery(next: string) {
    setQ(next);
    setPage(1);
  }

  /** 정렬 변경 — 1페이지로 리셋 */
  function updateSort(next: ListSortKey) {
    setSort(next);
    setPage(1);
  }

  /** 상위 그룹 변경 — 세부 카테고리·1페이지 리셋 */
  function updateGroup(next: string) {
    setActiveGroup(next);
    setActiveCat(ALL);
    setPage(1);
  }

  /** 세부 카테고리 변경 — 1페이지로 리셋 */
  function updateCat(next: string) {
    setActiveCat(next);
    setPage(1);
  }

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

  const hasActiveFilter = activeGroup !== ALL || activeCat !== ALL;

  /** 팝업에 표시할 프롬프트 — prompts가 갱신되면 즐겨찾기 등 변경사항도 함께 반영 */
  const openPrompt = useMemo(
    () => prompts.find((p) => p.id === openId) ?? null,
    [prompts, openId]
  );

  function clearFilters() {
    setActiveGroup(ALL);
    setActiveCat(ALL);
    setPage(1);
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

  /** 첫 섹션 본문만 복사 (카드 미리보기 복사 버튼) */
  async function copyFirstSection(p: Prompt) {
    const text = p.sections[0]?.body ?? "";
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
      {/* 상단 독립 검색창 */}
      <div className="mx-auto w-full max-w-2xl">
        <SearchSuggestInput
          placeholder="프롬프트 검색…"
          value={q}
          onChange={updateQuery}
          suggestions={suggestions}
          inputClassName="h-11 text-sm"
        />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          검색 결과 {formatCount(filtered.length)}개
          {filtered.length > DEFAULT_PAGE_SIZE
            ? ` · 이 페이지 ${formatCount(pageItems.length)}개`
            : ""}
          {hasActiveFilter ? " · 필터 적용 중" : ""}
        </p>
        <div className="flex items-end gap-2">
          <div className="w-40 space-y-1">
            <label
              htmlFor="prompt-sort"
              className="text-xs text-muted-foreground"
            >
              정렬 (즐겨찾기 우선)
            </label>
            <Select
              id="prompt-sort"
              value={sort}
              onChange={(e) => updateSort(e.target.value as ListSortKey)}
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
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            새 프롬프트
          </Link>
        </div>
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
              onClick={() => updateGroup(ALL)}
            />
            {groupsMeta.map((g) => (
              <FilterChip
                key={g.key}
                label={`${g.label} (${formatCount(g.count)})`}
                active={activeGroup === g.key}
                onClick={() =>
                  updateGroup(activeGroup === g.key ? ALL : g.key)
                }
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
                  onClick={() => updateCat(ALL)}
                  compact
                />
                {subCategories.map((c) => (
                  <FilterChip
                    key={c.label}
                    label={`${shortCatLabel(c.label, activeGroup)} (${formatCount(c.count)})`}
                    active={activeCat === c.label}
                    onClick={() =>
                      updateCat(activeCat === c.label ? ALL : c.label)
                    }
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
          <SelectionToolbar
            total={pageItems.length}
            selectedCount={selection.selectedCount}
            allSelected={selection.allSelected}
            someSelected={selection.someSelected}
            deleting={deleting}
            onToggleAll={selection.toggleAll}
            onDeleteSelected={() => void deleteSelected()}
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pageItems.map((p) => (
              <PromptCard
                key={p.id}
                prompt={p}
                cat={categoryLabel(p)}
                catShort={shortCatLabel(
                  categoryLabel(p),
                  categoryGroup(categoryLabel(p))
                )}
                selected={selection.isSelected(p.id)}
                onToggleSelect={() => selection.toggle(p.id)}
                favoriting={favoritingId === p.id}
                onToggleFavorite={() => void toggleFavorite(p)}
                copied={copiedId === p.id}
                onCopy={() => void copyFirstSection(p)}
                onOpen={() => setOpenId(p.id)}
              />
            ))}
          </div>

          <ListPagination
            page={page}
            total={filtered.length}
            pageSize={DEFAULT_PAGE_SIZE}
            onChange={setPage}
          />
        </div>
      )}

      <PromptModal
        prompt={openPrompt}
        onClose={() => setOpenId(null)}
        onDeleted={() => {
          setOpenId(null);
          router.refresh();
        }}
      />
    </div>
  );
}

/** 그룹/세부 필터 칩 (가로 스크롤용 shrink-0, PromptLib 스타일 pill) */
function FilterChip({
  label,
  active,
  onClick,
  compact,
  title,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
        compact ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        active
          ? "border-indigo-500/50 bg-indigo-600 text-white"
          : "border-border text-muted-foreground hover:bg-muted"
      )}
    >
      {label}
    </button>
  );
}

/** 카드 하나 — 전체 클릭 시 팝업, 체크박스·별·복사는 클릭 전파 차단 */
function PromptCard({
  prompt: p,
  cat,
  catShort,
  selected,
  onToggleSelect,
  favoriting,
  onToggleFavorite,
  copied,
  onCopy,
  onOpen,
}: {
  prompt: Prompt;
  cat: string;
  catShort: string;
  selected: boolean;
  onToggleSelect: () => void;
  favoriting: boolean;
  onToggleFavorite: () => void;
  copied: boolean;
  onCopy: () => void;
  onOpen: () => void;
}) {
  const preview = p.sections[0]?.body ?? "";

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        // 체크박스·별·복사 버튼에서 온 키 이벤트는 각자 기본 동작에 맡긴다
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "group relative cursor-pointer transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
        selected && "border-indigo-500 ring-1 ring-indigo-500/40",
        p.isFavorite && "border-amber-500/40"
      )}
    >
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          {cat !== UNCATEGORIZED ? (
            <Badge
              variant="outline"
              className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
            >
              {catShort}
            </Badge>
          ) : (
            <span />
          )}
          <div className="flex shrink-0 items-center gap-1">
            <input
              type="checkbox"
              className="h-4 w-4 accent-indigo-600"
              checked={selected}
              onClick={(e) => e.stopPropagation()}
              onChange={onToggleSelect}
              aria-label={`${p.title} 선택`}
            />
            <button
              type="button"
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                p.isFavorite
                  ? "text-amber-500"
                  : "text-muted-foreground hover:text-amber-500"
              )}
              title={p.isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
              aria-label={p.isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
              aria-pressed={p.isFavorite}
              disabled={favoriting}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
            >
              <Star
                className={cn("h-4 w-4", p.isFavorite && "fill-current")}
              />
            </button>
          </div>
        </div>

        <p className="text-base font-semibold leading-snug group-hover:text-indigo-500">
          {p.title}
        </p>

        {p.summary && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {p.summary}
          </p>
        )}

        <div className="relative overflow-hidden rounded-lg border border-border bg-muted/40 p-3">
          <p className="line-clamp-5 whitespace-pre-wrap font-mono text-xs text-foreground/80">
            {preview || "(내용 없음)"}
          </p>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-background to-transparent" />
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-[11px] text-muted-foreground">
            섹션 {p.sections.length} · 등록 {formatListDate(p.createdAt)}
          </p>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            title="첫 섹션 복사"
            aria-label="첫 섹션 복사"
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
            }}
          >
            <Copy
              className={cn("h-4 w-4", copied && "text-emerald-500")}
            />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
