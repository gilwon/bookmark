// 프롬프트 라이브러리 목록
import { PromptList } from "@/components/prompts/prompt-list";
import { auth } from "@/lib/auth";
import { cachedUserList } from "@/lib/list-cache";
import { parseListQuery } from "@/lib/list-query";
import { rowToPrompt } from "@/lib/prompt-mapper";
import { store } from "@/lib/store";

export const runtime = "nodejs";

export default async function PromptsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const session = await auth();
  const userId = session!.user!.id;
  const query = parseListQuery(await searchParams);
  const [rows, total] = await Promise.all([
    cachedUserList(userId, "prompts", `rows:${query.q}:${query.page}`, () =>
      store.listPrompts(userId, query)
    ),
    cachedUserList(userId, "prompts", `count:${query.q}`, () =>
      store.countPrompts({ q: query.q })
    ),
  ]);
  const list = rows.map(rowToPrompt);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium tracking-[-0.02em]">프롬프트</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          공유 프롬프트 라이브러리입니다. 등록일·수정일 정렬과 검색·페이징으로
          빠르게 찾을 수 있습니다.
        </p>
      </div>
      <PromptList prompts={list} total={total} page={query.page} q={query.q} />
    </div>
  );
}
