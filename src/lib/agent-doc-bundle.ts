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
 * 한 번에 올린 파일 묶음을 문서 단위로 그룹화한다.
 * - 여러 파일이면 전부 한 문서(탭)로 묶음 (skill + md 패키지)
 * - 파일 1개면 단독 문서
 */
export function groupUploadParts(
  parts: AgentDocFilePart[]
): AgentDocFilePart[][] {
  if (parts.length === 0) return [];
  // 동일 파일명 병합(마지막 우선)
  const map = new Map<string, AgentDocFilePart>();
  for (const p of parts) {
    map.set(p.filename.toLowerCase(), p);
  }
  return [Array.from(map.values())];
}
