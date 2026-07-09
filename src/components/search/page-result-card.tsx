// 검색 결과용 커스텀 페이지 카드
import { FileText } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export type PageSearchResult = {
  id: string;
  title: string;
  snippet: string;
  createdAt: string;
  updatedAt: string;
};

/** 검색된 페이지를 카드로 표시한다. */
export function PageResultCard({ page }: { page: PageSearchResult }) {
  return (
    <Card className="transition-colors hover:border-border">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600/15 text-indigo-600 dark:text-indigo-300">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">페이지</Badge>
            <Link
              href={`/pages/${page.id}`}
              className="truncate font-medium text-foreground hover:text-indigo-500"
            >
              {page.title || "제목 없는 페이지"}
            </Link>
          </div>
          {page.snippet ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {page.snippet}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">본문 없음</p>
          )}
          <p className="text-xs text-muted-foreground">
            수정 {new Date(page.updatedAt).toLocaleString("ko-KR")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
