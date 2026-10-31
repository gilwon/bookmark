// 신영선 자료 아카이브 본문을 id로 읽는다.
import bodies from "@/data/yeongseon-archive-bodies.json";

const archiveBodies = bodies as Record<string, string>;

/** 저장된 자료 본문을 반환한다. 없거나 비어 있으면 undefined다. */
export function getYeongseonArchiveBody(id: string): string | undefined {
  const body = archiveBodies[id];
  if (typeof body !== "string" || body.trim() === "") return undefined;
  return body;
}
