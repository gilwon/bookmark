// X API에서 로그인 사용자와 북마크 페이지를 읽는다
import { XApiError } from "@/lib/x-oauth";
import {
  X_BOOKMARKS_MAX_RESULTS,
  X_BOOKMARKS_PAGE_CAP,
  mapBookmarkPage,
  nextBookmarkToken,
  type MappedXBookmark,
} from "@/lib/x-bookmarks";

const API = "https://api.x.com/2";

async function xGet(url: string, accessToken: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    let message = `X 요청이 실패했습니다. (${res.status})`;
    try {
      const json = (await res.json()) as {
        detail?: unknown;
        title?: unknown;
        errors?: { message?: string }[];
      };
      const detail =
        (typeof json.detail === "string" && json.detail) ||
        (typeof json.title === "string" && json.title) ||
        json.errors?.find((e) => e.message)?.message;
      if (detail) message = detail.slice(0, 180);
    } catch {
      // 본문 파싱 실패는 상태 코드 메시지로 충분하다.
    }
    throw new XApiError(res.status, message);
  }
  return res.json();
}

/** 토큰 주인의 X 사용자 ID. */
export async function getXUserId(accessToken: string): Promise<string> {
  const json = (await xGet(`${API}/users/me`, accessToken)) as {
    data?: { id?: string };
  };
  const id = json.data?.id?.trim() ?? "";
  if (!id) throw new XApiError(502, "X 사용자 ID가 응답에 없습니다.");
  return id;
}

/** 북마크 한 페이지. paginationToken이 있으면 이어서 읽는다. */
export async function fetchBookmarkPage(
  accessToken: string,
  xUserId: string,
  paginationToken?: string | null
): Promise<unknown> {
  const url = new URL(`${API}/users/${xUserId}/bookmarks`);
  url.searchParams.set("max_results", String(X_BOOKMARKS_MAX_RESULTS));
  url.searchParams.set("tweet.fields", "created_at,author_id");
  url.searchParams.set("expansions", "author_id");
  url.searchParams.set("user.fields", "name,username");
  if (paginationToken) url.searchParams.set("pagination_token", paginationToken);
  return xGet(url.toString(), accessToken);
}

/** next_token이 끝나거나 상한 페이지까지 북마크를 모은다. */
export async function fetchAllBookmarks(
  accessToken: string,
  xUserId: string
): Promise<MappedXBookmark[]> {
  const all: MappedXBookmark[] = [];
  let paginationToken: string | null = null;
  for (let page = 0; page < X_BOOKMARKS_PAGE_CAP; page += 1) {
    const json = await fetchBookmarkPage(accessToken, xUserId, paginationToken);
    all.push(...mapBookmarkPage(json));
    paginationToken = nextBookmarkToken(json);
    if (!paginationToken) break;
  }
  const byId = new Map<string, MappedXBookmark>();
  for (const item of all) byId.set(item.tweetId, item);
  return [...byId.values()];
}
