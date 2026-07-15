// Claude Prompt 단건 상세
import { notFound } from "next/navigation";
import { ClaudePromptDetail } from "@/components/claude-prompts/claude-prompt-detail";
import { getClaudePrompt } from "@/lib/claude-prompts-kr";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export default async function ClaudePromptDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const item = getClaudePrompt(id);
  if (!item) notFound();
  return <ClaudePromptDetail item={item} />;
}
