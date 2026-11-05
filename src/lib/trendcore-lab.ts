// 트렌드코어 스킬공유자료실 메타데이터의 조회·검색·분류·정렬을 제공한다.
import guides from "@/data/trendcore-lab.json";

export const TRENDCORE_LAB_SOURCE = "https://www.trendcore.co.kr/lab";

export type TrendcoreLabItem = {
  slug: string;
  title: string;
  summary: string;
  number: string;
  category: string;
  tags: string[];
  publishedAt: string;
  sourceUrl: string;
};

const items = guides as TrendcoreLabItem[];

export function listTrendcoreLab(): TrendcoreLabItem[] {
  return [...items];
}

export function getTrendcoreLab(slug: string): TrendcoreLabItem | undefined {
  return items.find((item) => item.slug === slug);
}

export function filterTrendcoreLab(
  source: TrendcoreLabItem[],
  filters: { query?: string; category?: string; sort?: "newest" | "oldest" } = {}
): TrendcoreLabItem[] {
  const normalize = (text: string) => text.toLowerCase().replace(/\s+/gu, "");
  const query = normalize(filters.query ?? "");
  return source
    .filter((item) => {
      const haystack = normalize([item.title, item.summary, item.number, item.category, ...item.tags].join(" "));
      return (!filters.category || item.category === filters.category) && (!query || haystack.includes(query));
    })
    .sort((a, b) => {
      const order = Date.parse(a.publishedAt) - Date.parse(b.publishedAt);
      return filters.sort === "oldest" ? order : -order;
    });
}
