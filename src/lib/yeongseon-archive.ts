// 신영선 자료 아카이브의 목록, 검색, 출처·주제 버튼을 제공한다.
import archive from "@/data/yeongseon-archive.json";

export const YEONGSEON_ARCHIVE_SOURCE = "https://yeongseon.kr/archive.html";

export const YEONGSEON_PAGE_SIZE = 24;

export type YeongseonArchiveItem = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  level: string;
  publishedAt: string;
  madeAt: string;
  source: string;
};

export type YeongseonArchiveFilters = {
  query?: string;
  source?: string;
  topic?: string;
};

export type YeongseonOption = {
  name: string;
  count: number;
};

const catalog = archive as YeongseonArchiveItem[];

export function articleUrl(id: string): string {
  return `https://yeongseon.kr/archive/${id}.html`;
}

export function listYeongseonArchive(): YeongseonArchiveItem[] {
  return [...catalog];
}

export function sourceOptions(items: YeongseonArchiveItem[]): YeongseonOption[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.source, (counts.get(item.source) ?? 0) + 1);
  }
  const names = [...counts.keys()].sort((a, b) => a.localeCompare(b, "ko"));
  return [
    { name: "", count: items.length },
    ...names.map((name) => ({ name, count: counts.get(name) ?? 0 })),
  ];
}

export function topicOptions(
  items: YeongseonArchiveItem[],
  source: string,
  selected: string
): YeongseonOption[] {
  const pool = source ? items.filter((item) => item.source === source) : items;
  const counts = new Map<string, number>();
  for (const item of pool) {
    for (const tag of item.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked.slice(0, 10).map(([name, count]) => ({ name, count }));
  if (selected && !top.some((option) => option.name === selected)) {
    top.push({ name: selected, count: counts.get(selected) ?? 0 });
  }
  return [{ name: "", count: pool.length }, ...top];
}

export function filterYeongseonArchive(
  items: YeongseonArchiveItem[],
  filters: YeongseonArchiveFilters = {}
): YeongseonArchiveItem[] {
  const query = (filters.query ?? "").trim().slice(0, 160).toLocaleLowerCase();
  const words = query.split(/\s+/u).filter(Boolean);
  const source = filters.source ?? "";
  const topic = filters.topic ?? "";
  return items.filter((item) => {
    if (source && item.source !== source) return false;
    if (topic && !item.tags.includes(topic)) return false;
    if (words.length === 0) return true;
    const haystack = [item.title, item.description, item.level, ...item.tags]
      .join(" ")
      .toLocaleLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

export function visibleCount(totalHits: number, shown: number): number {
  const raised = shown < YEONGSEON_PAGE_SIZE ? YEONGSEON_PAGE_SIZE : shown;
  return Math.min(raised, totalHits);
}
