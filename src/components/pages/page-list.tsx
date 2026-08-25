// 커스텀 페이지 목록 + 검색·정렬·페이징 + 생성·선택 삭제
"use client";

import { FileText, Plus, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { CustomPage } from "@/lib/types";
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
import {
  getRecentPagesServerSnapshot,
  getRecentPagesSnapshot,
  parseRecentPageIds,
  subscribeRecentPages,
} from "@/lib/recent-pages";
import { PdfImportForm } from "@/components/pages/pdf-import-form";
import { UrlImportForm } from "@/components/pages/url-import-form";
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

const ALL = "__all__";
const FAVORITES = "__favorites__";
const RECENT = "__recent__";
const FAVORITES_LABEL = "⭐ 즐겨찾기";
const RECENT_LABEL = "최근 본";
const EMPTY_IDS: string[] = [];

const SORT_OPTIONS: { value: ListSortKey; label: string }[] = [
  { value: "created_desc", label: "등록일 최신" },
  { value: "updated_desc", label: "수정일 최신" },
  { value: "title_asc", label: "제목 가나다" },
];

function sortPages(list: CustomPage[], sort: ListSortKey): CustomPage[] {
  const arr = [...list];
  if (sort === "title_asc") {
    arr.sort((a, b) => compareTitleAsc(a.title, b.title));
  } else if (sort === "updated_desc") {
    arr.sort((a, b) => compareIsoDesc(a.updatedAt, b.updatedAt));
  } else {
    arr.sort((a, b) => compareIsoDesc(a.createdAt, b.createdAt));
  }
  return arr;
}

function pageSearchHaystack(p: CustomPage): string {
  const tags = Array.isArray(p.tags) ? p.tags.join(" ") : "";
  return `${p.title ?? ""} ${tags} ${p.sourceUrl ?? ""}`;
}

function sourceHostLabel(url: string): string {
  try {
    const href = url.includes("://") ? url : `https://${url}`;
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** 페이지 목록을 렌더하고 검색/정렬/페이징/생성/삭제를 처리한다. */
export function PageList({ pages }: { pages: CustomPage[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<ListSortKey>("created_desc");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [active, setActive] = useState(ALL);
  const [bodySearch, setBodySearch] = useState<{ q: string; ids: string[] }>({
    q: "",
    ids: [],
  });
  const [favMap, setFavMap] = useState<Record<string, boolean>>({});
  const [favoritingId, setFavoritingId] = useState<string | null>(null);

  const recentRaw = useSyncExternalStore(
    subscribeRecentPages,
    getRecentPagesSnapshot,
    getRecentPagesServerSnapshot
  );
  const recentIds = useMemo(
    () => parseRecentPageIds(recentRaw),
    [recentRaw]
  );

  const pagesView = useMemo(
    () =>
      pages.map((p) => ({
        ...p,
        isFavorite: favMap[p.id] ?? p.isFavorite,
      })),
    [pages, favMap]
  );

  const favoriteCount = useMemo(
    () => pagesView.filter((p) => p.isFavorite).length,
    [pagesView]
  );

  const tagStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of pagesView) {
      for (const t of p.tags ?? []) {
        if (!t) continue;
        map.set(t, (map.get(t) ?? 0) + 1);
      }
    }
    return [...map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label, "ko"));
  }, [pagesView]);

  const recentCount = useMemo(() => {
    const ids = new Set(pagesView.map((p) => p.id));
    return recentIds.filter((id) => ids.has(id)).length;
  }, [pagesView, recentIds]);

  // 제목·태그 매칭이 없거나 q가 2글자 이상이면 본문 검색을 합친다
  useEffect(() => {
    const query = q.trim();
    const clientCount = pages.filter((p) =>
      matchesSearchTokens(pageSearchHaystack(p), q)
    ).length;
    const shouldFetch =
      query.length > 0 && (clientCount === 0 || query.length >= 2);

    if (!shouldFetch) return;

    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/search?q=${encodeURIComponent(query)}&limit=40`,
            { signal: ac.signal }
          );
          if (!res.ok) throw new Error("search fail");
          const data = (await res.json()) as {
            items?: { type?: string; id?: string }[];
          };
          const ids = (data.items ?? [])
            .filter((i) => i.type === "page" && typeof i.id === "string")
            .map((i) => i.id as string);
          setBodySearch({ q: query, ids });
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setBodySearch({ q: query, ids: [] });
        }
      })();
    }, 220);

    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [q, pages]);

  const bodyPageIds =
    bodySearch.q === q.trim() ? bodySearch.ids : EMPTY_IDS;

  const filtered = useMemo(() => {
    const byId = new Map(pagesView.map((p) => [p.id, p]));
    const matchedIds = new Set(
      pagesView
        .filter((p) => matchesSearchTokens(pageSearchHaystack(p), q))
        .map((p) => p.id)
    );
    for (const id of bodyPageIds) {
      if (byId.has(id)) matchedIds.add(id);
    }

    if (active === RECENT) {
      return recentIds
        .map((id) => byId.get(id))
        .filter((p): p is CustomPage => p != null && matchedIds.has(p.id));
    }

    let list = pagesView.filter((p) => matchedIds.has(p.id));
    if (active === FAVORITES) {
      list = list.filter((p) => p.isFavorite);
    } else if (active !== ALL) {
      list = list.filter((p) => (p.tags ?? []).includes(active));
    }
    return sortPages(list, sort);
  }, [pagesView, q, sort, active, bodyPageIds, recentIds]);

  const pageItems = useMemo(
    () => slicePage(filtered, page, DEFAULT_PAGE_SIZE),
    [filtered, page]
  );

  /** 검색 suggest — 페이지 제목 */
  const searchSuggestions = useMemo((): SearchSuggestItem[] => {
    return pages
      .map((p) => p.title?.trim())
      .filter((t): t is string => Boolean(t))
      .map((title) => ({ value: title, label: title, group: "제목" }));
  }, [pages]);

  const ids = useMemo(() => pageItems.map((p) => p.id), [pageItems]);
  const selection = useSelection(ids);

  function handleChip(key: string) {
    setActive((prev) => (key === ALL ? ALL : prev === key ? ALL : key));
    setPage(1);
    selection.clear();
  }

  function handleQuery(value: string) {
    setQ(value);
    setPage(1);
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "제목 없는 페이지" }),
      });
      if (!res.ok) throw new Error("생성 실패");
      const created = await res.json();
      router.push(`/pages/${created.id}`);
      router.refresh();
    } catch {
      alert("페이지 생성에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("이 페이지를 삭제할까요?")) return;
    const res = await fetch(`/api/pages/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  async function deleteSelected() {
    if (selection.selectedCount === 0) return;
    if (
      !confirm(`선택한 페이지 ${selection.selectedCount}개를 삭제할까요?`)
    ) {
      return;
    }
    setDeleting(true);
    try {
      const { ok, fail } = await bulkDeleteByIds(
        selection.selectedIds,
        (id) => `/api/pages/${id}`
      );
      selection.clear();
      router.refresh();
      if (fail > 0) alert(`${ok}개 삭제, ${fail}개 실패`);
    } finally {
      setDeleting(false);
    }
  }

  async function toggleFavorite(p: CustomPage) {
    if (favoritingId) return;
    const next = !p.isFavorite;
    setFavoritingId(p.id);
    setFavMap((m) => ({ ...m, [p.id]: next }));
    try {
      const res = await fetch(`/api/pages/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: next }),
      });
      if (!res.ok) {
        setFavMap((m) => ({ ...m, [p.id]: p.isFavorite }));
        return;
      }
      router.refresh();
    } catch {
      setFavMap((m) => ({ ...m, [p.id]: p.isFavorite }));
    } finally {
      setFavoritingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => void handleCreate()} disabled={creating}>
          <Plus className="h-4 w-4" />
          {creating ? "생성 중…" : "새 노션 페이지"}
        </Button>
      </div>

      <UrlImportForm />
      <PdfImportForm />

      {pages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          아직 페이지가 없습니다. 새 페이지를 만들어 보세요.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">
                제목·태그·본문 검색
              </label>
              <SearchSuggestInput
                placeholder="예: Muse 총정리 · Claude 폴더"
                value={q}
                onChange={handleQuery}
                suggestions={searchSuggestions}
              />
            </div>
            <div className="w-full space-y-1 sm:w-44">
              <label
                htmlFor="page-sort"
                className="text-xs text-muted-foreground"
              >
                정렬
              </label>
              <Select
                id="page-sort"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as ListSortKey);
                  setPage(1);
                }}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <CategoryChip
              label="전체"
              count={pagesView.length}
              active={active === ALL}
              onClick={() => handleChip(ALL)}
            />
            {favoriteCount > 0 && (
              <CategoryChip
                label={FAVORITES_LABEL}
                count={favoriteCount}
                active={active === FAVORITES}
                onClick={() => handleChip(FAVORITES)}
              />
            )}
            {recentIds.length > 0 && (
              <CategoryChip
                label={RECENT_LABEL}
                count={recentCount}
                active={active === RECENT}
                onClick={() => handleChip(RECENT)}
              />
            )}
            {tagStats.map((g) => (
              <CategoryChip
                key={g.label}
                label={g.label}
                count={g.count}
                active={active === g.label}
                onClick={() => handleChip(g.label)}
              />
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            전체 {pages.length}개 · 검색 결과 {filtered.length}개
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
              검색 조건에 맞는 페이지가 없습니다.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {pageItems.map((p) => {
                  const selected = selection.isSelected(p.id);
                  const tags = Array.isArray(p.tags) ? p.tags : [];
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
                        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-indigo-400" />
                        <div className="min-w-0 flex-1 space-y-1">
                          <Link
                            href={`/pages/${p.id}`}
                            className="block truncate font-medium hover:text-indigo-300"
                          >
                            {p.title}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            등록 {formatListDate(p.createdAt)}
                            {p.updatedAt !== p.createdAt
                              ? ` · 수정 ${formatListDate(p.updatedAt)}`
                              : ""}
                          </p>
                          {tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {tags.map((tag) => (
                                <Badge key={tag} variant="outline">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                          {p.sourceUrl ? (
                            <a
                              href={p.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block truncate text-xs text-muted-foreground hover:underline"
                            >
                              {sourceHostLabel(p.sourceUrl)}
                            </a>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-8 w-8",
                              p.isFavorite
                                ? "text-amber-500"
                                : "text-muted-foreground opacity-70 group-hover:opacity-100 focus-visible:opacity-100"
                            )}
                            onClick={() => void toggleFavorite(p)}
                            disabled={favoritingId === p.id}
                            title={
                              p.isFavorite ? "즐겨찾기 해제" : "즐겨찾기"
                            }
                            aria-label={
                              p.isFavorite ? "즐겨찾기 해제" : "즐겨찾기"
                            }
                            aria-pressed={p.isFavorite}
                          >
                            <Star
                              className={cn(
                                "h-3.5 w-3.5",
                                p.isFavorite && "fill-current"
                              )}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 text-red-400"
                            onClick={() => void handleDelete(p.id)}
                            aria-label="삭제"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <ListPagination
                page={page}
                total={filtered.length}
                pageSize={DEFAULT_PAGE_SIZE}
                onChange={setPage}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** 그룹 필터 칩 버튼. 북마크 카테고리 칩 스타일을 재사용한다 */
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
