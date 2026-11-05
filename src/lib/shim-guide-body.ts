// 심팀장 자료실 본문 마크다운을 슬러그로 읽는다.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function bodiesFilePath() {
  const fromFile = resolve(dirname(fileURLToPath(import.meta.url)), "../data/shim-guide-bodies.json");
  if (existsSync(fromFile)) return fromFile;
  return resolve(process.cwd(), "src/data/shim-guide-bodies.json");
}

function readBodies(): Record<string, string> {
  const parsed = JSON.parse(readFileSync(bodiesFilePath(), "utf8")) as Record<string, unknown>;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as Record<string, string>;
}

/** 저장된 자료 본문을 반환한다. 없거나 비어 있으면 undefined다. */
export function getShimGuideBody(slug: string): string | undefined {
  const body = readBodies()[slug];
  if (typeof body !== "string" || body.trim() === "") return undefined;
  return body;
}
