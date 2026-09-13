// 그록봇 목록 — 검색·카테고리 칩·카드 그리드·선택 삭제
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { GrokBotCard } from "@/components/grok-bots/grok-bot-card";
import { GrokBotComposer } from "@/components/grok-bots/grok-bot-composer";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  SearchSuggestInput,
  type SearchSuggestItem,
} from "@/components/ui/search-suggest-input";
import { Select } from "@/components/ui/select";
import { SelectionToolbar } from "@/components/ui/selection-toolbar";
import { useSelection } from "@/hooks/use-selection";
import { bulkDeleteByIds } from "@/lib/bulk-delete";
import { GROK_BOT_CATEGORY_ORDER, grokBotHaystack } from "@/lib/grok-bot";
import {
  compareIsoDesc,
  compareTitleAsc,
  DEFAULT_PAGE_SIZE,
  type ListSortKey,
  matchesSearchTokens,
  slicePage,
} from "@/lib/list-utils";
import type { GrokBot } from "@/lib/types";
import { cn } from "@/lib/utils";

const ALL = "__all__";
const FAVORITES = "__favorites__";
const FAVORITES_LABEL = "⭐ 즐겨찾기";

const SORT_OPTIONS: { value: ListSortKey; label: string }[] = [
  { value: "created_desc", label: "등록일 최신" },
  { value: "updated_desc", label: "수정일 최신" },
  { value: "title_asc", label: "제목 가나다" },
];

function compareBot(a: GrokBot, b: GrokBot, sort: ListSortKey): number {
  if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
  if (sort === "title_asc") return compareTitleAsc(a.name, b.name);
  if (sort === "updated_desc") {
    return compareIsoDesc(a.updatedAt, b.updatedAt);
  }
  return compareIsoDesc(a.createdAt, b.createdAt);
}

