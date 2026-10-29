// 심팀장 자료실 본문 마크다운을 슬러그로 읽는다.
import bodies from "@/data/shim-guide-bodies.json";

const guideBodies = bodies as Record<string, string>;

/** 저장된 자료 본문을 반환한다. 없거나 비어 있으면 undefined다. */
export function getShimGuideBody(slug: string): string | undefined {
  const body = guideBodies[slug];
  if (typeof body !== "string" || body.trim() === "") return undefined;
  return body;
}
