// API 요청 본문 크기·필드 길이 상한

/** 페이지 TipTap JSON 직렬화 최대 바이트 */
export const MAX_PAGE_CONTENT_BYTES = 1_500_000;
/** 페이지 제목 최대 길이 */
export const MAX_PAGE_TITLE_LEN = 500;
/** 프롬프트 섹션 전체 JSON 최대 바이트 */
export const MAX_PROMPT_SECTIONS_BYTES = 800_000;
/** 프롬프트 제목 */
export const MAX_PROMPT_TITLE_LEN = 300;
/** 에이전트 문서 파일 개수 */
export const MAX_AGENT_DOC_FILES = 40;
/** 에이전트 문서 단일 파일 본문 바이트 */
export const MAX_AGENT_DOC_FILE_BYTES = 400_000;
/** 에이전트 문서 전체 번들 바이트 */
export const MAX_AGENT_DOC_TOTAL_BYTES = 1_500_000;
/** 북마크 태그 개수 */
export const MAX_BOOKMARK_TAGS = 30;
/** 카테고리 이름 */
export const MAX_CATEGORY_NAME_LEN = 80;

/** UTF-8 바이트 길이 */
export function utf8Bytes(s: string): number {
  return Buffer.byteLength(s, "utf8");
}

/** 초과 시 에러 메시지, 아니면 null */
export function overLimitMessage(
  label: string,
  bytes: number,
  max: number
): string | null {
  if (bytes <= max) return null;
  return `${label}이(가) 너무 큽니다. (${bytes}B / 최대 ${max}B)`;
}
