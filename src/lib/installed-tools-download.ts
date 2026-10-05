// 설치 현황 ZIP 다운로드 키 허용 판정(순수 함수, 테스트용으로 import 없이 둔다)

/** ZIP 서명 URL 의 유효 시간(초) */
export const INSTALLED_TOOLS_SIGNED_URL_TTL = 60;

/** ZIP 을 두는 Supabase Storage 비공개 버킷 */
export const INSTALLED_TOOLS_BUCKET = "installed-tools";

/**
 * 다운로드 키가 허용되는지 본다. 비었거나 `..`·선행 `/`·역슬래시가 있으면 거부하고,
 * 스냅샷 zipKey 집합에 정확히 있을 때만 허용한다.
 */
export function isAllowedZipKey(
  key: string | null | undefined,
  allowed: ReadonlySet<string>
): key is string {
  if (!key || key.includes("..") || key.startsWith("/") || key.includes("\\")) return false;
  return allowed.has(key);
}
