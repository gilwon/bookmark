// URL HTML 본문을 추출해 마크다운으로 변환
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";

export type UrlMarkdownResult = {
  title: string;
  markdown: string;
  sourceUrl: string;
  excerpt: string | null;
};

function normalizeUrl(raw: string): string {
  let url = raw.trim();
  if (!url) throw new Error("URL이 비어 있습니다.");
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  // 유효성
  // eslint-disable-next-line no-new
  new URL(url);
  return url;
}

/** script/style 등 제거 후 문자열 정리 */
function scrubHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
}

/**
 * URL을 fetch 해 본문을 마크다운으로 변환한다.
 * JS 전용 사이트·로그인 페이지는 본문이 부실할 수 있다.
 */
export async function fetchUrlAsMarkdown(
  rawUrl: string
): Promise<UrlMarkdownResult> {
  const sourceUrl = normalizeUrl(rawUrl);

  const res = await fetch(sourceUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(18_000),
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; MyMarkBot/1.0; +https://localhost)",
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ko,en;q=0.8",
    },
  });

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

  const html = scrubHtml(await res.text());
  if (!html.trim()) throw new Error("빈 응답입니다.");

  const { document } = parseHTML(html);
  // 상대 링크 해석용 base
  try {
    const base = document.createElement("base");
    base.setAttribute("href", sourceUrl);
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
      new URL(sourceUrl).hostname;
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

  if (!markdown) {
    throw new Error("본문을 추출하지 못했습니다. 다른 URL을 시도해 보세요.");
  }

  // 원문 링크를 상단에 고정
  const header = [
    `> 출처: [${sourceUrl}](${sourceUrl})`,
    "",
    markdown,
  ].join("\n");

  return {
    title: title.slice(0, 200) || new URL(sourceUrl).hostname,
    markdown: header,
    sourceUrl,
    excerpt,
  };
}
