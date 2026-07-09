// 목록 전체 선택 / 선택 삭제 툴바
"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  total: number;
  selectedCount: number;
  allSelected: boolean;
  someSelected: boolean;
  deleting?: boolean;
  onToggleAll: () => void;
  onDeleteSelected: () => void;
  className?: string;
};

/** 전체 선택 체크박스 + 선택 삭제 버튼 */
export function SelectionToolbar({
  total,
  selectedCount,
  allSelected,
  someSelected,
  deleting,
  onToggleAll,
  onDeleteSelected,
  className,
}: Props) {
  if (total === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card/50 px-3 py-2",
        className
      )}
    >
      <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border accent-indigo-600"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = someSelected;
          }}
          onChange={onToggleAll}
          aria-label="전체 선택"
        />
        <span>
          전체 선택
          {selectedCount > 0 && (
            <span className="text-muted-foreground">
              {" "}
              · {selectedCount}/{total}
            </span>
          )}
        </span>
      </label>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={selectedCount === 0 || deleting}
        onClick={onDeleteSelected}
      >
        <Trash2 className="h-4 w-4" />
        {deleting ? "삭제 중…" : `선택 삭제${selectedCount ? ` (${selectedCount})` : ""}`}
      </Button>
    </div>
  );
}
