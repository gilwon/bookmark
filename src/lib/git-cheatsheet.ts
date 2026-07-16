// Git 명령어 치트시트 카테고리·그리드 데이터 헬퍼
import raw from "@/data/git-cheatsheet.json";

export type GitCheatsheetCategory =
  | "basic"
  | "branch"
  | "remote"
  | "undo"
  | "etc";

export type GitCheatsheetItem = {
  id: number;
  category: GitCheatsheetCategory | string;
  title: string;
  command: string;
  description: string;
};

export const GIT_CHEATSHEET_CATEGORIES: {
  id: GitCheatsheetCategory | "all";
  label: string;
}[] = [
  { id: "all", label: "전체" },
  { id: "basic", label: "기초" },
  { id: "branch", label: "브랜치" },
  { id: "remote", label: "원격" },
  { id: "undo", label: "되돌리기" },
  { id: "etc", label: "기타" },
];

const CAT_LABEL = Object.fromEntries(
  GIT_CHEATSHEET_CATEGORIES.filter((c) => c.id !== "all").map((c) => [
    c.id,
    c.label,
  ])
) as Record<string, string>;

/** 카테고리 한글 라벨 */
export function gitCheatsheetCategoryLabel(cat: string): string {
  return CAT_LABEL[cat] ?? cat;
}

const items = raw as GitCheatsheetItem[];

/** 전체 목록 */
export function listGitCheatsheet(): GitCheatsheetItem[] {
  return items;
}
