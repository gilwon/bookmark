// 목록 정렬·검색·페이징 공통 유틸

export type ListSortKey = "created_desc" | "updated_desc" | "title_asc";

export const DEFAULT_PAGE_SIZE = 24;

/** 공백 분리 토큰 전부 포함(AND). 빈 검색어면 true. */
export function matchesSearchTokens(haystack: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const hay = haystack.toLowerCase();
  const tokens = needle.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((t) => hay.includes(t));
}

/** ISO 날짜 내림차순 비교 (잘못된 값은 뒤로) */
export function compareIsoDesc(a: string, b: string): number {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
  if (Number.isNaN(ta)) return 1;
  if (Number.isNaN(tb)) return -1;
  return tb - ta;
}

export function compareTitleAsc(a: string, b: string): number {
  return a.localeCompare(b, "ko", { numeric: true, sensitivity: "base" });
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}

export function clampPage(page: number, total: number, pageSize: number): number {
  const tp = totalPages(total, pageSize);
  if (page < 1) return 1;
  if (page > tp) return tp;
  return page;
}

export function slicePage<T>(items: T[], page: number, pageSize: number): T[] {
  const p = clampPage(page, items.length, pageSize);
  const start = (p - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function formatListDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
