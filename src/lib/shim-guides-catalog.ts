// 심팀장 자료실 목록을 요청마다 디스크에서 읽는다.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ShimGuide } from "@/lib/shim-guides";

function guidesFilePath() {
  const fromFile = resolve(dirname(fileURLToPath(import.meta.url)), "../data/shim-guides.json");
  if (existsSync(fromFile)) return fromFile;
  return resolve(process.cwd(), "src/data/shim-guides.json");
}

export function listShimGuides(): ShimGuide[] {
  const parsed = JSON.parse(readFileSync(guidesFilePath(), "utf8")) as ShimGuide[];
  return [...parsed];
}

export function getShimGuide(slug: string): ShimGuide | undefined {
  return listShimGuides().find((guide) => guide.slug === slug);
}
