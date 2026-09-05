// 북마크 목록 페이지
import { AddBookmarkForm } from "@/components/bookmarks/add-bookmark-form";
import { BookmarkGrid } from "@/components/bookmarks/bookmark-grid";
import { CategoryManager } from "@/components/bookmarks/category-manager";
import { ImportBookmarksHtml } from "@/components/bookmarks/import-bookmarks-html";
import { auth } from "@/lib/auth";
import { parseListQuery } from "@/lib/list-query";
import { store } from "@/lib/store";
import type { Bookmark, Category } from "@/lib/types";

export const runtime = "nodejs";

export default async function BookmarksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const session = await auth();
  const userId = session!.user!.id;
  await store.ensureCategoriesFromBookmarks(userId);
  const query = parseListQuery(await searchParams);

  const [rows, catRows, total, catCounts] = await Promise.all([
    store.listBookmarks(userId, query),
    store.listCategories(userId),
    store.countBookmarks(userId, { q: query.q }),
    store.listCategoryCounts(userId, 10_000),
  ]);

  const list: Bookmark[] = rows.map((row) => {
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
      isFavorite: Boolean(row.isFavorite),
      createdAt: row.createdAt,
    };
  });

  const countMap = new Map(
    catCounts.map((c) => [c.name.trim().toLowerCase(), c.count] as const)
  );

  const categories: Category[] = catRows
    .map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      count: countMap.get(r.name.trim().toLowerCase()) ?? 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const categoryNames = categories.map((c) => c.name);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium tracking-[-0.02em]">북마크</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          URL 추가·HTML 가져오기, 카테고리별로 모아 볼 수 있습니다.
        </p>
      </div>
      <AddBookmarkForm categories={categoryNames} />
      <CategoryManager categories={categories} />
      <ImportBookmarksHtml />
      <BookmarkGrid
        bookmarks={list}
        total={total}
        page={query.page}
        q={query.q}
      />
    </div>
  );
}
