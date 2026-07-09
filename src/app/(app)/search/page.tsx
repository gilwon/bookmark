// 통합 검색 페이지 (날짜 필터 포함)
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { BookmarkCard } from "@/components/bookmarks/bookmark-card";
import { FilterBar } from "@/components/search/filter-bar";
import { StarCard } from "@/components/stars/star-card";
import { auth } from "@/lib/auth";
import { inDateRange } from "@/lib/date-range";
import { db } from "@/lib/db";
import { bookmarks, githubStars } from "@/lib/db/schema";
import type { Bookmark, GithubStar } from "@/lib/types";

export const runtime = "nodejs";

type SearchParams = Promise<{
  q?: string;
  type?: string;
  tag?: string;
  category?: string;
  from?: string;
  to?: string;
}>;

/** 검색어/필터에 맞는 북마크·Star를 통합 표시한다. */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  const userId = session!.user!.id;
  const sp = await searchParams;

  const q = (sp.q ?? "").trim().toLowerCase();
  const type = sp.type ?? "all";
  const tag = (sp.tag ?? "").trim().toLowerCase();
  const category = (sp.category ?? "").trim().toLowerCase();
  const from = (sp.from ?? "").trim();
  const to = (sp.to ?? "").trim();

  let bookmarkResults: Bookmark[] = [];
  let starResults: GithubStar[] = [];

  if (type === "all" || type === "bookmark") {
    const rows = db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .all();

    bookmarkResults = rows
      .map((row) => {
        let tags: string[] = [];
        try {
          tags = JSON.parse(row.tags || "[]");
        } catch {
          tags = [];
        }
        return {
          id: row.id,
          userId: row.userId,
          url: row.url,
          title: row.title,
          description: row.description,
          image: row.image,
          favicon: row.favicon,
          tags,
          category: row.category,
          createdAt: row.createdAt,
        } satisfies Bookmark;
      })
      .filter((b) => {
        if (!inDateRange(b.createdAt, from, to)) return false;
        if (category && (b.category ?? "").toLowerCase() !== category) {
          return false;
        }
        if (tag && !b.tags.some((t) => t.toLowerCase() === tag)) {
          return false;
        }
        if (!q) return true;
        const hay = [b.title, b.description ?? "", b.url, ...b.tags]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
  }

  if (type === "all" || type === "star") {
    // 카테고리 필터는 북마크 전용 — star에서는 무시
    if (!category) {
      const rows = db
        .select()
        .from(githubStars)
        .where(eq(githubStars.userId, userId))
        .all();

      starResults = rows
        .map((row) => {
          let topics: string[] = [];
          try {
            topics = JSON.parse(row.topics || "[]");
          } catch {
            topics = [];
          }
          return {
            id: row.id,
            userId: row.userId,
            repoFullName: row.repoFullName,
            description: row.description,
            language: row.language,
            stars: row.stars,
            topics,
            url: row.url,
            lastSynced: row.lastSynced,
            createdAt: row.createdAt,
          } satisfies GithubStar;
        })
        .filter((s) => {
          if (!inDateRange(s.createdAt, from, to)) return false;
          if (tag && !s.topics.some((t) => t.toLowerCase() === tag)) {
            return false;
          }
          if (!q) return true;
          const hay = [
            s.repoFullName,
            s.description ?? "",
            s.language ?? "",
            ...s.topics,
          ]
            .join(" ")
            .toLowerCase();
          return hay.includes(q);
        });
    }
  }

  const hasQuery = Boolean(
    q || tag || category || from || to || (type && type !== "all")
  );
  const total = bookmarkResults.length + starResults.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">검색</h1>
        <p className="text-sm text-muted-foreground mt-1">
          북마크와 GitHub Stars를 통합 검색합니다.
        </p>
      </div>

      <Suspense fallback={<div className="text-sm text-muted-foreground">로딩…</div>}>
        <FilterBar />
      </Suspense>

      {hasQuery && (
        <p className="text-sm text-muted-foreground">
          결과 {total}건
          {bookmarkResults.length > 0 && ` · 북마크 ${bookmarkResults.length}`}
          {starResults.length > 0 && ` · Star ${starResults.length}`}
          {(from || to) &&
            ` · 기간 ${from || "…"} ~ ${to || "…"}`}
        </p>
      )}

      {!hasQuery ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          검색어 또는 필터를 입력하세요.
        </div>
      ) : total === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          검색 결과가 없습니다.
        </div>
      ) : (
        <div className="space-y-8">
          {bookmarkResults.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">북마크</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {bookmarkResults.map((b) => (
                  <BookmarkCard key={b.id} bookmark={b} />
                ))}
              </div>
            </section>
          )}
          {starResults.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground">GitHub Stars</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {starResults.map((s) => (
                  <StarCard key={s.id} star={s} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
