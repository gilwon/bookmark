// 프롬프트 라이브러리 목록
import { PromptList } from "@/components/prompts/prompt-list";
import { auth } from "@/lib/auth";
import { rowToPrompt } from "@/lib/prompt-mapper";
import { store } from "@/lib/store";

export const runtime = "nodejs";

export default async function PromptsPage() {
  const session = await auth();
  const userId = session!.user!.id;
  const rows = await store.listPrompts(userId);
  const list = rows.map(rowToPrompt);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">프롬프트</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          재사용 프롬프트를 등록하고, 목차·사용 상황·1차/2차 본문을 관리합니다.
        </p>
      </div>
      <PromptList prompts={list} />
    </div>
  );
}
