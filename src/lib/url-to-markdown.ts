// URL HTML 본문을 추출해 마크다운으로 변환
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";

export type UrlMarkdownResult = {
  title: string;
  markdown: string;
  sourceUrl: string;
  excerpt: string | null;
  /** 본문 추출 실패·제한 사이트여도 링크 스텁으로 채운 경우 */
  partial?: boolean;
  warning?: string;
};

function normalizeUrl(raw: string): string {
  let url = raw.trim();
  if (!url) throw new Error("URL이 비어 있습니다.");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  // eslint-disable-next-line no-new
  new URL(url);
  return url;
}

/** Notion 앱/워크스페이스 링크 여부 (공개 notion.site 제외) */
export function isNotionAppUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h.endsWith(".notion.site")) return false;
    return (
      h === "app.notion.com" ||
      h === "www.notion.so" ||
      h === "notion.so" ||
      h === "notion.com" ||
      h.endsWith(".notion.so") ||
      h.endsWith(".notion.com")
    );
  } catch {
    return /notion\.(com|so)/i.test(url);
  }
}

/** 공개 notion.site 는 시도 가치 있음 */
function isNotionPublicSite(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase().endsWith(".notion.site");
  } catch {
    return false;
  }
}

/** script/style 등 제거 후 문자열 정리 */
function scrubHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
}

function titleFromNotionPath(url: string): string {
  try {
    const u = new URL(url);
    // /p/workspace/Title-uuid 또는 /Title-uuid
    const segs = u.pathname.split("/").filter(Boolean);
    const last = segs[segs.length - 1] || "";
    const name = last
      .replace(/-[a-f0-9]{32}$/i, "")
      .replace(/-/g, " ")
      .trim();
    return name || "Notion 페이지";
  } catch {
    return "Notion 페이지";
  }
}

function notionStub(sourceUrl: string, reason: string): UrlMarkdownResult {
  const title = titleFromNotionPath(sourceUrl);
  const markdown = [
    `> 출처: [${sourceUrl}](${sourceUrl})`,
    "",
    `> ⚠️ ${reason}`,
    "",
    "## 메모",
    "",
    "_여기에 내용을 직접 붙여넣거나 작성하세요._",
    "",
  ].join("\n");
  return {
    title,
    markdown,
    sourceUrl,
    excerpt: null,
    partial: true,
    warning: reason,
  };
}

/**
 * 리다이렉트 루프를 피하기 위해 수동으로 최대 N회만 따라간다.
 */
async function fetchHtmlLimited(
  startUrl: string,
  maxRedirects = 5
): Promise<{ finalUrl: string; status: number; html: string }> {
  let url = startUrl;
  const seen = new Set<string>();

  for (let i = 0; i <= maxRedirects; i++) {
    if (seen.has(url)) {
      throw new Error(
        "리다이렉트가 반복됩니다 (redirect loop). 로그인·권한 페이지일 수 있습니다."
      );
    }
    seen.add(url);

    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(18_000),
        headers: {
          // 일반 브라우저 UA (봇 UA는 Notion 등에서 루프·차단되는 경우 있음)
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "ko-KR,ko;q=0.9,en;q=0.8",
          "cache-control": "no-cache",
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const cause =
        err instanceof Error && err.cause instanceof Error
          ? err.cause.message
          : "";
      if (/redirect count exceeded/i.test(msg + cause)) {
        throw new Error(
          "리다이렉트 한도 초과 — 로그인 필요·비공개 페이지일 수 있습니다."
        );
      }
      if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|certificate|fetch failed/i.test(msg + cause)) {
        throw new Error(
          `네트워크 오류로 가져오지 못했습니다.${cause ? ` (${cause})` : msg !== "fetch failed" ? ` (${msg})` : ""}`
        );
      }
      throw new Error(msg || "fetch failed");
    }

    // 3xx 수동 추적
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) {
        throw new Error(`리다이렉트 응답(${res.status})에 Location 없음`);
      }
      url = new URL(loc, url).toString();
      continue;
    }

    if (!res.ok) {
      throw new Error(`페이지 응답 오류 (${res.status})`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (
      contentType &&
      !/text\/html|application\/xhtml|text\/plain/i.test(contentType)
    ) {
      throw new Error("HTML 페이지가 아닙니다.");
    }

    const html = await res.text();
    return { finalUrl: url, status: res.status, html };
  }

  throw new Error("리다이렉트가 너무 많습니다.");
}

