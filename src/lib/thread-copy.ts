// 스레드 카피 제목·태그·출처 URL 정규화
import { MAX_COPY_TITLE_LEN } from "@/lib/api-limits";
import type { ThreadCopy } from "@/lib/types";
import type { ThreadCopyRow } from "@/lib/store/types";

const FALLBACK_TITLE = "제목 없는 카피";

/** 운영 DB에 테이블이 아직 없을 때 사용자에게 보일 안내. */
export const THREAD_COPIES_TABLE_USER_MESSAGE =
  "카피 테이블이 없습니다. supabase/add_thread_copies.sql 을 SQL Editor에서 실행하세요.";

/** PostgREST가 thread_copies 부재를 말할 때 true다. */
export function isMissingThreadCopiesTable(message: unknown): boolean {
  const text = String(message ?? "");
  if (!/thread_copies/i.test(text)) return false;
  return /schema cache|does not exist|PGRST205|Could not find the table/i.test(
    text
  );
}

/** 명시 제목 우선, 없으면 본문 첫 비어 있지 않은 줄. 200자 제한. */
export function titleFromCopyBody(body: string, title?: string): string {
  const explicit = title?.trim();
  if (explicit) return truncateTitle(explicit);
  const first = String(body ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (first) return truncateTitle(first);
  return FALLBACK_TITLE;
}

function truncateTitle(s: string): string {
  return s.length > MAX_COPY_TITLE_LEN ? s.slice(0, MAX_COPY_TITLE_LEN) : s;
}

/** JSON 배열 문자열·쉼표 구분·string[] 을 태그 배열로 만든다. */
export function parseCopyTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return uniqueTags(raw);
  }
  if (typeof raw !== "string") return [];
  const s = raw.trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      const v = JSON.parse(s) as unknown;
      if (Array.isArray(v)) return uniqueTags(v);
    } catch {
      // JSON이 아니면 쉼표 구분으로 처리
    }
  }
  return uniqueTags(s.split(","));
}

function uniqueTags(raw: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** 공백 제거 후 빈 값은 null. */
export function normalizeSourceUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t ? t : null;
}

/** store 행을 앱 ThreadCopy 로 변환한다. */
export function rowToThreadCopy(row: ThreadCopyRow): ThreadCopy {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    body: row.body,
    sourceUrl: row.sourceUrl ?? null,
    tags: parseCopyTags(row.tags),
    isFavorite: Boolean(row.isFavorite),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
