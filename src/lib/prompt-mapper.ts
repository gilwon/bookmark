// PromptRow ↔ Prompt 변환
import type { PromptRow } from "@/lib/store/types";
import type { Prompt, PromptSection } from "@/lib/types";

/** sections JSON 파싱 */
export function parsePromptSections(raw: string | null | undefined): PromptSection[] {
  try {
    const arr = JSON.parse(raw || "[]");
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (x): x is { title?: unknown; body?: unknown } =>
          !!x && typeof x === "object"
      )
      .map((x) => ({
        title: typeof x.title === "string" ? x.title : "",
        body: typeof x.body === "string" ? x.body : "",
      }));
  } catch {
    return [];
  }
}

/** DB 행 → UI 엔티티 */
export function rowToPrompt(row: PromptRow): Prompt {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    category: row.category,
    summary: row.summary,
    whenToUse: row.whenToUse,
    sections: parsePromptSections(row.sections),
    isFavorite: Boolean(row.isFavorite),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** 섹션 정규화 (빈 제목 보정) */
export function normalizeSections(
  sections: PromptSection[]
): PromptSection[] {
  return sections.map((s, i) => ({
    title: s.title.trim() || `${i + 1}차 프롬프트`,
    body: s.body,
  }));
}
