"use client";
// 트렌드코어 스킬공유자료를 검색·분류·정렬하고 페이지별로 보여준다.
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { filterTrendcoreLab, type TrendcoreLabItem } from "@/lib/trendcore-lab";

export function LabList({ items }: { items: TrendcoreLabItem[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const categories = [...new Set(items.map((item) => item.category))].sort();
  const filtered = useMemo(
    () => filterTrendcoreLab(items, { query, category, sort }),
    [items, query, category, sort]
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 30));
  const visible = filtered.slice((page - 1) * 30, page * 30);
  const selectClass = "h-11 min-w-0 w-full rounded-md border border-border bg-input px-2.5 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  function resetFilters() {
    setQuery("");
    setCategory("");
    setSort("newest");
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_1fr_1fr]">
        <label className="min-w-0 space-y-1.5 text-xs text-muted-foreground">
          <span>검색</span>
          <Input
            type="search"
            aria-label="자료 검색"
            placeholder="제목·설명·태그 검색"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            className="h-11"
          />
        </label>
        <label className="min-w-0 space-y-1.5 text-xs text-muted-foreground">
          <span>카테고리</span>
          <select aria-label="카테고리 필터" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className={selectClass}>
            <option value="">전체 카테고리</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="min-w-0 space-y-1.5 text-xs text-muted-foreground">
          <span>정렬</span>
          <select aria-label="정렬" value={sort} onChange={(event) => { setSort(event.target.value as "newest" | "oldest"); setPage(1); }} className={selectClass}>
            <option value="newest">최신순</option>
            <option value="oldest">오래된순</option>
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p aria-live="polite" role="status" className="text-sm text-muted-foreground">
          전체 {items.length}개 중 {filtered.length}개의 자료
        </p>
        <Button type="button" variant="ghost" onClick={resetFilters} className="h-11 shrink-0">필터 초기화</Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="일치하는 자료가 없습니다."
          description="검색어나 필터를 바꿔보세요."
          action={<Button type="button" variant="outline" onClick={resetFilters} className="h-11">필터 초기화</Button>}
          className="my-8"
        />
      ) : (
        <ul className="grid list-none gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="자료 목록">
          {visible.map((item) => (
            <li key={item.slug} className="min-w-0">
              <Link
                href={`/trendcore-lab/${item.slug}`}
                className="block h-full rounded-doc-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Card className="h-full transition-colors hover:border-indigo-500/40 active:border-indigo-500/60">
                  <CardContent className="flex h-full flex-col gap-3 p-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge>{item.category}</Badge>
                      {item.number ? <Badge variant="secondary">{item.number}</Badge> : null}
                      <time dateTime={item.publishedAt} className="text-[11px] leading-5 text-muted-foreground">
                        {item.publishedAt.slice(0, 10)}
                      </time>
                    </div>
                    <h2 className="break-words text-sm font-semibold leading-snug">{item.title}</h2>
                    {item.summary ? <p className="line-clamp-3 text-sm text-muted-foreground">{item.summary}</p> : null}
                    {item.tags.length > 0 && (
                      <ul className="flex flex-wrap gap-1" aria-label="태그">
                        {item.tags.map((tag) => (
                          <li key={tag}>
                            <Badge variant="outline">{tag}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                    <span className="mt-auto break-all text-xs text-accent">{item.sourceUrl} ↗</span>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {filtered.length > 0 && (
        <nav aria-label="자료 페이지 이동" className="flex items-center justify-center gap-4 pt-2">
          <Button type="button" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)} className="h-11">이전</Button>
          <span aria-live="polite" className="text-sm tabular-nums text-muted-foreground">{page} / {pageCount}</span>
          <Button type="button" variant="outline" disabled={page === pageCount} onClick={() => setPage(page + 1)} className="h-11">다음</Button>
        </nav>
      )}
    </div>
  );
}
