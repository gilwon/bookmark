// 김스듴 가이드 본문 마크다운을 슬러그로 읽는다.
import bodies from "@/data/sdk-guide-bodies.json";

const guideBodies = bodies as Record<string, string>;

/** 저장된 가이드 본문을 반환한다. 없거나 비어 있으면 undefined다. */
export function getSdkGuideBody(slug: string): string | undefined {
  const body = guideBodies[slug];
  if (typeof body !== "string" || body.trim() === "") return undefined;
  return body;
}
