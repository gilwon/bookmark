// 통합 검색 결과용 카피 카드
import Link from "next/link";
import { PenLine } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export type CopySearchResult = {
  id: string;
  title: string;
  snippet: string;
  updatedAt: string;
};

/** 검색 결과 목록에 표시하는 카피 한 줄 카드 */
export function CopyResultCard({ copy }: { copy: CopySearchResult }) {
  return (
    <Link href={`/copies/${copy.id}`} className="block">
      <Card className="h-full transition-colors hover:border-indigo-500/40">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-600/15 text-rose-600 dark:text-rose-300">
            <PenLine className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{copy.title}</p>
            {copy.snippet && (
              <p className="mt-1 line-clamp-4 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
                {copy.snippet}
              </p>
            )}
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              수정 {new Date(copy.updatedAt).toLocaleDateString("ko-KR")}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
