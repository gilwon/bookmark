// 스레드 카피 목록 — 본문 미리보기·복사·즐겨찾기·선택 삭제
"use client";

import { Copy, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CopyComposer } from "@/components/copies/copy-composer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  SearchSuggestInput,
  type SearchSuggestItem,
} from "@/components/ui/search-suggest-input";
import { Select } from "@/components/ui/select";
import { SelectionToolbar } from "@/components/ui/selection-toolbar";
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
import type { ThreadCopy } from "@/lib/types";
import { cn } from "@/lib/utils";

const ALL = "__all__";
const FAVORITES = "__favorites__";
const FAVORITES_LABEL = "⭐ 즐겨찾기";

const SORT_OPTIONS: { value: ListSortKey; label: string }[] = [
  { value: "created_desc", label: "등록일 최신" },
  { value: "updated_desc", label: "수정일 최신" },
  { value: "title_asc", label: "제목 가나다" },
];

function sourceHostLabel(url: string): string {
  try {
    const href = url.includes("://") ? url : `https://${url}`;
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function copyHaystack(c: ThreadCopy): string {
  return `${c.title} ${c.body} ${(c.tags ?? []).join(" ")} ${c.sourceUrl ?? ""}`;
}

function compareCopy(a: ThreadCopy, b: ThreadCopy, sort: ListSortKey): number {
  if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
  if (sort === "title_asc") return compareTitleAsc(a.title, b.title);
  if (sort === "updated_desc") {
    return compareIsoDesc(a.updatedAt, b.updatedAt);
  }
  return compareIsoDesc(a.createdAt, b.createdAt);
}

/** 카피 목록을 검색·정렬·페이징하고 본문을 바로 읽게 한다. */
export function CopyList({ copies }: { copies: ThreadCopy[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<ListSortKey>("created_desc");
  const [page, setPage] = useState(1);
  const [active, setActive] = useState(ALL);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [favoritingId, setFavoritingId] = useState<string | null>(null);

  const favoriteCount = useMemo(
    () => copies.filter((c) => c.isFavorite).length,
    [copies]
  );

  const tagStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of copies) {
      for (const t of c.tags ?? []) {
        if (!t) continue;
        map.set(t, (map.get(t) ?? 0) + 1);
      }
    }
    return [...map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label, "ko"));
  }, [copies]);

  useEffect(() => {
    setPage(1);
  }, [q, sort, active]);

  const filtered = useMemo(() => {
    return copies
      .filter((c) => {
        if (active === FAVORITES && !c.isFavorite) return false;
        if (active !== ALL && active !== FAVORITES) {
          if (!(c.tags ?? []).includes(active)) return false;
        }
        return matchesSearchTokens(copyHaystack(c), q);
      })
      .sort((a, b) => compareCopy(a, b, sort));
  }, [copies, q, sort, active]);

  const pageItems = useMemo(
    () => slicePage(filtered, page, DEFAULT_PAGE_SIZE),
    [filtered, page]
  );

  const suggestions = useMemo((): SearchSuggestItem[] => {
    const items: SearchSuggestItem[] = [];
    for (const c of copies) {
      if (c.title.trim()) {
        items.push({ value: c.title, label: c.title, group: "제목" });
      }
    }
    return items;
  }, [copies]);

  const ids = useMemo(() => pageItems.map((c) => c.id), [pageItems]);
  const selection = useSelection(ids);

  function handleChip(key: string) {
    setActive((prev) => (key === ALL ? ALL : prev === key ? ALL : key));
    selection.clear();
  }

  async function copyBody(c: ThreadCopy) {
    try {
      await navigator.clipboard.writeText(c.body);
      setCopiedId(c.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      alert("복사에 실패했습니다.");
    }
  }

  async function toggleFavorite(c: ThreadCopy) {
    if (favoritingId) return;
    setFavoritingId(c.id);
    try {
      const res = await fetch(`/api/copies/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !c.isFavorite }),
      });
      if (res.ok) router.refresh();
    } finally {
      setFavoritingId(null);
    }
  }

  async function deleteSelected() {
    if (selection.selectedCount === 0) return;
    if (!confirm(`선택한 카피 ${selection.selectedCount}개를 삭제할까요?`)) {
      return;
    }
    setDeleting(true);
    try {
      const { ok, fail } = await bulkDeleteByIds(
        selection.selectedIds,
        (id) => `/api/copies/${id}`
      );
      selection.clear();
      router.refresh();
      if (fail > 0) alert(`${ok}개 삭제, ${fail}개 실패`);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <CopyComposer />

      {copies.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          첫 카피를 위에 붙여 넣으세요
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">
                검색 (제목·본문·태그)
              </label>
              <SearchSuggestInput
                placeholder="예: 후킹 · 런칭"
                value={q}
                onChange={setQ}
                suggestions={suggestions}
              />
            </div>
            <div className="w-full space-y-1 sm:w-44">
              <label
                htmlFor="copy-sort"
                className="text-xs text-muted-foreground"
              >
                정렬 (즐겨찾기 우선)
              </label>
              <Select
                id="copy-sort"
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

          <div className="flex flex-wrap gap-2">
            <FilterChip
              label="전체"
              count={copies.length}
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
            {tagStats.map((g) => (
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
            전체 {copies.length}개 · 검색 결과 {filtered.length}개
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
              조건에 맞는 카피가 없습니다.
            </p>
          ) : (
            <>
              <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                {pageItems.map((c) => {
                  const selected = selection.isSelected(c.id);
                  const tags = Array.isArray(c.tags) ? c.tags : [];
                  return (
                    <div
                      key={c.id}
                      role="link"
                      tabIndex={0}
                      className={cn(
                        "group cursor-pointer transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:bg-muted/60",
                        selected && "bg-indigo-600/8"
                      )}
                      onClick={() => router.push(`/copies/${c.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/copies/${c.id}`);
                        }
                      }}
                    >
                      <div className="flex items-start gap-2.5 px-3 py-2">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-indigo-600"
                          checked={selected}
                          onChange={() => selection.toggle(c.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`${c.title} 선택`}
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-sm font-medium leading-snug">
                            {c.title}
                          </p>
                          <p className="line-clamp-5 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                            {c.body}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            등록 {formatListDate(c.createdAt)}
                            {c.updatedAt !== c.createdAt
                              ? ` · 수정 ${formatListDate(c.updatedAt)}`
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
                          {c.sourceUrl ? (
                            <a
                              href={c.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block truncate text-xs text-muted-foreground hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {sourceHostLabel(c.sourceUrl)}
                            </a>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10"
                            title="본문 복사"
                            aria-label="본문 복사"
                            onClick={(e) => {
                              e.stopPropagation();
                              void copyBody(c);
                            }}
                          >
                            <Copy
                              className={cn(
                                "h-4 w-4",
                                copiedId === c.id && "text-emerald-500"
                              )}
                            />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-10 w-10",
                              c.isFavorite
                                ? "text-amber-500"
                                : "text-muted-foreground"
                            )}
                            title={
                              c.isFavorite ? "즐겨찾기 해제" : "즐겨찾기"
                            }
                            aria-label={
                              c.isFavorite ? "즐겨찾기 해제" : "즐겨찾기"
                            }
                            aria-pressed={c.isFavorite}
                            disabled={favoritingId === c.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              void toggleFavorite(c);
                            }}
                          >
                            <Star
                              className={cn(
                                "h-4 w-4",
                                c.isFavorite && "fill-current"
                              )}
                            />
                          </Button>
                        </div>
                      </div>
                    </div>
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

/** 태그·즐겨찾기 필터 칩 */
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
