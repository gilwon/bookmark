// 심팀장 자료실 검색과 출처 상수를 제공한다.

export const SHIM_GUIDES_SOURCE = "https://shimteamjjang.vercel.app/";

export type ShimGuide = {
  slug: string;
  title: string;
  episode: string;
  summary: string;
  order: number;
  sourceUrl: string;
};

export function filterShimGuides(items: ShimGuide[], filters: { query?: string } = {}): ShimGuide[] {
  const normalize = (text: string) => text.toLowerCase().replace(/\s+/gu, "");
  const query = normalize(filters.query ?? "");
  if (!query) return items.filter(() => true);
  return items.filter((guide) =>
    normalize([guide.title, guide.summary, guide.episode, guide.slug].join(" ")).includes(query)
  );
}
