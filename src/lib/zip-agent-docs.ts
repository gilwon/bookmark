// zip / .skill(ZIP 패키지) 해제 후 skill.md · 텍스트 추출 (브라우저·fflate)
import { unzipSync, strFromU8 } from "fflate";
import {
  isAllowedAgentDocName,
  isSkillExtName,
  type AgentDocFilePart,
} from "@/lib/agent-doc-bundle";
import { normalizeFilename } from "@/lib/agent-doc-templates";

export type ZipExtractPart = AgentDocFilePart & {
  /** zip 내부 상위 폴더 (루트면 "") */
  dir: string;
  /** zip 내부 원 경로 */
  path: string;
};

export type ZipExtractResult = {
  parts: ZipExtractPart[];
  warnings: string[];
  skipped: string[];
  /** 패키지 폴더명 추정 (예: blindspot-first) */
  packageName?: string;
};

const MAX_ENTRY_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_ENTRIES = 80;
const MAX_RECURSE = 2;

/**
 * ZIP 매직 바이트 판별.
 * PK\x03\x04 (local), PK\x05\x06 (empty), PK\x07\x08 등
 */
export function isZipBytes(data: Uint8Array): boolean {
  if (data.length < 4) return false;
  return (
    data[0] === 0x50 &&
    data[1] === 0x4b &&
    (data[2] === 0x03 ||
      data[2] === 0x05 ||
      data[2] === 0x07 ||
      data[2] === 0x08)
  );
}

/** File 이 zip 확장자/MIME 인지 */
export function isZipFile(file: File): boolean {
  const n = file.name.toLowerCase();
  if (n.endsWith(".zip")) return true;
  return (
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed" ||
    file.type === "multipart/x-zip"
  );
}

/**
 * .skill 또는 바이트가 ZIP 인 경우 true.
 * Claude 스킬 패키지는 종종 확장자만 .skill 인 zip 이다.
 */
export function isZipLikeFile(file: File, data?: Uint8Array): boolean {
  if (isZipFile(file)) return true;
  if (data && isZipBytes(data)) return true;
  return false;
}

/** macOS / 숨김 / 디렉터리 엔트리 스킵 */
function shouldSkipZipPath(path: string): boolean {
  const norm = path.replace(/\\/g, "/");
  if (norm.endsWith("/")) return true;
  const segs = norm.split("/").filter(Boolean);
  if (segs.some((s) => s === "__MACOSX" || s.startsWith("."))) return true;
  return false;
}

/** 공통 상위 폴더명 추정 (단일 루트 폴더 패키지) */
function inferPackageName(paths: string[]): string | undefined {
  const tops = new Set<string>();
  for (const p of paths) {
    const segs = p.replace(/\\/g, "/").split("/").filter(Boolean);
    if (segs.length >= 2) tops.add(segs[0]!);
  }
  if (tops.size === 1) return [...tops][0];
  return undefined;
}

/**
 * zip 바이트에서 허용 텍스트 파일을 추출한다.
 * 엔트리가 다시 ZIP(.skill 패키지)이면 1~2단계 재귀 해제한다.
 */
