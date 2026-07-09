// 북마크 반응형 그리드 + 전체 선택 / 선택 삭제
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Bookmark } from "@/lib/types";
import { useSelection } from "@/hooks/use-selection";
import { bulkDeleteByIds } from "@/lib/bulk-delete";
import { SelectionToolbar } from "@/components/ui/selection-toolbar";
import { BookmarkCard } from "./bookmark-card";

/** 1/2/3 컬럼 반응형 그리드로 북마크를 배치한다. */
export function BookmarkGrid({ bookmarks }: { bookmarks: Bookmark[] }) {
  const router = useRouter();
  const ids = useMemo(() => bookmarks.map((b) => b.id), [bookmarks]);
  const selection = useSelection(ids);
  const [deleting, setDeleting] = useState(false);

  async function deleteSelected() {
    if (selection.selectedCount === 0) return;
    if (
      !confirm(
        `선택한 북마크 ${selection.selectedCount}개를 삭제할까요?`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const { ok, fail } = await bulkDeleteByIds(
        selection.selectedIds,
        (id) => `/api/bookmarks/${id}`
      );
      selection.clear();
      router.refresh();
      if (fail > 0) alert(`${ok}개 삭제, ${fail}개 실패`);
    } finally {
      setDeleting(false);
    }
  }

  if (bookmarks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
        아직 북마크가 없습니다. URL을 추가해 보세요.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SelectionToolbar
        total={bookmarks.length}
        selectedCount={selection.selectedCount}
        allSelected={selection.allSelected}
        someSelected={selection.someSelected}
        deleting={deleting}
        onToggleAll={selection.toggleAll}
        onDeleteSelected={() => void deleteSelected()}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bookmarks.map((b) => (
          <BookmarkCard
            key={b.id}
            bookmark={b}
            selectable
            selected={selection.isSelected(b.id)}
            onToggleSelect={() => selection.toggle(b.id)}
          />
        ))}
      </div>
    </div>
  );
}
