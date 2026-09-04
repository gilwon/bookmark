// 북마크 반응형 그리드 — 검색 + 상위 그룹 칩/섹션 + 선택 삭제
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Bookmark } from "@/lib/types";
import {
  SITE_GROUP,
  UNCATEGORIZED_GROUP,
  bookmarkGroupKey,
  bookmarkGroupLabel,
  bookmarkInGroup,
} from "@/lib/bookmark-groups";
import { useSelection } from "@/hooks/use-selection";
import { bulkDeleteByIds } from "@/lib/bulk-delete";
import {
  SearchSuggestInput,
  type SearchSuggestItem,
} from "@/components/ui/search-suggest-input";
import { SelectionToolbar } from "@/components/ui/selection-toolbar";
import { cn } from "@/lib/utils";
import { BookmarkCard } from "./bookmark-card";

const ALL = "__all__";
const FAVORITES = "__favorites__";
const FAVORITES_LABEL = "⭐ 즐겨찾기";

/** 사이트·미분류는 가나다 뒤쪽 */
function compareGroupKey(a: string, b: string): number {
  const tail = (k: string) => {
    if (k === SITE_GROUP) return 1;
    if (k === UNCATEGORIZED_GROUP) return 2;
    return 0;
  };
  const d = tail(a) - tail(b);
  if (d !== 0) return d;
  return a.localeCompare(b, "ko");
}

/** 저장 카테고리 원문. 비면 미분류 */
function storedCategoryLabel(b: Bookmark): string {
  const c = b.category?.trim();
  return c ? c : UNCATEGORIZED_GROUP;
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

/** 1/2/3 컬럼 그리드 + 검색 + 그룹 필터·섹션 보기 */
export function BookmarkGrid({ bookmarks }: { bookmarks: Bookmark[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState<string>(ALL);
  const [deleting, setDeleting] = useState(false);

  const favoriteCount = useMemo(
    () => bookmarks.filter((b) => b.isFavorite).length,
    [bookmarks]
  );

  /** 그룹별 개수. 가나다, 사이트·미분류는 뒤 */
  const groupStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bookmarks) {
      const k = bookmarkGroupKey(b.category);
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    const keys = [...map.keys()].sort(compareGroupKey);
    return keys.map((key) => ({
      key,
      label: bookmarkGroupLabel(key),
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

  /** 검색 + 그룹 필터, 즐겨찾기 우선 정렬 */
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return bookmarks
      .filter((b) => {
        if (active === FAVORITES) {
          if (!b.isFavorite) return false;
        } else if (active !== ALL && !bookmarkInGroup(b.category, active)) {
          return false;
        }
        return matchesBookmarkQuery(b, needle);
      })
      .sort(compareBookmark);
  }, [bookmarks, active, q]);

  /** 전체 보기에서는 즐겨찾기 섹션과 그룹 섹션을 쓴다. 그룹 안 원문 카테고리가 여러 개면 소제목 */
  const groups = useMemo(() => {
    if (active !== ALL) return null;
    const favs = filtered.filter((b) => b.isFavorite).sort(compareBookmark);
    const rest = filtered.filter((b) => !b.isFavorite);
    const map = new Map<string, Bookmark[]>();
    for (const b of rest) {
      const k = bookmarkGroupKey(b.category);
      const list = map.get(k) ?? [];
      list.push(b);
      map.set(k, list);
    }
    const keys = [...map.keys()].sort(compareGroupKey);
    const catGroups = keys.map((key) => {
      const items = (map.get(key) ?? []).sort(compareBookmark);
      const byStored = new Map<string, Bookmark[]>();
      for (const b of items) {
        const orig = storedCategoryLabel(b);
        const list = byStored.get(orig) ?? [];
        list.push(b);
        byStored.set(orig, list);
      }
      const origKeys = [...byStored.keys()].sort((a, b) => {
        if (a === UNCATEGORIZED_GROUP) return 1;
        if (b === UNCATEGORIZED_GROUP) return -1;
        return a.localeCompare(b, "ko");
      });
      const subgroups =
        origKeys.length > 1
          ? origKeys.map((orig) => ({
              key: orig,
              label: orig,
              items: (byStored.get(orig) ?? []).sort(compareBookmark),
            }))
          : null;
      return {
        key,
        label: bookmarkGroupLabel(key),
        items,
        isFavoriteGroup: false,
        subgroups,
      };
    });
    if (favs.length > 0) {
      return [
        {
          key: FAVORITES,
          label: FAVORITES_LABEL,
          items: favs,
          isFavoriteGroup: true,
          subgroups: null,
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
      <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
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

      {/* 그룹 칩 — 480px에서도 flex-wrap으로 줄바꿈 */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">그룹</p>
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
          {favoriteCount > 0 && (
            <CategoryChip
              label={FAVORITES_LABEL}
              count={favoriteCount}
              active={active === FAVORITES}
              onClick={() => {
                setActive((prev) => (prev === FAVORITES ? ALL : FAVORITES));
                selection.clear();
              }}
            />
          )}
          {groupStats.map((g) => (
            <CategoryChip
              key={g.key}
              label={g.label}
              count={g.count}
              active={active === g.key}
              onClick={() => {
                setActive((prev) => (prev === g.key ? ALL : g.key));
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
        <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {q.trim()
            ? "검색 조건에 맞는 북마크가 없습니다."
            : "이 그룹에 북마크가 없습니다."}
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
              {g.subgroups ? (
                <div className="space-y-4">
                  {g.subgroups.map((sg) => (
                    <div key={sg.key} className="space-y-2">
                      <h3 className="text-xs font-medium text-muted-foreground">
                        {sg.label}
                      </h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {sg.items.map((b) => (
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
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
              )}
            </section>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

/** 그룹 필터 칩 버튼. 기존 카테고리 칩 스타일을 재사용한다 */
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
