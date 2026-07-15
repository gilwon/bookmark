// 통합 빠른 검색 결과 타입 (API · 대시보드 UI 공유)

export type QuickSearchType =
  | "bookmark"
  | "page"
  | "prompt"
  | "agent-doc"
  | "star";

export type QuickSearchItem = {
  type: QuickSearchType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  /** 외부 링크 여부 (북마크 URL, Star 레포) */
  external?: boolean;
};
