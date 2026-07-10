// open-graph-scraper 래핑 — URL 메타 추출 및 폴백
import { assertPublicHttpUrl, UnsafeUrlError } from "@/lib/safe-fetch";
import type { UrlMeta } from "./types";

/** URL에서 호스트명을 안전하게 추출한다. */
function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** 파비콘 URL을 추정한다. */
function guessFavicon(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}/favicon.ico`;
  } catch {
    return "";
  }
}

/** open-graph-scraper로 메타를 추출하고, 실패 시 호스트 기반 폴백을 반환한다. */
export async function extractMeta(
  url: string,
  options?: { timeoutSec?: number }
): Promise<UrlMeta> {
  const timeoutSec = options?.timeoutSec ?? 8;
  // SSRF 방어 — 사설·메타데이터 IP 차단
  let safeUrl = url;
  try {
    safeUrl = await assertPublicHttpUrl(url);
  } catch (err) {
    if (err instanceof UnsafeUrlError) throw err;
    throw new UnsafeUrlError(
      err instanceof Error ? err.message : "안전하지 않은 URL"
    );
  }

  const fallback: UrlMeta = {
    title: hostnameOf(safeUrl),
    description: null,
    image: null,
    favicon: guessFavicon(safeUrl) || null,
  };

  try {
    // ESM 이슈 회피용 dynamic import
    const ogs = (await import("open-graph-scraper")).default;
    const { result, error } = await ogs({
      url: safeUrl,
      timeout: timeoutSec,
      fetchOptions: {
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; MyMarkBot/1.0; +https://localhost)",
        },
      },
    });

    // error: true 이면 스크래핑 실패 — 폴백 사용
    if (error) {
      return fallback;
    }

    const title =
      result.ogTitle ||
      result.twitterTitle ||
      result.dcTitle ||
      result.ogSiteName ||
      fallback.title;

    const description =
      result.ogDescription ||
      result.twitterDescription ||
      result.dcDescription ||
      null;

    const image =
      result.ogImage?.[0]?.url ||
      result.twitterImage?.[0]?.url ||
      null;

    const favicon =
      result.favicon ||
      (result.ogUrl ? guessFavicon(result.ogUrl) : null) ||
      fallback.favicon;

    return {
      title: String(title),
      description: description ? String(description) : null,
      image: image ? String(image) : null,
      favicon: favicon ? String(favicon) : null,
    };
  } catch {
    return fallback;
  }
}

/** URL 호스트명으로 기본 카테고리를 만든다. */
export function categoryFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "기타";
  }
}

/**
 * 제한된 동시성으로 작업을 처리한다.
 * HTML import 등 대량 메타 추출에 사용.
 */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const i = next;
        next += 1;
        if (i >= items.length) break;
        results[i] = await fn(items[i], i);
      }
    }
  );
  await Promise.all(workers);
  return results;
}