export function extractAgentDocsFromZip(
  data: Uint8Array,
  zipName = "archive.zip",
  depth = 0
): ZipExtractResult {
  const warnings: string[] = [];
  const skipped: string[] = [];
  const parts: ZipExtractPart[] = [];

  if (!isZipBytes(data)) {
    return {
      parts: [],
      warnings: [`${zipName}: ZIP 형식이 아닙니다.`],
      skipped: [],
    };
  }

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data, {
      filter: (file) => {
        if (file.originalSize > MAX_ENTRY_BYTES) return false;
        return true;
      },
    });
  } catch (err) {
    return {
      parts: [],
      warnings: [
        `${zipName}: 압축 해제 실패 (${err instanceof Error ? err.message : "형식 오류"})`,
      ],
      skipped: [],
    };
  }

  const entries = Object.entries(files);
  if (entries.length > MAX_TOTAL_ENTRIES) {
    warnings.push(
      `${zipName}: 항목이 ${entries.length}개라 상위 ${MAX_TOTAL_ENTRIES}개만 처리`
    );
  }

  const keptPaths: string[] = [];
  let count = 0;

  for (const [path, bytes] of entries) {
    if (count >= MAX_TOTAL_ENTRIES) break;
    if (shouldSkipZipPath(path)) {
      skipped.push(path);
      continue;
    }
    if (bytes.byteLength > MAX_ENTRY_BYTES) {
      warnings.push(`${path}: 2MB 초과 스킵`);
      continue;
    }

    const segs = path.replace(/\\/g, "/").split("/").filter(Boolean);
    const base = segs[segs.length - 1] || "";
    const dir = segs.slice(0, -1).join("/");

    // 중첩 .skill / zip 엔트리 → 재귀 해제 (텍스트로 읽지 않음)
    if (
      depth < MAX_RECURSE &&
      isZipBytes(bytes) &&
      (isSkillExtName(base) || /\.zip$/i.test(base))
    ) {
      const nested = extractAgentDocsFromZip(bytes, base, depth + 1);
      warnings.push(...nested.warnings);
      for (const np of nested.parts) {
        parts.push({
          ...np,
          // 중첩 경로는 바깥 폴더 아래에 붙임
          dir: [dir, nested.packageName || np.dir].filter(Boolean).join("/"),
          path: `${path}!${np.path}`,
        });
        count += 1;
      }
      continue;
    }

    // 바이너리 .skill(zip)인데 재귀 한도 초과
    if (isZipBytes(bytes) && isSkillExtName(base)) {
      warnings.push(`${path}: 중첩 ZIP 깊이 초과로 스킵`);
      skipped.push(path);
      continue;
    }

    if (!isAllowedAgentDocName(base) && !isSkillExtName(base)) {
      skipped.push(path);
      continue;
    }

    // 텍스트가 아닌 바이너리(PK로 시작)는 스킵
    if (isZipBytes(bytes)) {
      warnings.push(`${path}: 바이너리 ZIP 엔트리 스킵`);
      skipped.push(path);
      continue;
    }

    let text: string;
    try {
      text = strFromU8(bytes);
    } catch {
      warnings.push(`${path}: UTF-8 디코드 실패`);
      continue;
    }

    // 깨진 바이너리 휴리스틱: 널 바이트 다수
    if (text.includes("\u0000") || /[\x00-\x08\x0e-\x1f]/.test(text.slice(0, 200))) {
      warnings.push(`${path}: 바이너리로 보여 스킵`);
      skipped.push(path);
      continue;
    }

    parts.push({
      filename: normalizeFilename(base),
      content: text,
      dir,
      path,
    });
    keptPaths.push(path);
    count += 1;
  }

  if (parts.length === 0 && warnings.length === 0) {
    warnings.push(
      `${zipName}: 추출 가능한 .md / 텍스트 파일이 없습니다. (ZIP 패키지 내부 SKILL.md 확인)`
    );
  }

  const packageName =
    inferPackageName(keptPaths) ||
    zipName.replace(/\.skill$/i, "").replace(/\.zip$/i, "") ||
    undefined;

  return { parts, warnings, skipped, packageName };
}

/**
 * zip 추출 결과를 문서 그룹으로 나눈다.
 * - 같은 폴더 안의 skill.md + 기타 → 한 번들
 * - 폴더가 다르면 폴더별 독립 그룹
 */
export function groupZipExtractParts(
  parts: ZipExtractPart[],
  groupUploadParts: (files: AgentDocFilePart[]) => AgentDocFilePart[][]
): AgentDocFilePart[][] {
  const byDir = new Map<string, AgentDocFilePart[]>();

  for (const p of parts) {
    const key = p.dir || "__root__";
    const list = byDir.get(key) ?? [];
    const nameTaken = list.some(
      (x) => x.filename.toLowerCase() === p.filename.toLowerCase()
    );
    const filename = nameTaken
      ? normalizeFilename(
          `${p.dir.replace(/\//g, "-") || "item"}-${p.filename}`
        )
      : p.filename;
    list.push({ filename, content: p.content });
    byDir.set(key, list);
  }

  const groups: AgentDocFilePart[][] = [];
  for (const files of byDir.values()) {
    // 폴더 안 파일은 전부 한 문서로 묶는 편이 스킬 패키지에 맞음
    // (skill.md + 부가 md 등)
    if (files.some((f) => /^skill\.md$/i.test(f.filename))) {
      groups.push(files);
    } else {
      groups.push(...groupUploadParts(files));
    }
  }
  return groups;
}

/**
 * File → ZIP 해제 또는 null(일반 텍스트 처리).
 */
export async function tryExtractZipFile(
  file: File
): Promise<ZipExtractResult | null> {
  const buf = new Uint8Array(await file.arrayBuffer());
  // .skill 은 이름과 무관하게 ZIP 시그니처 우선
  if (!isZipLikeFile(file, buf) && !isSkillExtName(file.name)) {
    return null;
  }
  // .skill 인데 ZIP 아니면 텍스트로 취급 위해 null
  if (isSkillExtName(file.name) && !isZipBytes(buf) && !isZipFile(file)) {
    return null;
  }
  if (!isZipBytes(buf) && !isZipFile(file)) {
    return null;
  }
  if (!isZipBytes(buf)) {
    return {
      parts: [],
      warnings: [`${file.name}: ZIP 시그니처 없음`],
      skipped: [],
    };
  }
  return extractAgentDocsFromZip(buf, file.name);
}
