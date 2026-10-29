// 심팀장 자료실 목록의 조회와 검색을 제공한다.
import guides from "@/data/shim-guides.json";

export const SHIM_GUIDES_SOURCE = "https://shimteamjjang.vercel.app/";

export type ShimGuide = {
  slug: string;
  title: string;
  episode: string;
  summary: string;
  order: number;
  sourceUrl: string;
};

const catalog = guides as ShimGuide[];

export function listShimGuides(): ShimGuide[] {
  return [...catalog];
}

export function getShimGuide(slug: string): ShimGuide | undefined {
  return catalog.find((guide) => guide.slug === slug);
}

export function filterShimGuides(items: ShimGuide[], filters: { query?: string } = {}): ShimGuide[] {
  const normalize = (text: string) => text.toLowerCase().replace(/\s+/gu, "");
  const query = normalize(filters.query ?? "");
  if (!query) return items.filter(() => true);
  return items.filter((guide) =>
    normalize([guide.title, guide.summary, guide.episode, guide.slug].join(" ")).includes(query)
  );
}
