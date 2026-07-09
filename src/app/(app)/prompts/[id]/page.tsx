// 프롬프트 상세
import { notFound } from "next/navigation";
import { PromptDetail } from "@/components/prompts/prompt-detail";
import { auth } from "@/lib/auth";
import { rowToPrompt } from "@/lib/prompt-mapper";
import { store } from "@/lib/store";

export const runtime = "nodejs";

type Props = { params: Promise<{ id: string }> };

export default async function PromptDetailPage({ params }: Props) {
  const session = await auth();
  const userId = session!.user!.id;
  const { id } = await params;
  const row = await store.getPrompt(id, userId);
  if (!row) notFound();

  return <PromptDetail prompt={rowToPrompt(row)} />;
}
