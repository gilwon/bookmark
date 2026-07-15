// 통합 검색 결과용 프롬프트 카드
import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export type PromptSearchResult = {
  id: string;
  title: string;
  category: string | null;
  snippet: string;
  updatedAt: string;
};

/** 검색 결과 목록에 표시하는 프롬프트 한 줄 카드 */
export function PromptResultCard({ prompt }: { prompt: PromptSearchResult }) {
  return (
    <Link href={`/prompts/${prompt.id}`} className="block">
      <Card className="h-full transition-colors hover:border-indigo-500/40">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600/15 text-violet-600 dark:text-violet-300">
            <MessageSquareText className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-sm font-medium">{prompt.title}</p>
              {prompt.category && (
                <Badge variant="secondary" className="max-w-[12rem] truncate">
                  {prompt.category}
                </Badge>
              )}
            </div>
            {prompt.snippet && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {prompt.snippet}
              </p>
            )}
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              수정 {new Date(prompt.updatedAt).toLocaleDateString("ko-KR")}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
