// 사용자별 목록 조회 짧은 캐시. 쓰기가 있으면 태그로 깬다.
import { revalidateTag, unstable_cache } from "next/cache";

export type ListCacheKind = "bookmarks" | "prompts" | "copies" | "pages";

/** 사용자·종류별 캐시 태그. */
export function userListTag(userId: string, kind: ListCacheKind): string {
  return `ulist:${kind}:${userId}`;
}

/** 같은 사용자·종류·키면 30초 동안 DB를 다시 치지 않는다. */
export function cachedUserList<T>(
  userId: string,
  kind: ListCacheKind,
  extraKey: string,
  fn: () => Promise<T>,
  revalidateSec = 30
): Promise<T> {
  return unstable_cache(fn, ["ulist", userId, kind, extraKey], {
    tags: [userListTag(userId, kind)],
    revalidate: revalidateSec,
  })();
}

/** 해당 사용자 목록 캐시를 태그로 깬다. */
export function revalidateUserList(userId: string, kind: ListCacheKind): void {
  revalidateTag(userListTag(userId, kind), "max");
}
