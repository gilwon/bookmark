// 최근 본 페이지 id를 localStorage에 쌓는다

export const RECENT_PAGES_KEY = "mymark:recent-pages";
export const RECENT_PAGES_MAX = 20;
const RECENT_EVENT = "mymark:recent-pages";

/** 중복을 맨 앞으로 옮기고 max개만 남긴다. */
export function mergeRecentIds(
  prev: string[],
  id: string,
  max = RECENT_PAGES_MAX
): string[] {
  const nextId = id.trim();
  if (!nextId) return prev.slice(0, max);
  return [nextId, ...prev.filter((x) => x !== nextId)].slice(0, max);
}

/** localStorage JSON 문자열을 id 배열로 바꾼다. */
export function parseRecentPageIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
  } catch {
    return [];
  }
}

/** useSyncExternalStore용 스냅샷. 값이 같으면 같은 문자열. */
export function getRecentPagesSnapshot(): string {
  if (typeof window === "undefined") return "[]";
  try {
    return window.localStorage.getItem(RECENT_PAGES_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function getRecentPagesServerSnapshot(): string {
  return "[]";
}

/** storage + 같은 탭 갱신 이벤트를 구독한다. */
export function subscribeRecentPages(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(RECENT_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(RECENT_EVENT, onStoreChange);
  };
}

/** localStorage에서 최근 본 id를 읽는다. 앞이 최신. */
export function readRecentPageIds(): string[] {
  return parseRecentPageIds(getRecentPagesSnapshot());
}

/** 페이지를 최근 본 맨 앞에 넣는다. 최대 20개. */
export function pushRecentPageId(id: string): void {
  if (typeof window === "undefined") return;
  const next = mergeRecentIds(readRecentPageIds(), id);
  try {
    window.localStorage.setItem(RECENT_PAGES_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(RECENT_EVENT));
  } catch {
    // quota 등은 무시
  }
}
