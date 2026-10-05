// 설치 현황 정적 스냅샷(src/data/installed-tools.json)의 타입과 로더
import raw from "@/data/installed-tools.json";

export type InstalledSkillSource = "user" | "shared" | "bundled";

export type InstalledSkill = {
  name: string;
  description: string;
  source: InstalledSkillSource | string;
};

export type InstalledPlugin = {
  name: string;
  version: string;
  marketplace: string;
  description: string;
  skillCount: number;
};

export type InstalledTool = {
  id: string;
  label: string;
  skills: InstalledSkill[];
  plugins: InstalledPlugin[];
};

export type InstalledToolsSnapshot = {
  generatedAt: string;
  tools: InstalledTool[];
};

/** 스냅샷 전체를 돌려준다. 런타임에 파일시스템을 읽지 않는다. */
export function getInstalledTools(): InstalledToolsSnapshot {
  return raw as InstalledToolsSnapshot;
}

/** 스킬 출처 배지 라벨 */
export function skillSourceLabel(source: string): string {
  if (source === "shared") return "공유";
  if (source === "bundled") return "번들";
  return "사용자";
}
