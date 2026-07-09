// 에이전트 문서 작성 초안 (sessionStorage, 저장 버튼 전까지 DB 미반영)
import type { AgentDocFilePart } from "@/lib/agent-doc-bundle";
import type { AgentDocKind } from "@/lib/types";

export type AgentDocDraft = {
  kind: AgentDocKind;
  title: string;
  description: string;
  files: AgentDocFilePart[];
};

const QUEUE_KEY = "mymark-agent-doc-drafts";

/** 초안 큐 전체를 덮어쓴다. */
export function setDraftQueue(drafts: AgentDocDraft[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify(drafts));
  } catch {
    // quota 등 무시
  }
}

/** 큐 앞의 초안을 꺼내지 않고 본다. */
export function peekDraft(): AgentDocDraft | null {
  const q = readQueue();
  return q[0] ?? null;
}

/** 큐 길이 */
export function draftQueueLength(): number {
  return readQueue().length;
}

/**
 * 현재 초안을 큐에서 제거하고 다음을 남긴다.
 * (저장 성공 후 호출)
 */
export function shiftDraft(): AgentDocDraft | null {
  const q = readQueue();
  if (q.length === 0) return null;
  const [first, ...rest] = q;
  setDraftQueue(rest);
  return first ?? null;
}

/** 현재 초안 내용을 갱신 (편집 중 유지용) */
export function updateCurrentDraft(draft: AgentDocDraft): void {
  const q = readQueue();
  if (q.length === 0) {
    setDraftQueue([draft]);
    return;
  }
  q[0] = draft;
  setDraftQueue(q);
}

/** 큐 비우기 */
export function clearDraftQueue(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(QUEUE_KEY);
  } catch {
    // ignore
  }
}

function readQueue(): AgentDocDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(isDraft);
  } catch {
    return [];
  }
}

function isDraft(x: unknown): x is AgentDocDraft {
  if (!x || typeof x !== "object") return false;
  const d = x as AgentDocDraft;
  return (
    typeof d.title === "string" &&
    typeof d.description === "string" &&
    typeof d.kind === "string" &&
    Array.isArray(d.files)
  );
}
