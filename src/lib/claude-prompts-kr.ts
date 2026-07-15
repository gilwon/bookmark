// 300 Claude Prompts (우주보스) 정적 데이터 헬퍼
import raw from "@/data/claude-prompts-kr.json";

export type ClaudePromptCategory =
  | "productivity"
  | "research"
  | "content"
  | "ai"
  | "automation"
  | "coding";

export type ClaudePromptItem = {
  id: number;
  displayId: number;
  category: ClaudePromptCategory | string;
  title: string;
  titleKo: string;
  prompt: string;
  /** 영문 프롬프트의 한글 번역 (표시 시 위에 배치) */
  promptKo: string;
};

export const CLAUDE_PROMPT_CATEGORIES: {
  id: ClaudePromptCategory | "all";
  label: string;
}[] = [
  { id: "all", label: "전체" },
  { id: "productivity", label: "생산성" },
  { id: "research", label: "리서치" },
  { id: "content", label: "콘텐츠" },
  { id: "ai", label: "AI 워크플로우" },
  { id: "automation", label: "자동화" },
  { id: "coding", label: "코딩" },
];

const CAT_LABEL = Object.fromEntries(
  CLAUDE_PROMPT_CATEGORIES.filter((c) => c.id !== "all").map((c) => [
    c.id,
    c.label,
  ])
) as Record<string, string>;

/** 카테고리 한글 라벨 */
export function claudePromptCategoryLabel(cat: string): string {
  return CAT_LABEL[cat] ?? cat;
}

const items = raw as ClaudePromptItem[];

/** 전체 목록 (displayId 순) */
export function listClaudePrompts(): ClaudePromptItem[] {
  return items;
}

/** displayId 또는 원본 id 로 단건 조회 */
export function getClaudePrompt(
  idOrDisplay: string | number
): ClaudePromptItem | undefined {
  const n = typeof idOrDisplay === "number" ? idOrDisplay : Number(idOrDisplay);
  if (!Number.isFinite(n)) return undefined;
  return (
    items.find((p) => p.displayId === n) ?? items.find((p) => p.id === n)
  );
}

export const CLAUDE_PROMPTS_SOURCE =
  "https://claude-prompts-kr.vercel.app";
export const CLAUDE_PROMPTS_CREDIT = "우주보스 · 300 Claude Prompts";

/** 원본 사이트 사용법 안내 — [...] 자리표시자 교체 */
export const CLAUDE_PROMPTS_USAGE =
  "사용법 · [...] 대괄호 부분만 본인 상황에 맞게 바꿔주세요.";
