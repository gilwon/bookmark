// open-graph-scraper 래핑 — URL 메타 추출 및 폴백
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
export async function extractMeta(url: string): Promise<UrlMeta> {
  const fallback: UrlMeta = {
    title: hostnameOf(url),
    description: null,
    image: null,
    favicon: guessFavicon(url) || null,
  };

  try {
    // ESM 이슈 회피용 dynamic import
    const ogs = (await import("open-graph-scraper")).default;
    const { result, error } = await ogs({
      url,
      timeout: 8,
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
