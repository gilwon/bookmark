// 트렌드코어 스킬공유자료실 본문 마크다운을 슬러그로 읽는다.
import bodies from "@/data/trendcore-lab-bodies.json";

const labBodies = bodies as Record<string, string>;

/** 저장된 자료 본문을 반환한다. 없거나 비어 있으면 undefined다. */
export function getTrendcoreLabBody(slug: string): string | undefined {
  const body = labBodies[slug];
  if (typeof body !== "string" || body.trim() === "") return undefined;
  return body;
}
