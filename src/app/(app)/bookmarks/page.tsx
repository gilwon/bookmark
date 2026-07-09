// 북마크 목록 페이지
import { desc, eq } from "drizzle-orm";
import { AddBookmarkForm } from "@/components/bookmarks/add-bookmark-form";
import { BookmarkGrid } from "@/components/bookmarks/bookmark-grid";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bookmarks } from "@/lib/db/schema";
import type { Bookmark } from "@/lib/types";

export const runtime = "nodejs";

/** 북마크 관리 메인 화면 */
export default async function BookmarksPage() {
  const session = await auth();
  const userId = session!.user!.id;

  const rows = db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.userId, userId))
    .orderBy(desc(bookmarks.createdAt))
    .all();

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
        <p className="text-sm text-zinc-400 mt-1">
          URL을 추가하면 메타 정보를 자동으로 가져옵니다.
        </p>
      </div>
      <AddBookmarkForm />
      <BookmarkGrid bookmarks={list} />
    </div>
  );
}