/**
 * URL을 fetch 해 본문을 마크다운으로 변환한다.
 * JS 전용·로그인·Notion 앱 페이지는 스텁/경고로 폴백한다.
 */
export async function fetchUrlAsMarkdown(
  rawUrl: string
): Promise<UrlMarkdownResult> {
  const sourceUrl = normalizeUrl(rawUrl);

  // app.notion.com 비공개/앱 링크는 스크래핑 불가에 가깝다 → 즉시 친절한 스텁
  if (
    isNotionAppUrl(sourceUrl) &&
    !isNotionPublicSite(sourceUrl) &&
    /app\.notion\.com/i.test(sourceUrl)
  ) {
    return notionStub(
      sourceUrl,
      "Notion 앱 링크(app.notion.com)는 로그인·JS 렌더링이라 서버에서 본문을 가져올 수 없습니다. " +
        "「공유 → 웹에 게시」한 notion.site 공개 링크를 쓰거나, 본문을 직접 붙여넣으세요."
    );
  }

  let finalUrl = sourceUrl;
  let html = "";
  try {
    const fetched = await fetchHtmlLimited(sourceUrl);
    finalUrl = fetched.finalUrl;
    html = scrubHtml(fetched.html);
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch failed";
    // Notion 계열 실패 시 스텁으로 저장 가능하게
    if (isNotionAppUrl(sourceUrl) || /notion/i.test(sourceUrl)) {
      return notionStub(
        sourceUrl,
        `Notion 페이지를 가져오지 못했습니다 (${message}). 공개 공유 링크를 쓰거나 본문을 직접 붙여넣으세요.`
      );
    }
    throw err instanceof Error ? err : new Error(message);
  }

  if (!html.trim()) throw new Error("빈 응답입니다.");

  // 로그인 페이지 휴리스틱
  if (
    /log\s*in|sign\s*in|로그인|인증이 필요/i.test(html.slice(0, 4000)) &&
    html.length < 80_000 &&
    !/<article/i.test(html)
  ) {
    if (isNotionAppUrl(sourceUrl)) {
      return notionStub(
        sourceUrl,
        "로그인 페이지로 보입니다. 공개 공유된 Notion 링크가 필요합니다."
      );
    }
  }

  const { document } = parseHTML(html);
  try {
    const base = document.createElement("base");
    base.setAttribute("href", finalUrl);
    document.head?.appendChild(base);
  } catch {
    // ignore
  }

  let title = "";
  let excerpt: string | null = null;
  let contentHtml = "";

  try {
    const article = new Readability(document as unknown as Document).parse();
    if (article) {
      title = article.title || "";
      excerpt = article.excerpt || null;
      contentHtml = article.content || "";
    }
  } catch {
    // Readability 실패 시 body 폴백
  }

  if (!contentHtml) {
    contentHtml =
      (document.body as { innerHTML?: string } | null)?.innerHTML || html;
  }
  if (!title) {
    title =
      document.querySelector("title")?.textContent?.trim() ||
      new URL(finalUrl).hostname;
  }

  // Notion 껍데기 HTML (본문 거의 없음)
  const textLen = contentHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    .length;
  if (textLen < 80 && (isNotionAppUrl(sourceUrl) || /notion/i.test(title))) {
    return notionStub(
      sourceUrl,
      "페이지 껍데기만 받아 본문이 비어 있습니다. Notion은 공개 웹 게시 링크 또는 수동 붙여넣기를 사용하세요."
    );
  }

  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });

  let markdown = "";
  try {
    markdown = turndown.turndown(contentHtml).trim();
  } catch {
    markdown = contentHtml
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (!markdown || markdown.length < 20) {
    if (isNotionAppUrl(sourceUrl)) {
      return notionStub(
        sourceUrl,
        "본문을 추출하지 못했습니다. 공개 공유 링크 또는 수동 붙여넣기를 사용하세요."
      );
    }
    throw new Error("본문을 추출하지 못했습니다. 다른 URL을 시도해 보세요.");
  }

  const header = [
    `> 출처: [${finalUrl}](${finalUrl})`,
    "",
    markdown,
  ].join("\n");

  return {
    title: title.slice(0, 200) || new URL(finalUrl).hostname,
    markdown: header,
    sourceUrl: finalUrl,
    excerpt,
  };
}
