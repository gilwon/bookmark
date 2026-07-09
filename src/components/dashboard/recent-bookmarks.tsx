// 대시보드용 최근 북마크 그리드 (삭제 없이 열람 중심)
"use client";

import { ExternalLink } from "lucide-react";
import type { Bookmark } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** 최근 북마크 카드 목록 — 빈 상태 포함 */
export function DashboardRecentBookmarks({
  bookmarks,
}: {
  bookmarks: Bookmark[];
}) {
  if (bookmarks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        아직 북마크가 없습니다. URL을 추가하거나 HTML을 가져와 보세요.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {bookmarks.map((b) => {
        let domain = "";
        try {
          domain = new URL(b.url).hostname;
        } catch {
          domain = b.url;
        }
        return (
          <Card
            key={b.id}
            className="overflow-hidden transition-colors hover:border-indigo-500/40"
          >
            {b.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={b.image}
                alt=""
                className="h-28 w-full object-cover bg-muted"
              />
            ) : (
              <div className="flex h-28 items-center justify-center bg-muted/50 text-xs text-muted-foreground">
                이미지 없음
              </div>
            )}
            <CardHeader className="space-y-1 p-3 pb-1">
              <CardTitle className="line-clamp-2 text-sm leading-snug">
                {b.title}
              </CardTitle>
              <p className="truncate text-[11px] text-muted-foreground">
                {domain}
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-1.5 p-3 pt-1">
              {b.category && (
                <Badge variant="secondary">{b.category}</Badge>
              )}
              <a
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:underline dark:text-indigo-300"
              >
                열기
                <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
