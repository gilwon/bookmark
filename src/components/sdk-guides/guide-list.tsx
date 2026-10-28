"use client";
// 김스듴 가이드를 검색·분류·정렬하고 페이지별로 보여준다.
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { filterSdkGuides, type SdkGuide } from "@/lib/sdk-guides";

export function GuideList({ guides }: { guides: SdkGuide[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [tool, setTool] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const categories = [...new Set(guides.map((guide) => guide.category))].sort();
  const tools = [...new Set(guides.map((guide) => guide.tool).filter(Boolean))].sort();
  const filtered = useMemo(
    () => filterSdkGuides(guides, { query, category, tool, sort }),
    [guides, query, category, tool, sort]
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 30));
  const visible = filtered.slice((page - 1) * 30, page * 30);
  const selectClass = "h-11 min-w-0 w-full rounded-md border border-border bg-input px-2.5 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  function resetFilters() {
    setQuery("");
    setCategory("");
    setTool("");
    setSort("newest");
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr]">
        <label className="min-w-0 space-y-1.5 text-xs text-muted-foreground">
          <span>검색</span>
          <Input
            type="search"
            aria-label="가이드 검색"
            placeholder="제목·태그 검색"
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
          <span>AI 도구</span>
          <select aria-label="AI 도구 필터" value={tool} onChange={(event) => { setTool(event.target.value); setPage(1); }} className={selectClass}>
            <option value="">전체 도구</option>
            {tools.map((item) => <option key={item} value={item}>{item}</option>)}
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
          전체 {guides.length}개 중 {filtered.length}개의 가이드
        </p>
        <Button type="button" variant="ghost" onClick={resetFilters} className="h-11 shrink-0">필터 초기화</Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="일치하는 가이드가 없습니다."
          description="검색어나 필터를 바꿔보세요."
          action={<Button type="button" variant="outline" onClick={resetFilters} className="h-11">필터 초기화</Button>}
          className="my-8"
        />
      ) : (
        <ul className="space-y-3" aria-label="가이드 목록">
          {visible.map((guide) => (
            <li key={guide.slug}>
              <Card>
                <CardContent className="p-0">
                  <Link href={`/sdk-guides/${guide.slug}`} className="group block rounded-lg p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-medium text-indigo-600 dark:text-indigo-400">{guide.category}</span>
                      {guide.tool && <span>{guide.tool}</span>}
                      <time dateTime={guide.publishedAt}>{guide.publishedAt.slice(0, 10)}</time>
                    </div>
                    <h2 className="mt-2 break-words text-base font-medium leading-relaxed group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{guide.title}</h2>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground">가이드 보기<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
                  </Link>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {filtered.length > 0 && (
        <nav aria-label="가이드 페이지 이동" className="flex items-center justify-center gap-4 pt-2">
          <Button type="button" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)} className="h-11">이전</Button>
          <span aria-live="polite" className="text-sm tabular-nums text-muted-foreground">{page} / {pageCount}</span>
          <Button type="button" variant="outline" disabled={page === pageCount} onClick={() => setPage(page + 1)} className="h-11">다음</Button>
        </nav>
      )}
    </div>
  );
}
