// 페이지 상세 하단 — 관련 페이지·북마크
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type RelatedPage = { id: string; title: string; sourceUrl: string | null };
type RelatedBookmark = {
  id: string;
  title: string;
  url: string;
  category: string | null;
};

type RelatedPayload = {
  pages: RelatedPage[];
  bookmarks: RelatedBookmark[];
};

function hostOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const href = url.includes("://") ? url : `https://${url}`;
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** GET /api/pages/:id/related 결과를 목록으로 보여준다. */
export function PageRelated({ pageId }: { pageId: string }) {
  const [data, setData] = useState<RelatedPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/pages/${pageId}/related`);
        if (!res.ok) throw new Error("fail");
        const json = (await res.json()) as RelatedPayload;
        if (!cancelled) {
          setData({
            pages: Array.isArray(json.pages) ? json.pages : [],
            bookmarks: Array.isArray(json.bookmarks) ? json.bookmarks : [],
          });
        }
      } catch {
        if (!cancelled) setData({ pages: [], bookmarks: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  const pages = data?.pages ?? [];
  const bookmarks = data?.bookmarks ?? [];
  const empty = Boolean(data) && pages.length === 0 && bookmarks.length === 0;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">관련</h2>
      {empty ? (
        <p className="text-sm text-muted-foreground">관련 항목이 없습니다.</p>
      ) : (
        <ul className="space-y-1.5">
          {pages.map((p) => (
            <li key={`page-${p.id}`} className="min-w-0">
              <Link
                href={`/pages/${p.id}`}
                className="block truncate text-sm font-medium hover:text-indigo-300"
              >
                {p.title || "제목 없는 페이지"}
              </Link>
              {p.sourceUrl ? (
                <p className="truncate text-xs text-muted-foreground">
                  {hostOf(p.sourceUrl) || p.sourceUrl}
                </p>
              ) : null}
            </li>
          ))}
          {bookmarks.map((b) => (
            <li key={`bm-${b.id}`} className="min-w-0">
              <a
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-sm font-medium hover:text-indigo-300"
              >
                {b.title || b.url}
              </a>
              <p className="truncate text-xs text-muted-foreground">
                {[b.category, hostOf(b.url)].filter(Boolean).join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
