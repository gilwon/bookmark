// eli5 설명서 서가의 목록 메타데이터 조회와 필터를 제공한다. 본문은 eli5-shelf-doc.ts에만 있다.
import shelf from "@/data/eli5-shelf.json";

export type Eli5ShelfItem = {
  id: string;
  title: string;
  repo: string;
  repoUrl: string;
  summary: string;
  kind: "설명" | "비교";
  tags: string[];
  date: string;
  sourceUrl: string;
};

const items = shelf as Eli5ShelfItem[];

export function listEli5Shelf(): Eli5ShelfItem[] {
  return [...items];
}

export function getEli5Shelf(id: string): Eli5ShelfItem | undefined {
  return items.find((item) => item.id === id);
}

export function filterEli5Shelf(
  source: Eli5ShelfItem[],
  filters: { query?: string; kind?: string; tag?: string } = {}
): Eli5ShelfItem[] {
  const normalize = (text: string) => text.toLowerCase().replace(/\s+/gu, "");
  const query = normalize(filters.query ?? "");
  return source.filter((item) => {
    const haystack = normalize([item.title, item.repo, item.summary, item.kind, ...item.tags].join(" "));
    return (
      (!filters.kind || item.kind === filters.kind) &&
      (!filters.tag || item.tags.includes(filters.tag)) &&
      (!query || haystack.includes(query))
    );
  });
}
