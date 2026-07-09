// 프롬프트 수정
import { notFound } from "next/navigation";
import { PromptEditor } from "@/components/prompts/prompt-editor";
import { auth } from "@/lib/auth";
import { rowToPrompt } from "@/lib/prompt-mapper";
import { store } from "@/lib/store";

export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

export default async function PromptEditPage({ params }: Props) {
  const session = await auth();
  const userId = session!.user!.id;
  const { id } = await params;
  const row = await store.getPrompt(id, userId);
  if (!row) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">프롬프트 수정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          메타 정보와 섹션 본문을 편집한 뒤 저장하세요.
        </p>
      </div>
      <PromptEditor mode="edit" initial={rowToPrompt(row)} />
    </div>
  );
}
