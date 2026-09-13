// 통합 검색 결과용 그록봇 카드
import Link from "next/link";
import { BotMessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export type GrokBotSearchResult = {
  id: string;
  name: string;
  category: string | null;
  snippet: string;
  updatedAt: string;
};

/** 검색 결과 목록에 표시하는 그록봇 한 줄 카드 */
export function GrokBotResultCard({ bot }: { bot: GrokBotSearchResult }) {
  return (
    <Link href={`/grok-bots/${bot.id}`} className="block">
      <Card className="h-full transition-colors hover:border-indigo-500/40">
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600/15 text-indigo-600 dark:text-indigo-300">
            <BotMessageSquare className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-sm font-medium">{bot.name}</p>
              {bot.category && (
                <Badge variant="secondary" className="max-w-[12rem] truncate">
                  {bot.category}
                </Badge>
              )}
            </div>
            {bot.snippet && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {bot.snippet}
              </p>
            )}
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              수정 {new Date(bot.updatedAt).toLocaleDateString("ko-KR")}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
