// Claude Prompts 300 카탈로그 목록
import { ClaudePromptList } from "@/components/claude-prompts/claude-prompt-list";
import {
  CLAUDE_PROMPTS_CREDIT,
  listClaudePrompts,
} from "@/lib/claude-prompts-kr";

export const runtime = "nodejs";

export default function ClaudePromptsPage() {
  const items = listClaudePrompts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Claude Prompts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {CLAUDE_PROMPTS_CREDIT} · 카테고리별 300개. 카드에{" "}
          <strong className="font-medium text-foreground">한글 번역이 위</strong>
          , 영문 원문이 아래로 표시됩니다.
        </p>
      </div>
      <ClaudePromptList items={items} />
    </div>
  );
}
