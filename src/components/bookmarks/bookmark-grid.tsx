// 북마크 반응형 그리드 — 검색 + 카테고리 필터/그룹 + 선택 삭제
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Bookmark } from "@/lib/types";
import { useSelection } from "@/hooks/use-selection";
import { bulkDeleteByIds } from "@/lib/bulk-delete";
import {
  SearchSuggestInput,
  type SearchSuggestItem,
} from "@/components/ui/search-suggest-input";
import { SelectionToolbar } from "@/components/ui/selection-toolbar";
import { cn } from "@/lib/utils";
import { BookmarkCard } from "./bookmark-card";

/** 카테고리 없음 표시용 키 */
const UNCATEGORIZED = "__uncategorized__";
const ALL = "__all__";
const FAVORITES = "__favorites__";

function categoryKey(b: Bookmark): string {
  const c = b.category?.trim();
  return c ? c : UNCATEGORIZED;
}

function categoryLabel(key: string): string {
  if (key === FAVORITES) return "⭐ 즐겨찾기";
  return key === UNCATEGORIZED ? "미분류" : key;
}

/** 즐겨찾기 우선, 그다음 최신(createdAt desc) */
function compareBookmark(a: Bookmark, b: Bookmark): number {
  if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
  return b.createdAt.localeCompare(a.createdAt);
}

