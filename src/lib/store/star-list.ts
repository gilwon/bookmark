// Star 목록·동기화 인덱스용 컬럼. README·detail 본문은 제외한다.

export const STAR_LIST_SELECT =
  "id, user_id, repo_full_name, description, language, stars, topics, url, last_synced, created_at, change_kind, stars_delta, changed_at, source, is_favorite";

export function emptyStarBlobs<T extends Record<string, unknown>>(
  row: T
): T & {
  detailJson: null;
  readmeMd: null;
  readmeMdKo: null;
  detailFetchedAt: null;
} {
  return {
    ...row,
    detailJson: null,
    readmeMd: null,
    readmeMdKo: null,
    detailFetchedAt: null,
  };
}
