// 김스듴 가이드 메타데이터의 조회·검색·분류·정렬을 제공한다.
import guides from "@/data/sdk-guides.json";

export const SDK_GUIDES_SOURCE = "https://sdk-kim-builds.com/guides/";

export type SdkGuide = {
  slug: string;
  title: string;
  category: string;
  tool: string;
  tags: string[];
  publishedAt: string;
  sourceUrl: string;
};

export function listSdkGuides(): SdkGuide[] {
  return [...guides];
}

export function getSdkGuide(slug: string): SdkGuide | undefined {
  return guides.find((guide) => guide.slug === slug);
}

export function filterSdkGuides(
  items: SdkGuide[],
  filters: { query?: string; category?: string; tool?: string; sort?: "newest" | "oldest" } = {}
): SdkGuide[] {
  const normalize = (text: string) => text.toLowerCase().replace(/\s+/gu, "");
  const query = normalize(filters.query ?? "");
  return items
    .filter((guide) =>
      (!filters.category || guide.category === filters.category) &&
      (!filters.tool || guide.tool === filters.tool) &&
      (!query || normalize([guide.title, ...guide.tags].join(" ")).includes(query))
    )
    .sort((a, b) => {
      const order = Date.parse(a.publishedAt) - Date.parse(b.publishedAt);
      return filters.sort === "oldest" ? order : -order;
    });
}
