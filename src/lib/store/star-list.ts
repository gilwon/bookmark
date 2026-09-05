// Star 목록·동기화 인덱스용 컬럼. README·detail 본문은 제외한다.

export const STAR_LIST_SELECT =
  "id, user_id, repo_full_name, description, language, stars, topics, url, last_synced, created_at, change_kind, stars_delta, changed_at, source, is_favorite";

export const PROMPT_LIST_SELECT =
  "id, user_id, title, category, summary, when_to_use, is_favorite, created_at, updated_at";

export const COPY_LIST_SELECT =
  "id, user_id, title, source_url, tags, is_favorite, created_at, updated_at";

export const BOOKMARK_IMPORT_SELECT =
  "id, url, title, image, description, favicon, category, created_at";

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
