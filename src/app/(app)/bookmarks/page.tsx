// 북마크 목록 페이지
import { AddBookmarkForm } from "@/components/bookmarks/add-bookmark-form";
import { BookmarkGrid } from "@/components/bookmarks/bookmark-grid";
import { CategoryManager } from "@/components/bookmarks/category-manager";
import { ImportBookmarksHtml } from "@/components/bookmarks/import-bookmarks-html";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import type { Bookmark, Category } from "@/lib/types";

export const runtime = "nodejs";

export default async function BookmarksPage() {
  const session = await auth();
  const userId = session!.user!.id;
  await store.ensureCategoriesFromBookmarks(userId);

  const [rows, catRows] = await Promise.all([
    store.listBookmarks(userId),
    store.listCategories(userId),
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
      createdAt: row.createdAt,
    };
  });

  const countMap = new Map<string, number>();
  for (const b of list) {
    const n = b.category?.trim();
    if (!n) continue;
    const k = n.toLowerCase();
    countMap.set(k, (countMap.get(k) ?? 0) + 1);
  }

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
        <h1 className="text-2xl font-bold tracking-tight">북마크</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          URL 추가·HTML 가져오기, 카테고리별로 모아 볼 수 있습니다.
        </p>
      </div>
      <AddBookmarkForm categories={categoryNames} />
      <CategoryManager categories={categories} />
      <ImportBookmarksHtml />
      <BookmarkGrid bookmarks={list} />
    </div>
  );
}
