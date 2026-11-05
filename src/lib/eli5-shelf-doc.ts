// 서버 전용. eli5 서가 본문 HTML을 읽고 테마를 넣어 문서 응답을 만든다.
import bodies from "@/data/eli5-shelf-bodies.json";
import { getEli5Shelf } from "@/lib/eli5-shelf";

const docBodies = bodies as Record<string, string>;

const textHeaders = { "content-type": "text/plain; charset=utf-8" };

/** 저장된 본문을 반환한다. 없거나 비어 있으면 undefined다. */
export function getEli5ShelfBody(id: string): string | undefined {
  const body = Object.hasOwn(docBodies, id) ? docBodies[id] : undefined;
  if (typeof body !== "string" || body.trim() === "") return undefined;
  return body;
}

/** 첫 번째 html 여는 태그에만 data-theme을 넣는다. html 태그가 없으면 그대로 둔다. */
function injectTheme(html: string, theme: "dark" | "light"): string {
  return html.replace(/<html\b([^>]*)>/i, (_tag, attrs: string) => {
    const rest = attrs.replace(/\sdata-theme\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, "");
    return `<html${rest} data-theme="${theme}">`;
  });
}

const CSP =
  "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'; img-src data: https:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox";

/** 로그인한 사용자에게만 서가 문서를 준다. 테마는 dark일 때만 dark이고 나머지는 light다. */
export function buildEli5ShelfDocResponse(opts: {
  id: string;
  userId?: string | null;
  theme?: string | null;
}): Response {
  if (!opts.userId) {
    return new Response("인증이 필요합니다.", { status: 401, headers: textHeaders });
  }
  const body = getEli5Shelf(opts.id) ? getEli5ShelfBody(opts.id) : undefined;
  if (body === undefined) {
    return new Response("찾을 수 없습니다.", { status: 404, headers: textHeaders });
  }
  return new Response(injectTheme(body, opts.theme === "dark" ? "dark" : "light"), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
      "content-security-policy": CSP,
      "x-frame-options": "SAMEORIGIN",
      "referrer-policy": "no-referrer",
    },
  });
}