/** 그록봇 목록을 검색·칩·정렬·페이징한다. */
export function GrokBotList({ bots }: { bots: GrokBot[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ListSortKey>("created_desc");
  const [page, setPage] = useState(1);
  const [active, setActive] = useState(ALL);
  const [deleting, setDeleting] = useState(false);
  const [favoritingId, setFavoritingId] = useState<string | null>(null);

  const favoriteCount = useMemo(
    () => bots.filter((b) => b.isFavorite).length,
    [bots]
  );

  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    for (const b of bots) {
      const c = b.category?.trim();
      if (c) set.add(c);
    }
    return [...set];
  }, [bots]);

  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bots) {
      const c = b.category?.trim();
      if (!c) continue;
      map.set(c, (map.get(c) ?? 0) + 1);
    }
    const ordered: { label: string; count: number }[] = [];
    const seen = new Set<string>();
    for (const label of GROK_BOT_CATEGORY_ORDER) {
      const count = map.get(label);
      if (!count) continue;
      ordered.push({ label, count });
      seen.add(label);
    }
    const others = [...map.entries()]
      .filter(([label]) => !seen.has(label))
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label, "ko"));
    return [...ordered, ...others];
  }, [bots]);

  useEffect(() => {
    setPage(1);
  }, [query, sort, active]);

  const filtered = useMemo(() => {
    return bots
      .filter((b) => {
        if (active === FAVORITES && !b.isFavorite) return false;
        if (active !== ALL && active !== FAVORITES) {
          if ((b.category ?? "") !== active) return false;
        }
        return matchesSearchTokens(grokBotHaystack(b), query);
      })
      .sort((a, b) => compareBot(a, b, sort));
  }, [bots, query, sort, active]);

  const pageItems = useMemo(
    () => slicePage(filtered, page, DEFAULT_PAGE_SIZE),
    [filtered, page]
  );

  const suggestions = useMemo((): SearchSuggestItem[] => {
    const items: SearchSuggestItem[] = [];
    for (const b of bots) {
      if (b.name.trim()) {
        items.push({ value: b.name, label: b.name, group: "이름" });
      }
    }
    return items;
  }, [bots]);

  const ids = useMemo(() => pageItems.map((b) => b.id), [pageItems]);
  const selection = useSelection(ids);

  function handleChip(key: string) {
    setActive((prev) => (key === ALL ? ALL : prev === key ? ALL : key));
    selection.clear();
  }

  async function toggleFavorite(bot: GrokBot) {
    if (favoritingId) return;
    setFavoritingId(bot.id);
    try {
      const res = await fetch(`/api/grok-bots/${bot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !bot.isFavorite }),
      });
      if (res.ok) router.refresh();
    } finally {
      setFavoritingId(null);
    }
  }

  async function deleteSelected() {
    if (selection.selectedCount === 0) return;
    if (!confirm(`선택한 그록봇 ${selection.selectedCount}개를 삭제할까요?`)) {
      return;
    }
    setDeleting(true);
    try {
      const { ok, fail } = await bulkDeleteByIds(
        selection.selectedIds,
        (id) => `/api/grok-bots/${id}`
      );
      selection.clear();
      router.refresh();
      if (fail > 0) alert(`${ok}개 삭제, ${fail}개 실패`);
    } finally {
      setDeleting(false);
    }
  }

  const trueEmpty = bots.length === 0;
  const showSearch = bots.length > 0;

  return (
    <div className="space-y-4">
      <GrokBotComposer existingCategories={existingCategories} />

      {showSearch ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">
                검색 (이름·제작자·설명)
              </label>
              <SearchSuggestInput
                placeholder="예: 리서치 · 마케팅"
                value={query}
                onChange={setQuery}
                suggestions={suggestions}
              />
            </div>
            <div className="w-full space-y-1 sm:w-44">
              <label
                htmlFor="grok-bot-sort"
                className="text-xs text-muted-foreground"
              >
                정렬 (즐겨찾기 우선)
              </label>
              <Select
                id="grok-bot-sort"
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
          </div>

          {!trueEmpty && (
            <>
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  label="전체"
                  count={bots.length}
                  active={active === ALL}
                  onClick={() => handleChip(ALL)}
                />
                {favoriteCount > 0 && (
                  <FilterChip
                    label={FAVORITES_LABEL}
                    count={favoriteCount}
                    active={active === FAVORITES}
                    onClick={() => handleChip(FAVORITES)}
                  />
                )}
                {categoryStats.map((g) => (
                  <FilterChip
                    key={g.label}
                    label={g.label}
                    count={g.count}
                    active={active === g.label}
                    onClick={() => handleChip(g.label)}
                  />
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                전체 {bots.length}개 · 검색 결과 {filtered.length}개
              </p>

              <SelectionToolbar
                total={pageItems.length}
                selectedCount={selection.selectedCount}
                allSelected={selection.allSelected}
                someSelected={selection.someSelected}
                deleting={deleting}
                onToggleAll={selection.toggleAll}
                onDeleteSelected={() => void deleteSelected()}
              />

              {filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  조건에 맞는 그록봇이 없습니다.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pageItems.map((bot) => (
                    <GrokBotCard
                      key={bot.id}
                      bot={bot}
                      selected={selection.isSelected(bot.id)}
                      onToggleSelect={() => selection.toggle(bot.id)}
                      onToggleFavorite={() => void toggleFavorite(bot)}
                      favoriting={favoritingId === bot.id}
                    />
                  ))}
                </div>
              )}
              <ListPagination
                page={page}
                total={filtered.length}
                pageSize={DEFAULT_PAGE_SIZE}
                onChange={setPage}
              />
            </>
          )}
        </div>
      ) : null}

      {trueEmpty ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          첫 그록봇을 위에 추가하세요
        </div>
      ) : null}
    </div>
  );
}

/** 카테고리·즐겨찾기 필터 칩 */
function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-indigo-600/12 text-indigo-700 dark:bg-indigo-500/18 dark:text-indigo-300"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "rounded px-1 text-[10px] tabular-nums",
          active ? "bg-indigo-600/20" : "bg-muted"
        )}
      >
        {count}
      </span>
    </button>
  );
}
