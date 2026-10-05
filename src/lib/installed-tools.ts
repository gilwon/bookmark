// 설치 현황 정적 스냅샷(src/data/installed-tools.json)의 타입과 로더
import raw from "@/data/installed-tools.json";
import ko from "@/data/installed-tools-ko.json";

/** 이 횟수 이상 쓴 항목은 카드를 강조 색으로 보인다 */
export const HEAVY_USE = 3;

export type InstalledSkillSource = "user" | "shared" | "bundled";

export type InstalledSkill = {
  name: string;
  description: string;
  source: InstalledSkillSource | string;
  /** 세션 기록에서 센 사용 횟수(신호가 없는 도구는 0) */
  uses: number;
  /** 영어뿐인 설명의 한글 번역(installed-tools-ko.json) */
  descriptionKo?: string;
};

export type InstalledPlugin = {
  name: string;
  version: string;
  marketplace: string;
  description: string;
  skillCount: number;
  /** 세션 기록에서 센 사용 횟수(신호가 없는 도구는 0) */
  uses: number;
  /** 영어뿐인 설명의 한글 번역(installed-tools-ko.json) */
  descriptionKo?: string;
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

/**
 * 설명에 한글이 없으면 번역 파일에서 키(도구id/종류/이름)로 찾은 한글 설명을 돌려준다.
 * 같은 이름이 출처만 달리 두 번 있으면 `키/출처` 를 먼저 본다
 */
function koFor(key: string, from: string, description: string): string | undefined {
  if (!description || /[가-힣]/.test(description)) return undefined;
  const map = ko as Record<string, string>;
  return map[`${key}/${from}`] || map[key] || undefined;
}

/** 스냅샷 전체에 한글 번역을 합쳐 돌려준다. 런타임에 파일시스템을 읽지 않는다. */
export function getInstalledTools(): InstalledToolsSnapshot {
  const snapshot = raw as InstalledToolsSnapshot;
  return {
    ...snapshot,
    tools: snapshot.tools.map((t) => ({
      ...t,
      skills: t.skills.map((s) => ({
        ...s,
        descriptionKo: koFor(`${t.id}/skill/${s.name}`, s.source, s.description),
      })),
      plugins: t.plugins.map((p) => ({
        ...p,
        descriptionKo: koFor(`${t.id}/plugin/${p.name}`, p.marketplace, p.description),
      })),
    })),
  };
}

/** 스킬 출처 배지 라벨 */
export function skillSourceLabel(source: string): string {
  if (source === "shared") return "공유";
  if (source === "bundled") return "번들";
  return "사용자";
}
