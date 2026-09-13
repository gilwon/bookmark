// 그록봇 템플릿 목록
import { GrokBotList } from "@/components/grok-bots/grok-bot-list";
import { auth } from "@/lib/auth";
import { rowToGrokBot } from "@/lib/grok-bot";
import { cachedUserList } from "@/lib/list-cache";
import { store } from "@/lib/store";

export const runtime = "nodejs";

export default async function GrokBotsPage() {
  const session = await auth();
  const userId = session!.user!.id;
  const rows = await cachedUserList(userId, "grok-bots", "all", () =>
    store.listGrokBots(userId)
  );
  const list = rows.map(rowToGrokBot);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium tracking-[-0.02em]">그록봇</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          그록봇 템플릿을 모아 두고, 카테고리와 즐겨찾기로 고른 뒤 바로 엽니다.
        </p>
      </div>
      <GrokBotList bots={list} />
    </div>
  );
}
