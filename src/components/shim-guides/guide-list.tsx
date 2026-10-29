"use client";
// 심팀장 자료실 목록을 검색해 카드로 보여 준다.
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { filterShimGuides, type ShimGuide } from "@/lib/shim-guides";

export function GuideList({ guides }: { guides: ShimGuide[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => filterShimGuides(guides, { query }), [guides, query]);

  function clearQuery() {
    setQuery("");
  }

  return (
    <div className="space-y-4">
      <label className="block min-w-0 space-y-1.5 text-xs text-muted-foreground">
        <span>검색</span>
        <Input
          type="search"
          aria-label="자료 검색"
          placeholder="제목·요약·편수 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-11 min-h-11"
        />
      </label>

      <p aria-live="polite" role="status" className="text-sm text-muted-foreground">
        전체 {guides.length}개 중 {filtered.length}개
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          title="일치하는 자료가 없습니다."
          description="검색어를 바꿔 보세요."
          action={<Button type="button" variant="outline" onClick={clearQuery} className="h-11 min-h-11">검색 지우기</Button>}
          className="my-8"
        />
      ) : (
        <ul className="grid list-none gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="자료 목록">
          {filtered.map((guide) => (
            <li key={guide.slug} className="min-w-0">
              <Link
                href={`/shim-guides/${guide.slug}`}
                className="block h-full rounded-doc-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Card className="h-full transition-colors hover:border-indigo-500/40 active:border-indigo-500/60">
                  <CardContent className="flex h-full flex-col gap-3 p-4">
                    <Badge>{guide.episode}</Badge>
                    <h2 className="break-words text-sm font-semibold leading-snug">{guide.title}</h2>
                    <p className="line-clamp-3 text-sm text-muted-foreground">{guide.summary}</p>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
