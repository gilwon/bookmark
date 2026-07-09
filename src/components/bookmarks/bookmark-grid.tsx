// 북마크 반응형 그리드
import type { Bookmark } from "@/lib/types";
import { BookmarkCard } from "./bookmark-card";

/** 1/2/3 컬럼 반응형 그리드로 북마크를 배치한다. */
export function BookmarkGrid({ bookmarks }: { bookmarks: Bookmark[] }) {
  if (bookmarks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
        아직 북마크가 없습니다. URL을 추가해 보세요.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {bookmarks.map((b) => (
        <BookmarkCard key={b.id} bookmark={b} />
      ))}
    </div>
  );
}
