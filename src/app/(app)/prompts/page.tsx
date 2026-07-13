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
          공유 프롬프트 라이브러리입니다. 모든 로그인 사용자가 목록·본문을
          보고 재사용할 수 있습니다.
        </p>
      </div>
      <PromptList prompts={list} />
    </div>
  );
}
