// 목록 하단 페이지 이동 UI
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clampPage, totalPages } from "@/lib/list-utils";
import { cn } from "@/lib/utils";

type Props = {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
  className?: string;
};

/** total이 pageSize 이하면 null (렌더 안 함) */
export function ListPagination({
  page,
  total,
  pageSize,
  onChange,
  className,
}: Props) {
  if (total <= pageSize) return null;
  const tp = totalPages(total, pageSize);
  const cur = clampPage(page, total, pageSize);
  const start = (cur - 1) * pageSize + 1;
  const end = Math.min(cur * pageSize, total);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3",
        className
      )}
    >
      <p className="text-xs text-muted-foreground">
        전체 {total}개 중 {start}–{end} · {cur}/{tp} 페이지
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={cur <= 1}
          onClick={() => onChange(cur - 1)}
          aria-label="이전 페이지"
        >
          <ChevronLeft className="h-4 w-4" />
          이전
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={cur >= tp}
          onClick={() => onChange(cur + 1)}
          aria-label="다음 페이지"
        >
          다음
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
