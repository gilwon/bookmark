// 서버측 URL fetch SSRF 방어 — 공개 HTTP(S)만, DNS 후 사설 IP 차단
import dns from "node:dns/promises";
import net from "node:net";

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
  "0.0.0.0",
]);

/** IPv4/IPv6 문자열이 사설·루프백·링크로컬·특수 대역인지 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const parts = ip.split(".").map((n) => Number(n));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
    if (lower.startsWith("fe80")) return true; // link-local
    if (lower.startsWith("ff")) return true; // multicast
    // IPv4-mapped
    if (lower.startsWith("::ffff:")) {
      const mapped = lower.slice("::ffff:".length);
      if (net.isIPv4(mapped)) return isPrivateOrReservedIp(mapped);
    }
    return false;
  }
  return true;
}

/** http(s) URL 정규화 + 호스트 차단 목록 */
export function normalizeHttpUrl(raw: string): string {
  let url = raw.trim();
  if (!url) throw new UnsafeUrlError("URL이 비어 있습니다.");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UnsafeUrlError("올바른 URL 형식이 아닙니다.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UnsafeUrlError("http/https URL만 허용됩니다.");
  }
  if (parsed.username || parsed.password) {
    throw new UnsafeUrlError("URL 내 인증 정보는 허용되지 않습니다.");
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host) throw new UnsafeUrlError("호스트가 없습니다.");
  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new UnsafeUrlError("내부 호스트에는 접근할 수 없습니다.");
  }
  if (host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new UnsafeUrlError("로컬 호스트에는 접근할 수 없습니다.");
  }
  // 리터럴 IP
  if (net.isIP(host) && isPrivateOrReservedIp(host)) {
    throw new UnsafeUrlError("사설·예약 IP에는 접근할 수 없습니다.");
  }
  return parsed.toString();
}

/**
 * DNS 해석 후 모든 A/AAAA 가 공인 IP인지 확인.
 * 성공 시 정규화된 URL 문자열 반환.
 */
export async function assertPublicHttpUrl(raw: string): Promise<string> {
  const normalized = normalizeHttpUrl(raw);
  const host = new URL(normalized).hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new UnsafeUrlError("사설·예약 IP에는 접근할 수 없습니다.");
    }
    return normalized;
  }
  let records: { address: string; family: number }[];
  try {
    records = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError("호스트를 해석할 수 없습니다.");
  }
  if (!records.length) {
    throw new UnsafeUrlError("호스트를 해석할 수 없습니다.");
  }
  for (const r of records) {
    if (isPrivateOrReservedIp(r.address)) {
      throw new UnsafeUrlError(
        `호스트가 사설·예약 IP(${r.address})로 해석되어 차단했습니다.`
      );
    }
  }
  return normalized;
}

export type SafeFetchOptions = {
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
  headers?: Record<string, string>;
  /** text 대신 arrayBuffer 등 필요 시 */
  asText?: boolean;
};

/**
 * 안전 검사 + 수동 리다이렉트(매 hop 재검증) + 응답 크기 제한 fetch.
 */
export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {}
): Promise<{ url: string; status: number; headers: Headers; body: string }> {
  const timeoutMs = options.timeoutMs ?? 18_000;
  const maxRedirects = options.maxRedirects ?? 5;
  const maxBytes = options.maxBytes ?? 2_000_000;
  let url = await assertPublicHttpUrl(rawUrl);
  const seen = new Set<string>();

  for (let i = 0; i <= maxRedirects; i++) {
    if (seen.has(url)) {
      throw new UnsafeUrlError("리다이렉트가 반복됩니다.");
    }
    seen.add(url);

    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; MyMarkBot/1.0; +https://mymark.app)",
          accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "ko-KR,ko;q=0.9,en;q=0.8",
          "cache-control": "no-cache",
          ...options.headers,
        },
      });
    } catch (err) {
      if (err instanceof UnsafeUrlError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(msg || "fetch failed");
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new UnsafeUrlError(`리다이렉트(${res.status})에 Location 없음`);
      // 상대 경로 → 절대, 그다음 공개 검증
      const next = new URL(loc, url).toString();
      url = await assertPublicHttpUrl(next);
      continue;
    }

    if (!res.ok) {
      throw new Error(`페이지 응답 오류 (${res.status})`);
    }

    const len = res.headers.get("content-length");
    if (len && Number(len) > maxBytes) {
      throw new UnsafeUrlError("응답이 너무 큽니다.");
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > maxBytes) {
      throw new UnsafeUrlError("응답이 너무 큽니다.");
    }

    return {
      url,
      status: res.status,
      headers: res.headers,
      body: buf.toString("utf8"),
    };
  }

  throw new UnsafeUrlError("리다이렉트가 너무 많습니다.");
}
