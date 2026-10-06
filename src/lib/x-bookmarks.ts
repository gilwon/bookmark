// X 북마크 응답을 앱 행으로 바꾸는 순수 함수
export const X_SCOPES = [
  "bookmark.read",
  "tweet.read",
  "users.read",
  "offline.access",
] as const;

export const X_BOOKMARKS_PAGE_CAP = 10;
export const X_BOOKMARKS_MAX_RESULTS = 100;

export const X_BOOKMARKS_TABLE_USER_MESSAGE =
  "X 북마크 테이블이 없습니다. supabase/add_x_bookmarks.sql 을 SQL Editor에서 실행하세요.";

export type XTokenPayload = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  xUserId: string;
};

export type MappedXBookmark = {
  tweetId: string;
  text: string;
  authorName: string;
  authorUsername: string;
  postedAt: string;
  url: string;
};

type ApiUser = { id?: string; name?: string; username?: string };
type ApiTweet = {
  id?: string;
  text?: string;
  author_id?: string;
  created_at?: string;
};

/** 게시 주소를 만든다. 사용자 이름이 없으면 i/status를 쓴다. */
export function buildStatusUrl(username: string, tweetId: string): string {
  const id = tweetId.trim();
  const name = username.trim().replace(/^@/, "");
  if (name) return `https://x.com/${encodeURIComponent(name)}/status/${id}`;
  return `https://x.com/i/status/${id}`;
}

/** 만료 시각이 skew 안에 들어오면 갱신한다. */
export function shouldRefreshAccessToken(
  expiresAtIso: string,
  nowMs: number,
  skewMs = 60_000
): boolean {
  const expires = Date.parse(expiresAtIso);
  if (Number.isNaN(expires)) return true;
  return expires - nowMs <= skewMs;
}

/** 저장된 JSON 토큰을 읽는다. 필드가 빠지면 null. */
export function parseXTokenPayload(json: string): XTokenPayload | null {
  try {
    const raw = JSON.parse(json) as Partial<XTokenPayload>;
    if (!raw || typeof raw !== "object") return null;
    if (typeof raw.accessToken !== "string" || !raw.accessToken) return null;
    if (typeof raw.refreshToken !== "string") return null;
    if (typeof raw.expiresAt !== "string" || !raw.expiresAt) return null;
    if (typeof raw.xUserId !== "string") return null;
    return {
      accessToken: raw.accessToken,
      refreshToken: raw.refreshToken,
      expiresAt: raw.expiresAt,
      xUserId: raw.xUserId,
    };
  } catch {
    return null;
  }
}

/** 토큰 페이로드를 저장용 문자열로 만든다. */
export function serializeXTokenPayload(payload: XTokenPayload): string {
  return JSON.stringify(payload);
}

/** PostgREST가 x_bookmarks 부재를 말할 때 true다. */
export function isMissingXBookmarksTable(message: unknown): boolean {
  const text = String(message ?? "");
  if (!/x_bookmarks/i.test(text)) return false;
  return /schema cache|does not exist|PGRST205|Could not find the table|42P01/i.test(
    text
  );
}

/** 북마크 한 페이지를 행으로 바꾼다. id가 없으면 버린다. */
export function mapBookmarkPage(apiJson: unknown): MappedXBookmark[] {
  const body = (apiJson ?? {}) as {
    data?: ApiTweet[];
    includes?: { users?: ApiUser[] };
  };
  const users = new Map<string, ApiUser>();
  for (const user of body.includes?.users ?? []) {
    if (user?.id) users.set(user.id, user);
  }
  const byId = new Map<string, MappedXBookmark>();
  for (const tweet of body.data ?? []) {
    const tweetId = typeof tweet?.id === "string" ? tweet.id.trim() : "";
    if (!tweetId) continue;
    const user = tweet.author_id ? users.get(tweet.author_id) : undefined;
    const authorUsername = (user?.username ?? "").trim();
    const authorName = (user?.name ?? "").trim();
    byId.set(tweetId, {
      tweetId,
      text: typeof tweet.text === "string" ? tweet.text : "",
      authorName,
      authorUsername,
      postedAt: typeof tweet.created_at === "string" ? tweet.created_at : "",
      url: buildStatusUrl(authorUsername, tweetId),
    });
  }
  return [...byId.values()];
}

/** 다음 페이지 토큰. 없으면 null. */
export function nextBookmarkToken(apiJson: unknown): string | null {
  const token = (apiJson as { meta?: { next_token?: unknown } } | null)?.meta
    ?.next_token;
  if (typeof token !== "string") return null;
  const trimmed = token.trim();
  return trimmed ? trimmed : null;
}