/** 제목·URL·설명·태그·카테고리 텍스트 매칭 */
function matchesBookmarkQuery(b: Bookmark, needle: string): boolean {
  if (!needle) return true;
  const hay = [
    b.title,
    b.url,
    b.description ?? "",
    b.category ?? "",
    ...b.tags,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

/** 1/2/3 컬럼 그리드 + 검색 + 카테고리별 필터·섹션 보기 */
export function BookmarkGrid({ bookmarks }: { bookmarks: Bookmark[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState<string>(ALL);
  const [deleting, setDeleting] = useState(false);

  /** 카테고리별 개수 (이름 정렬, 미분류는 맨 뒤) */
  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bookmarks) {
      const k = categoryKey(b);
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    const keys = [...map.keys()].sort((a, b) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return a.localeCompare(b, "ko");
    });
    return keys.map((key) => ({
      key,
      label: categoryLabel(key),
      count: map.get(key)!,
    }));
  }, [bookmarks]);

  /** 검색 suggest — 제목 · 카테고리 · 태그 · 도메인 */
  const searchSuggestions = useMemo((): SearchSuggestItem[] => {
    const items: SearchSuggestItem[] = [];
    for (const b of bookmarks) {
      if (b.title?.trim()) {
        items.push({ value: b.title.trim(), label: b.title.trim(), group: "제목" });
      }
      const cat = b.category?.trim();
      if (cat) items.push({ value: cat, label: cat, group: "카테고리" });
      for (const tag of b.tags) {
        const t = tag.trim();
        if (t) items.push({ value: t, label: t, group: "태그" });
      }
      try {
        const host = new URL(b.url).hostname.replace(/^www\./, "");
        if (host) items.push({ value: host, label: host, group: "도메인" });
      } catch {
        /* ignore */
      }
    }
    return items;
  }, [bookmarks]);

  /** 검색 + 카테고리 필터, 즐겨찾기 우선 정렬 */
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return bookmarks
      .filter((b) => {
        if (active !== ALL && categoryKey(b) !== active) return false;
        return matchesBookmarkQuery(b, needle);
      })
      .sort(compareBookmark);
  }, [bookmarks, active, q]);

  /** 전체 보기: 즐겨찾기 섹션 상단 + 카테고리 섹션 */
  const groups = useMemo(() => {
    if (active !== ALL) return null;
    const favs = filtered.filter((b) => b.isFavorite).sort(compareBookmark);
    const rest = filtered.filter((b) => !b.isFavorite);
    const map = new Map<string, Bookmark[]>();
    for (const b of rest) {
      const k = categoryKey(b);
      const list = map.get(k) ?? [];
      list.push(b);
      map.set(k, list);
    }
    const keys = [...map.keys()].sort((a, b) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return a.localeCompare(b, "ko");
    });
    const catGroups = keys.map((key) => ({
      key,
      label: categoryLabel(key),
      items: (map.get(key) ?? []).sort(compareBookmark),
      isFavoriteGroup: false,
    }));
    if (favs.length > 0) {
      return [
        {
          key: FAVORITES,
          label: categoryLabel(FAVORITES),
          items: favs,
          isFavoriteGroup: true,
        },
        ...catGroups,
      ];
    }
    return catGroups;
  }, [filtered, active]);

  /** 전체 북마크에서 unique 카테고리 (편집 suggest용) */
  const categorySuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const b of bookmarks) {
      const c = b.category?.trim();
      if (c) set.add(c);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "ko"));
  }, [bookmarks]);

  /** 전체 북마크에서 unique 태그 (편집 suggest용) */
  const tagSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const b of bookmarks) {
      for (const t of b.tags) {
        const tag = t.trim();
        if (tag) set.add(tag);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, "ko"));
  }, [bookmarks]);

  const ids = useMemo(() => filtered.map((b) => b.id), [filtered]);
  const selection = useSelection(ids);

  async function deleteSelected() {
    if (selection.selectedCount === 0) return;
    if (
      !confirm(`선택한 북마크 ${selection.selectedCount}개를 삭제할까요?`)
    ) {
      return;
    }
    setDeleting(true);
    try {
      const { ok, fail } = await bulkDeleteByIds(
        selection.selectedIds,
        (id) => `/api/bookmarks/${id}`
      );
      selection.clear();
      router.refresh();
      if (fail > 0) alert(`${ok}개 삭제, ${fail}개 실패`);
    } finally {
      setDeleting(false);
    }
  }

  if (bookmarks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
        아직 북마크가 없습니다. URL을 추가해 보세요.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">검색</label>
          <SearchSuggestInput
            placeholder="제목, URL, 설명, 태그, 카테고리…"
            value={q}
            onChange={setQ}
            suggestions={searchSuggestions}
          />
        </div>
      </div>

      {/* 카테고리 칩 */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">카테고리</p>
        <div className="flex flex-wrap gap-2">
          <CategoryChip
            label="전체"
            count={bookmarks.length}
            active={active === ALL}
            onClick={() => {
              setActive(ALL);
              selection.clear();
            }}
          />
          {categoryStats.map((c) => (
            <CategoryChip
              key={c.key}
              label={c.label}
              count={c.count}
              active={active === c.key}
              onClick={() => {
                setActive(c.key);
                selection.clear();
              }}
            />
          ))}
        </div>
      </div>

      <SelectionToolbar
        total={filtered.length}
        selectedCount={selection.selectedCount}
        allSelected={selection.allSelected}
        someSelected={selection.someSelected}
        deleting={deleting}
        onToggleAll={selection.toggleAll}
        onDeleteSelected={() => void deleteSelected()}
      />

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {q.trim()
            ? "검색 조건에 맞는 북마크가 없습니다."
            : "이 카테고리에 북마크가 없습니다."}
        </div>
      ) : groups ? (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.key} className="space-y-3">
              <div
                className={cn(
                  "flex items-center gap-2 border-b pb-2",
                  g.isFavoriteGroup
                    ? "border-amber-500/30"
                    : "border-border"
                )}
              >
                <h2
                  className={cn(
                    "text-sm font-semibold tracking-tight",
                    g.isFavoriteGroup &&
                      "text-amber-800 dark:text-amber-200"
                  )}
                >
                  {g.label}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {g.items.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((b) => (
                  <BookmarkCard
                    key={b.id}
                    bookmark={b}
                    selectable
                    selected={selection.isSelected(b.id)}
                    onToggleSelect={() => selection.toggle(b.id)}
                    categorySuggestions={categorySuggestions}
                    tagSuggestions={tagSuggestions}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b) => (
            <BookmarkCard
              key={b.id}
              bookmark={b}
              selectable
              selected={selection.isSelected(b.id)}
              onToggleSelect={() => selection.toggle(b.id)}
              categorySuggestions={categorySuggestions}
              tagSuggestions={tagSuggestions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** 카테고리 필터 칩 버튼 */
function CategoryChip({
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
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-indigo-500/50 bg-indigo-600/15 text-indigo-700 dark:text-indigo-300"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
          active ? "bg-indigo-600/20" : "bg-muted"
        )}
      >
        {count}
      </span>
    </button>
  );
}
