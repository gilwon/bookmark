// 에이전트 문서 멀티 파일 번들 유틸 (.skill + skill.md)

export type AgentDocFilePart = {
  filename: string;
  content: string;
};

/** skill.md / SKILL.md 여부 */
export function isSkillMdName(name: string): boolean {
  const base = name.trim().replace(/\\/g, "/").split("/").pop() || "";
  return /^skill\.md$/i.test(base) || /^skill\.markdown$/i.test(base);
}

/** .skill 파일 여부 */
export function isSkillExtName(name: string): boolean {
  const base = name.trim().replace(/\\/g, "/").split("/").pop() || "";
  return /\.skill$/i.test(base);
}

/** 업로드 허용 텍스트 계열 확장자 */
export function isAllowedAgentDocName(name: string): boolean {
  const base = name.trim().replace(/\\/g, "/").split("/").pop() || "";
  return (
    isSkillExtName(base) ||
    /\.(md|markdown|mdx|txt)$/i.test(base)
  );
}

/** bundle JSON 파싱 (실패 시 빈 배열) */
export function parseBundle(raw: string | null | undefined): AgentDocFilePart[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (x): x is AgentDocFilePart =>
          !!x &&
          typeof x === "object" &&
          typeof (x as AgentDocFilePart).filename === "string" &&
          typeof (x as AgentDocFilePart).content === "string"
      )
      .map((x) => ({
        filename: x.filename,
        content: x.content,
      }));
  } catch {
    return [];
  }
}

/** 번들 직렬화 */
export function serializeBundle(files: AgentDocFilePart[]): string {
  return JSON.stringify(
    files.map((f) => ({
      filename: f.filename,
      content: f.content,
    }))
  );
}

/**
 * 파일 목록에서 primary(표시용) 파일을 고른다.
 * skill.md 우선, 없으면 첫 .md, 없으면 첫 파일.
 */
export function pickPrimaryFile(
  files: AgentDocFilePart[]
): AgentDocFilePart | null {
  if (files.length === 0) return null;
  const skillMd = files.find((f) => isSkillMdName(f.filename));
  if (skillMd) return skillMd;
  const md = files.find((f) => /\.md$/i.test(f.filename));
  if (md) return md;
  return files[0] ?? null;
}

/**
 * 검색용으로 번들 전체 텍스트를 합친다.
 */
export function bundleSearchText(
  content: string,
  files: AgentDocFilePart[]
): string {
  const parts = [content];
  for (const f of files) {
    parts.push(f.filename, f.content);
  }
  return parts.join("\n");
}

/**
 * 업로드 파일 묶음을 문서 단위로 그룹화한다.
 * - skill.md + *.skill 이 함께 있으면 하나의 skill 번들
 * - 그 외 파일은 각각 단독 문서
 */
export function groupUploadParts(
  parts: AgentDocFilePart[]
): AgentDocFilePart[][] {
  const skillMds = parts.filter((p) => isSkillMdName(p.filename));
  const skillExts = parts.filter((p) => isSkillExtName(p.filename));
  const others = parts.filter(
    (p) => !isSkillMdName(p.filename) && !isSkillExtName(p.filename)
  );

  const groups: AgentDocFilePart[][] = [];

  if (skillMds.length > 0 && skillExts.length > 0) {
    // skill.md 여러 개면 첫 번째를 번들 코어로, 나머지 skill.md는 단독
    const [primaryMd, ...restMd] = skillMds;
    groups.push([primaryMd!, ...skillExts]);
    for (const m of restMd) groups.push([m]);
  } else {
    for (const m of skillMds) groups.push([m]);
    for (const s of skillExts) groups.push([s]);
  }

  for (const o of others) groups.push([o]);
  return groups;
}
