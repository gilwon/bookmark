// 북마크 URL 정규화 · 중복 비교 (쿼리 파라미터 제외)

/**
 * 비교용 키 생성.
 * - http/https 만
 * - 호스트 소문자
 * - 기본 포트 제거
 * - 쿼리(?…) · 해시(#…) 제거
 * - 경로 trailing slash 정규화 (루트 `/` 는 유지)
 */
export function bookmarkUrlKey(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;

  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;

  const host = u.hostname.toLowerCase();
  let port = u.port;
  if (
    (u.protocol === "http:" && port === "80") ||
    (u.protocol === "https:" && port === "443")
  ) {
    port = "";
  }

  let path = u.pathname || "/";
  // /foo/ → /foo (단, / 는 유지)
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  const authority = port ? `${host}:${port}` : host;
  return `${u.protocol}//${authority}${path}`.toLowerCase();
}

/** 두 URL 이 파라미터 제외 시 같은 주소인지 */
export function isSameBookmarkUrl(a: string, b: string): boolean {
  const ka = bookmarkUrlKey(a);
  const kb = bookmarkUrlKey(b);
  if (!ka || !kb) return false;
  return ka === kb;
}
