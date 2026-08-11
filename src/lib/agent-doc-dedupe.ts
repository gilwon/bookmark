// 에이전트 문서 중복 판정 — 파일명+본문 완전 일치 지문 생성
import { v5 as uuidv5 } from "uuid";
import type { AgentDocFilePart } from "@/lib/agent-doc-bundle";

export function docFingerprint(
  files: AgentDocFilePart[]
): string {
  if (files.length === 0) return "";
  const items = files.map((f) => {
    const filename = f.filename.trim().toLowerCase();
    const content = f.content
      .replace(/^\uFEFF/, "") // 선행 BOM 제거 — BOM 유무만 다른 파일도 같은 지문
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .trimEnd();
    // 본문에 개행이 있어도 항목 경계가 섞이지 않도록 NUL 로 구분
    return `${filename}\u0000${content}`;
  });
  // 파일 순서 무관 — 정렬 후 join
  return items.sort().join("\u0000");
}

/** 사용자별 파일 지문과 슬롯으로 동시 저장을 막는 결정적 ID를 만든다. */
export function agentDocId(
  userId: string,
  files: AgentDocFilePart[],
  slot = 0
): string {
  return uuidv5(
    JSON.stringify([userId, docFingerprint(files), slot]),
    uuidv5.DNS
  );
}

// 새 문서 파일 묶음이 기존 문서 파일 묶음과 같은지 확인한다.
export function isDuplicateAgentDoc(
  files: AgentDocFilePart[],
  existing: Iterable<AgentDocFilePart[]>
): boolean {
  const fingerprint = docFingerprint(files);
  for (const other of existing) {
    if (docFingerprint(other) === fingerprint) return true;
  }
  return false;
}

// 초안 배치를 기존 등록 문서 지문(existing)과 대조해, 중복이 아닌 초안(fresh)과
// 중복으로 제외된 초안의 제목(duplicateTitles)으로 나눈다.
// 기존 지문 집합에 있거나 같은 배치 안에서 먼저 나온 지문과 같으면 중복으로 본다.
export function splitDuplicateDrafts<
  T extends { title: string; files: AgentDocFilePart[] },
>(drafts: T[], existing: Set<string>): { fresh: T[]; duplicateTitles: string[] } {
  const seenBatch = new Set<string>();
  const fresh: T[] = [];
  const duplicateTitles: string[] = [];
  for (const d of drafts) {
    const fp = docFingerprint(d.files);
    if (existing.has(fp) || seenBatch.has(fp)) {
      duplicateTitles.push(d.title || d.files[0]?.filename || "문서");
      continue;
    }
    seenBatch.add(fp);
    fresh.push(d);
  }
  return { fresh, duplicateTitles };
}
