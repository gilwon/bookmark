// 검색 날짜 필터용 ISO 날짜 비교 유틸

/**
 * createdAt(ISO)이 from~to(YYYY-MM-DD) 범위 안인지 판별한다.
 * from/to는 로컬 캘린더 날짜 기준(포함).
 */
export function inDateRange(
  createdAt: string,
  from?: string | null,
  to?: string | null
): boolean {
  if (!from && !to) return true;

  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return false;

  if (from) {
    const start = Date.parse(`${from}T00:00:00.000`);
    if (!Number.isNaN(start) && t < start) return false;
  }
  if (to) {
    const end = Date.parse(`${to}T23:59:59.999`);
    if (!Number.isNaN(end) && t > end) return false;
  }
  return true;
}
