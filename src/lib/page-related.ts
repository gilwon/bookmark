// 페이지·북마크 관련도 점수 (호스트·제목 토큰)

export const RELATED_LIMIT = 6;

export type RelatedPageInput = {
  id: string;
  title: string;
  sourceUrl: string | null;
};

export type RelatedBookmarkInput = {
  id: string;
  title: string;
  url: string;
  category: string | null;
};

/** www. 를 뺀 소문자 호스트. 파싱 실패면 빈 문자열. */
export function relatedHost(url: string | null | undefined): string {
  if (!url) return "";
  let raw = url.trim();
  if (!raw) return "";
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** 2글자 이상, 공백 분리, 소문자. 중복은 한 번만. */
export function titleTokens(title: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of (title ?? "").toLowerCase().split(/\s+/)) {
    const t = raw.trim();
    if (t.length < 2 || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** 호스트 일치 +3, 제목 토큰 교집합 1개당 +1(최대 +3). */
export function relatedScore(input: {
  pageTitle: string;
  pageSourceUrl: string | null;
  otherTitle: string;
  otherUrl: string | null;
}): number {
  let score = 0;
  const hostA = relatedHost(input.pageSourceUrl);
  const hostB = relatedHost(input.otherUrl);
  if (hostA && hostB && hostA === hostB) score += 3;

  const other = new Set(titleTokens(input.otherTitle));
  let overlap = 0;
  for (const t of titleTokens(input.pageTitle)) {
    if (!other.has(t)) continue;
    overlap += 1;
  }
  score += Math.min(3, overlap);
  return score;
}

function byScoreThenTitle<T extends { title: string }>(
  a: { score: number; item: T },
  b: { score: number; item: T }
): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.item.title.localeCompare(b.item.title, "ko");
}

/** 자기 자신·점수 0을 빼고 상위 limit개를 고른다. */
export function pickRelatedPages(
  page: RelatedPageInput,
  others: RelatedPageInput[],
  limit = RELATED_LIMIT
): RelatedPageInput[] {
  return others
    .filter((p) => p.id !== page.id)
    .map((item) => ({
      item,
      score: relatedScore({
        pageTitle: page.title,
        pageSourceUrl: page.sourceUrl,
        otherTitle: item.title,
        otherUrl: item.sourceUrl,
      }),
    }))
    .filter((x) => x.score > 0)
    .sort(byScoreThenTitle)
    .slice(0, limit)
    .map((x) => x.item);
}

/** 북마크 url 호스트 vs 페이지 sourceUrl 호스트. */
export function pickRelatedBookmarks(
  page: RelatedPageInput,
  bookmarks: RelatedBookmarkInput[],
  limit = RELATED_LIMIT
): RelatedBookmarkInput[] {
  return bookmarks
    .map((item) => ({
      item,
      score: relatedScore({
        pageTitle: page.title,
        pageSourceUrl: page.sourceUrl,
        otherTitle: item.title,
        otherUrl: item.url,
      }),
    }))
    .filter((x) => x.score > 0)
    .sort(byScoreThenTitle)
    .slice(0, limit)
    .map((x) => x.item);
}

export function pickRelated(
  page: RelatedPageInput,
  pages: RelatedPageInput[],
  bookmarks: RelatedBookmarkInput[],
  limit = RELATED_LIMIT
): { pages: RelatedPageInput[]; bookmarks: RelatedBookmarkInput[] } {
  return {
    pages: pickRelatedPages(page, pages, limit),
    bookmarks: pickRelatedBookmarks(page, bookmarks, limit),
  };
}
