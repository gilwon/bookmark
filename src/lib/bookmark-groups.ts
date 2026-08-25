// 북마크 저장 카테고리를 목록 칩용 상위 그룹으로 접는다

export const UNCATEGORIZED_GROUP = "미분류";
export const SITE_GROUP = "사이트";
export const PC_BOOKMARK_GROUP = "PC 북마크";

const HOST_CHAR = /^[a-z0-9.-]+$/;
const COMMON_TLD =
  /\.(?:com|co\.kr|kr|org|io|ai|dev|net|app|club)$/i;

/** 호스트명처럼 보이는 카테고리인지 판정한다 */
function looksLikeHostname(value: string): boolean {
  if (
    !value ||
    value.includes(" ") ||
    value.includes("/") ||
    !value.includes(".")
  ) {
    return false;
  }
  return HOST_CHAR.test(value) || COMMON_TLD.test(value);
}

/** 저장 카테고리를 칩·섹션용 그룹 키로 접는다 */
export function bookmarkGroupKey(
  category: string | null | undefined
): string {
  const raw = category?.trim() ?? "";
  if (!raw) return UNCATEGORIZED_GROUP;
  if (
    raw === PC_BOOKMARK_GROUP ||
    raw.startsWith(`${PC_BOOKMARK_GROUP}/`)
  ) {
    return PC_BOOKMARK_GROUP;
  }
  if (looksLikeHostname(raw)) return SITE_GROUP;
  return raw;
}

/** 그룹 키의 표시 이름 */
export function bookmarkGroupLabel(key: string): string {
  return key;
}

/** 카테고리가 해당 그룹에 속하는지 */
export function bookmarkInGroup(
  category: string | null | undefined,
  groupKey: string
): boolean {
  return bookmarkGroupKey(category) === groupKey;
}
