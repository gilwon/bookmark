// zip 해제 후 skill.md / .skill / md 텍스트 추출 (브라우저·fflate)
import { unzipSync, strFromU8 } from "fflate";
import {
  isAllowedAgentDocName,
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
};

const MAX_ENTRY_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_ENTRIES = 80;

/** macOS / 숨김 / 디렉터리 엔트리 스킵 */
function shouldSkipZipPath(path: string): boolean {
  const norm = path.replace(/\\/g, "/");
  if (norm.endsWith("/")) return true;
  const segs = norm.split("/").filter(Boolean);
  if (segs.some((s) => s === "__MACOSX" || s.startsWith("."))) return true;
  return false;
}

/**
 * zip 바이트에서 허용 확장자 텍스트 파일을 추출한다.
 * 경로의 파일명만 쓰되, 같은 폴더끼리 묶을 수 있게 dir 을 남긴다.
 */
export function extractAgentDocsFromZip(
  data: Uint8Array,
  zipName = "archive.zip"
): ZipExtractResult {
  const warnings: string[] = [];
  const skipped: string[] = [];
  const parts: ZipExtractPart[] = [];

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
    if (!isAllowedAgentDocName(base) && !/\.skill$/i.test(base)) {
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

    // 폴더: a/b/SKILL.md → dir "a/b"
    const dir = segs.slice(0, -1).join("/");
    parts.push({
      filename: normalizeFilename(base),
      content: text,
      dir,
      path,
    });
    count += 1;
  }

  if (parts.length === 0 && warnings.length === 0) {
    warnings.push(
      `${zipName}: 추출 가능한 .md / .skill / .txt 파일이 없습니다.`
    );
  }

  return { parts, warnings, skipped };
}

/**
 * zip 추출 결과를 문서 그룹으로 나눈다.
 * - 같은 폴더 안의 skill.md + .skill → 한 번들
 * - 폴더가 다르면 폴더별 독립 그룹 후 기존 groupUploadParts 규칙
 */
export function groupZipExtractParts(
  parts: ZipExtractPart[],
  groupUploadParts: (files: AgentDocFilePart[]) => AgentDocFilePart[][]
): AgentDocFilePart[][] {
  const byDir = new Map<string, AgentDocFilePart[]>();

  for (const p of parts) {
    const key = p.dir || "__root__";
    const list = byDir.get(key) ?? [];
    // 같은 폴더 내 동일 파일명 충돌 시 뒤에 디렉터리 접두
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
    groups.push(...groupUploadParts(files));
  }
  return groups;
}

/** File 이 zip 인지 판별 */
export function isZipFile(file: File): boolean {
  const n = file.name.toLowerCase();
  if (n.endsWith(".zip")) return true;
  return (
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed" ||
    file.type === "multipart/x-zip"
  );
}
