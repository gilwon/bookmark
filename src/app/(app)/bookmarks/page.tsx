// 북마크 목록 페이지
import { AddBookmarkForm } from "@/components/bookmarks/add-bookmark-form";
import { BookmarkGrid } from "@/components/bookmarks/bookmark-grid";
import { ImportBookmarksHtml } from "@/components/bookmarks/import-bookmarks-html";
import { auth } from "@/lib/auth";
import { store } from "@/lib/store";
import type { Bookmark } from "@/lib/types";

export const runtime = "nodejs";

export default async function BookmarksPage() {
  const session = await auth();
  const userId = session!.user!.id;
  const rows = await store.listBookmarks(userId);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">북마크</h1>
        <p className="text-sm text-muted-foreground mt-1">
          URL 추가·HTML 가져오기, 카테고리별로 모아 볼 수 있습니다.
        </p>
      </div>
      <AddBookmarkForm />
      <ImportBookmarksHtml />
      <BookmarkGrid bookmarks={list} />
    </div>
  );
}
