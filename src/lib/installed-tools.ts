// 설치 현황 스냅샷의 타입과 순수 함수(번역·용도 칩 병합·원본 선택). Storage 읽기는 installed-tools-source.ts
import raw from "@/data/installed-tools.json";
import ko from "@/data/installed-tools-ko.json";
import tagsMap from "@/data/installed-tools-tags.json";

/** 이 횟수 이상 쓴 항목은 카드를 강조 색으로 보인다 */
export const HEAVY_USE = 3;

/** 카드 용도 칩의 고정 목록(spec 30). 분류 파일 값은 이 안에서만 고른다 */
export const TOOL_TAGS = [
  "개발",
  "디자인·UI",
  "문서·글쓰기",
  "마케팅·SEO",
  "데이터·DB",
  "클라우드·배포",
  "브라우저·자동화",
  "에이전트·워크플로",
  "이미지·영상",
  "음악·오디오",
  "보안·검수",
  "그누보드·쇼핑몰",
  "연동·커넥터",
  "기타",
] as const;

export type InstalledSkillSource = "user" | "shared" | "bundled";

export type InstalledSkill = {
  name: string;
  description: string;
  source: InstalledSkillSource | string;
  /** 세션 기록에서 센 사용 횟수(신호가 없는 도구는 0) */
  uses: number;
  /** 영어뿐인 설명의 한글 번역(installed-tools-ko.json) */
  descriptionKo?: string;  /** GitHub 저장소 링크(로컬에서 확인된 출처만) */
  repoUrl?: string;
  /** 설치 명령(줄 단위) */
  installCommands?: string[];
  /** Supabase Storage 비공개 버킷의 ZIP 경로(업로드된 경우만) */
  zipKey?: string;
  /** 용도 칩(installed-tools-tags.json, TOOL_TAGS 안의 값만) */
  tags?: string[];
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
  descriptionKo?: string;  /** GitHub 저장소 링크(로컬에서 확인된 출처만) */
  repoUrl?: string;
  /** 설치 명령(줄 단위) */
  installCommands?: string[];
  /** Supabase Storage 비공개 버킷의 ZIP 경로(업로드된 경우만) */
  zipKey?: string;
  /** 용도 칩(installed-tools-tags.json, TOOL_TAGS 안의 값만) */
  tags?: string[];
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

/**
 * 분류 파일에서 키로 찾은 용도 칩. `키/출처` 를 먼저 보고, 목록 밖 문자열은 버린다. 없으면 undefined
 */
function tagsFor(key: string, from: string): string[] | undefined {
  const map = tagsMap as Record<string, string[]>;
  const list = (map[`${key}/${from}`] ?? map[key] ?? []).filter((t) =>
    (TOOL_TAGS as readonly string[]).includes(t)
  );
  return list.length ? list : undefined;
}

/** 빌드에 포함된 정적 스냅샷(src/data/installed-tools.json). Storage 원본이 없을 때 쓴다 */
export const localSnapshot = raw as InstalledToolsSnapshot;

/**
 * Storage 스냅샷과 정적 스냅샷 중 쓸 쪽을 고른다.
 * 원격이 없거나 형태가 깨졌거나 generatedAt 을 못 읽으면 정적, 둘 다 있으면 generatedAt 이 더 나중인 쪽(같으면 원격)
 */
export function pickLatestSnapshot(
  remote: unknown,
  local: InstalledToolsSnapshot
): InstalledToolsSnapshot {
  const r = remote as Partial<InstalledToolsSnapshot> | null | undefined;
  if (!r || typeof r.generatedAt !== "string" || !Array.isArray(r.tools)) return local;
  const rt = Date.parse(r.generatedAt);
  if (Number.isNaN(rt)) return local;
  const lt = Date.parse(local.generatedAt);
  return Number.isNaN(lt) || rt >= lt ? (r as InstalledToolsSnapshot) : local;
}

/** 스냅샷 전체에 한글 번역과 용도 칩을 합쳐 돌려준다. 원본(Storage·정적)과 상관없이 같은 규칙이다 */
export function mergeKo(snapshot: InstalledToolsSnapshot): InstalledToolsSnapshot {
  return {
    ...snapshot,
    tools: snapshot.tools.map((t) => ({
      ...t,
      skills: t.skills.map((s) => ({
        ...s,
        descriptionKo: koFor(`${t.id}/skill/${s.name}`, s.source, s.description),
        tags: tagsFor(`${t.id}/skill/${s.name}`, s.source),
      })),
      plugins: t.plugins.map((p) => ({
        ...p,
        descriptionKo: koFor(`${t.id}/plugin/${p.name}`, p.marketplace, p.description),
        tags: tagsFor(`${t.id}/plugin/${p.name}`, p.marketplace),
      })),
    })),
  };
}

/** 스냅샷에 실린 zipKey 집합. 다운로드 라우트가 허용 키 검증에 쓴다 */
export function zipKeysOf(snapshot: InstalledToolsSnapshot): Set<string> {
  return new Set(
    snapshot.tools.flatMap((t) => t.skills.map((s) => s.zipKey).filter((k): k is string => Boolean(k)))
  );
}

/** 한국 시간 `YYYY-MM-DD HH:mm`. 시간대를 고정해 서버·브라우저 출력이 같다 */
const kstFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** ISO 시각을 한국 시간 문자열로. 읽을 수 없으면 빈 문자열 */
export function formatKst(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? "" : kstFormat.format(t);
}

/** 스킬 출처 배지 라벨 */
export function skillSourceLabel(source: string): string {
  if (source === "shared") return "공유";
  if (source === "bundled") return "번들";
  return "사용자";
}

/** 설치 현황 정렬 모드. 이름순·많이 쓴 순·출처 있는 순 */
export type SortMode = "name" | "uses" | "source";

export const SORT_MODES: { value: SortMode; label: string }[] = [
  { value: "name", label: "이름순" },
  { value: "uses", label: "많이 쓴 순" },
  { value: "source", label: "출처 있는 순" },
];

/** URL 쿼리 값을 정렬 모드로 바꾼다. 알 수 없는 값은 이름순 */
export function parseSortMode(value: unknown): SortMode {
  return SORT_MODES.some((m) => m.value === value) ? (value as SortMode) : "name";
}

/**
 * 스킬·플러그인 목록을 복사해 정렬한다(원본 배열은 바꾸지 않는다).
 * uses 는 사용 횟수 내림차순, source 는 repoUrl 있는 항목 먼저, 동률은 이름순
 */
export function sortItems<T extends { name: string; uses: number; repoUrl?: string }>(
  items: readonly T[],
  mode: SortMode
): T[] {
  return [...items].sort((a, b) => {
    if (mode === "uses" && a.uses !== b.uses) return b.uses - a.uses;
    if (mode === "source" && !a.repoUrl !== !b.repoUrl) return a.repoUrl ? -1 : 1;
    return a.name.localeCompare(b.name, "ko");
  });
}
