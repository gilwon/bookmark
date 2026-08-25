// 페이지 찾기용 평문·태그·원문 URL을 본문에서 뽑는다
import { extractTiptapText } from "@/lib/tiptap-text";

const SEARCH_TEXT_MAX = 20000;
const MAX_TAGS = 6;
const TRACKING_PARAM = /^(fbclid|utm_.*)$/i;
const HTTPS_RE = /https:\/\/[^\s<>"'`)\]}]+/gi;
const MD_LINK_RE = /\[([^\]]*)\]\((https:\/\/[^)\s]+)\)/gi;

type TipTapLike = {
  text?: string;
  content?: unknown;
  attrs?: Record<string, unknown>;
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
};

type UrlHit = { url: string; preferred: boolean; order: number };

/** JSON 문자열이면 파싱하고, 아니면 그대로 둔다. */
function coerceContent(contentUnknown: unknown): unknown {
  if (typeof contentUnknown !== "string") return contentUnknown;
  const trimmed = contentUnknown.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return contentUnknown;
    }
  }
  return contentUnknown;
}

/** data: URL(특히 data:image)을 검색어에서 뺀다. */
export function stripDataUrls(text: string): string {
  if (!text) return "";
  return text.replace(/data:[^\s"'<>)]+/gi, "");
}

/** 제목+본문 평문을 압축하고 상한까지 자른다. */
export function buildSearchText(title: string, contentUnknown: unknown): string {
  const extracted = extractTiptapText(coerceContent(contentUnknown));
  const raw = `${title ?? ""} ${extracted}`;
  return stripDataUrls(raw).replace(/\s+/g, " ").trim().slice(0, SEARCH_TEXT_MAX);
}

/** fbclid·utm_* 쿼리만 지운다. 나머지 쿼리는 유지한다. */
function stripTrackingQuery(raw: string): string | null {
  const trimmed = raw.trim().replace(/[.,;:!?]+$/g, "");
  if (!trimmed || /^data:/i.test(trimmed)) return null;
  if (!/^https:\/\//i.test(trimmed)) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "https:") return null;
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAM.test(key)) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return null;
  }
}

/** 첨부·이미지 URL은 원문 주소로 쓰지 않는다. */
export function isJunkSourceUrl(url: string): boolean {
  if (/supabase\.co\/storage/i.test(url)) return true;
  if (/file\.notion\.so/i.test(url)) return true;
  if (/^data:/i.test(url)) return true;
  if (/\.(?:png|jpe?g|gif|webp|svg|avif)(?:$|[?#])/i.test(url)) return true;
  return false;
}

function pushHit(hits: UrlHit[], raw: string, preferred: boolean, order: number) {
  const url = stripTrackingQuery(raw);
  if (!url) return;
  if (!preferred && isJunkSourceUrl(url)) return;
  hits.push({ url, preferred, order });
}

function nodeText(node: TipTapLike): string {
  return typeof node.text === "string" ? node.text : "";
}

function walkForUrls(content: unknown, hits: UrlHit[], inheritedPreferred: boolean) {
  if (content == null) return;
  if (typeof content === "string") {
    collectFromString(content, hits, inheritedPreferred);
    return;
  }
  if (Array.isArray(content)) {
    let afterOriginal = inheritedPreferred;
    for (const child of content) {
      walkForUrls(child, hits, afterOriginal);
      if (typeof child === "string") {
        if (child.includes("원문")) afterOriginal = true;
      } else if (child && typeof child === "object") {
        if (nodeText(child as TipTapLike).includes("원문")) afterOriginal = true;
      }
    }
    return;
  }
  if (typeof content !== "object") return;

  const node = content as TipTapLike;
  const text = nodeText(node);
  const preferred = inheritedPreferred || text.includes("원문");

  if (node.marks) {
    for (const mark of node.marks) {
      const href = mark.attrs?.href;
      if (typeof href === "string") {
        pushHit(hits, href, preferred, hits.length);
      }
    }
  }
  if (node.attrs) {
    for (const key of ["url", "href"]) {
      const v = node.attrs[key];
      if (typeof v === "string" && v) {
        pushHit(hits, v, preferred, hits.length);
      }
    }
  }
  if (text) collectFromString(text, hits, preferred);
  if (node.content) walkForUrls(node.content, hits, preferred);
}

function collectFromString(s: string, hits: UrlHit[], inheritedPreferred: boolean) {
  const consumed: Array<{ start: number; end: number }> = [];
  MD_LINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MD_LINK_RE.exec(s)) !== null) {
    const label = m[1] ?? "";
    const before = s.slice(Math.max(0, m.index - 24), m.index);
    const preferred =
      inheritedPreferred || label.includes("원문") || before.includes("원문");
    pushHit(hits, m[2] ?? "", preferred, hits.length);
    consumed.push({ start: m.index, end: m.index + m[0].length });
  }
  HTTPS_RE.lastIndex = 0;
  while ((m = HTTPS_RE.exec(s)) !== null) {
    const overlap = consumed.some(
      (r) => m!.index >= r.start && m!.index < r.end
    );
    if (overlap) continue;
    const before = s.slice(Math.max(0, m.index - 24), m.index);
    const preferred = inheritedPreferred || before.includes("원문");
    pushHit(hits, m[0], preferred, hits.length);
  }
}

/** 본문에서 첫 https URL. `원문` 근처 링크를 우선한다. */
export function extractSourceUrl(contentUnknown: unknown): string | null {
  const hits: UrlHit[] = [];
  walkForUrls(coerceContent(contentUnknown), hits, false);
  const preferred = hits.find((h) => h.preferred);
  if (preferred) return preferred.url;
  return hits[0]?.url ?? null;
}

function hostnameOf(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

function pushTag(tags: string[], tag: string) {
  if (!tag || tags.includes(tag)) return;
  if (tags.length >= MAX_TAGS) return;
  tags.push(tag);
}

/** 호스트·키워드로 태그를 추론한다. `디자인`은 제목 단서 있을 때만. */
export function inferPageTags(input: {
  title: string;
  sourceUrl: string | null;
  searchText: string;
}): string[] {
  const tags: string[] = [];
  const host = hostnameOf(input.sourceUrl);
  const title = input.title ?? "";
  const hay = `${title} ${input.searchText ?? ""}`;

  if (hostMatches(host, "notion.site") || hostMatches(host, "notion.so")) {
    pushTag(tags, "Notion");
  }
  if (hostMatches(host, "worpsense.com")) pushTag(tags, "Worpsense");
  if (host.includes("gymcoding.co")) pushTag(tags, "짐코딩");
  if (
    hostMatches(host, "looka.com") ||
    hostMatches(host, "logomark.io") ||
    hostMatches(host, "brandmark.io") ||
    hostMatches(host, "namelix.com") ||
    host.includes("hatchful")
  ) {
    pushTag(tags, "로고");
  }
  if (hostMatches(host, "github.com")) pushTag(tags, "GitHub");
  if (hostMatches(host, "naver.com")) pushTag(tags, "네이버");

  if (/프롬프트/i.test(hay)) pushTag(tags, "프롬프트");
  if (/claude/i.test(hay)) pushTag(tags, "Claude");
  if (/스킬/.test(hay)) pushTag(tags, "스킬");
  // 북마크 카테고리명 `디자인`은 넣지 않는다. 제목에 단서가 있을 때만.
  if (/디자인|로고|UI/i.test(title)) pushTag(tags, "디자인");
  if (/chatgpt/i.test(hay)) pushTag(tags, "ChatGPT");
  if (/자동화/.test(hay)) pushTag(tags, "자동화");

  return tags.slice(0, MAX_TAGS);
}

/** 검색 평문은 항상 다시 만들고, 원문 URL·태그는 비었을 때만 채운다. */
export function preparePageFindability(input: {
  title: string;
  content: unknown;
  existingTags?: string[] | null;
  existingSourceUrl?: string | null;
}): {
  searchText: string;
  sourceUrl: string | null;
  tags: string[];
} {
  const searchText = buildSearchText(input.title, input.content);
  const trimmedExisting = input.existingSourceUrl?.trim() || "";
  const sourceUrl = trimmedExisting || extractSourceUrl(input.content);
  const existingTags = (input.existingTags ?? []).filter(
    (t) => typeof t === "string" && t.length > 0
  );
  const tags =
    existingTags.length > 0
      ? existingTags
      : inferPageTags({ title: input.title, sourceUrl, searchText });
  return { searchText, sourceUrl, tags };
}
