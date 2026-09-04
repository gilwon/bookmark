// Claude Prompts 300 카탈로그 목록
import { ClaudePromptList } from "@/components/claude-prompts/claude-prompt-list";
import {
  CLAUDE_PROMPTS_CREDIT,
  CLAUDE_PROMPTS_USAGE,
  listClaudePrompts,
} from "@/lib/claude-prompts-kr";

export const runtime = "nodejs";

export default function ClaudePromptsPage() {
  const items = listClaudePrompts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium tracking-[-0.02em]">Claude Prompts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {CLAUDE_PROMPTS_CREDIT} · 카테고리별 300개. 카드에{" "}
          <strong className="font-medium text-foreground">한글 번역이 위</strong>
          , 영문 원문이 아래로 표시됩니다.
        </p>
        <p className="mt-3 inline-flex max-w-xl items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          <span
            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
            aria-hidden
          />
          <span>
            <strong className="font-semibold">사용법</strong>
            {" · "}
            <code className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[13px]">
              [...]
            </code>{" "}
            대괄호 부분만 본인 상황에 맞게 바꿔주세요.
          </span>
        </p>
        <span className="sr-only">{CLAUDE_PROMPTS_USAGE}</span>
      </div>
      <ClaudePromptList items={items} />
    </div>
  );
}
