// heyjames.ai/skills 카탈로그 정적 데이터 헬퍼
import raw from "@/data/heyjames-skills.json";

export type HeyjamesSkillType =
  | "plugin"
  | "mcp"
  | "skill"
  | "cli"
  | "standard";

export type HeyjamesSkillItem = {
  id: number;
  slug: string;
  title: string;
  type: HeyjamesSkillType | string;
  description: string;
  views: number;
};

export const HEYJAMES_SKILL_TYPES: {
  id: HeyjamesSkillType | "all";
  label: string;
}[] = [
  { id: "all", label: "전체" },
  { id: "plugin", label: "플러그인" },
  { id: "mcp", label: "MCP 서버" },
  { id: "skill", label: "스킬" },
  { id: "cli", label: "CLI 도구" },
  { id: "standard", label: "라이브러리" },
];

const TYPE_LABEL = Object.fromEntries(
  HEYJAMES_SKILL_TYPES.filter((t) => t.id !== "all").map((t) => [
    t.id,
    t.label,
  ])
) as Record<string, string>;

/** 타입 한글 라벨 */
export function heyjamesSkillTypeLabel(type: string): string {
  return TYPE_LABEL[type] ?? type;
}

const items = raw as HeyjamesSkillItem[];

/** 전체 목록 */
export function listHeyjamesSkills(): HeyjamesSkillItem[] {
  return items;
}

/** slug로 단건 조회 */
export function getHeyjamesSkillBySlug(
  slug: string
): HeyjamesSkillItem | undefined {
  return items.find((s) => s.slug === slug);
}
