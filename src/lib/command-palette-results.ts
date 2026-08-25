// ⌘K 팔레트 목록 병합 — 통합검색 액션·검색결과·로딩·내비 순서
import type { QuickSearchItem, QuickSearchType } from "@/lib/quick-search";

/** 검색 결과 타입 뱃지 문구 */
export const SEARCH_TYPE_LABEL: Record<QuickSearchType, string> = {
  page: "페이지",
  prompt: "프롬프트",
  bookmark: "북마크",
  star: "Star",
  "agent-doc": "문서",
};

/** 필터에 쓰는 내비 항목 */
export type PaletteNavItem = {
  id: string;
  label: string;
  keywords?: string;
};

export type PaletteMergedItem =
  | {
      kind: "search-action";
      id: "action-search";
      label: string;
      disabled?: false;
    }
  | {
      kind: "search";
      id: string;
      label: string;
      subtitle: string;
      typeLabel: string;
      item: QuickSearchItem;
      disabled?: false;
    }
  | {
      kind: "loading";
      id: "search-loading";
      label: "검색 중…";
      disabled: true;
    }
  | {
      kind: "nav";
      id: string;
      label: string;
      disabled?: false;
    };

/** 통합검색 액션 → 검색결과 → 로딩행 → 필터된 내비 */
export function mergePaletteItems({
  navItems,
  searchItems,
  q,
  loading,
}: {
  navItems: PaletteNavItem[];
  searchItems: QuickSearchItem[];
  q: string;
  loading: boolean;
}): PaletteMergedItem[] {
  const trimmed = q.trim();
  const needle = trimmed.toLowerCase();
  const filteredNav: PaletteMergedItem[] = (
    needle
      ? navItems.filter((item) => {
          const hay = `${item.label} ${item.keywords ?? ""}`.toLowerCase();
          return hay.includes(needle);
        })
      : navItems
  ).map((item) => ({
    kind: "nav" as const,
    id: item.id,
    label: item.label,
  }));

  if (!trimmed) return filteredNav;

  const rows: PaletteMergedItem[] = [
    {
      kind: "search-action",
      id: "action-search",
      label: `「${trimmed}」통합 검색`,
    },
  ];

  for (const item of searchItems) {
    rows.push({
      kind: "search",
      id: `search-${item.type}-${item.id}`,
      label: item.title,
      subtitle: item.subtitle,
      typeLabel: SEARCH_TYPE_LABEL[item.type],
      item,
    });
  }

  if (loading) {
    rows.push({
      kind: "loading",
      id: "search-loading",
      label: "검색 중…",
      disabled: true,
    });
  }

  rows.push(...filteredNav);
  return rows;
}
