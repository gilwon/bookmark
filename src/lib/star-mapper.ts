// GithubStarRow → UI GithubStar 변환
import type { GithubStar } from "@/lib/types";
import type { GithubStarRow } from "@/lib/store/types";
import { getClaudeStarGuide } from "@/lib/star-claude-eli5";

/** DB 행을 UI Star 모델로 변환한다. */
export function rowToGithubStar(row: GithubStarRow): GithubStar {
  let topics: string[] = [];
  try {
    topics = JSON.parse(row.topics || "[]");
  } catch {
    topics = [];
  }
  return {
    id: row.id,
    userId: row.userId,
    repoFullName: row.repoFullName,
    description: getClaudeStarGuide(row.repoFullName)?.summary || row.description,
    language: row.language,
    stars: row.stars,
    topics,
    url: row.url,
    lastSynced: row.lastSynced,
    createdAt: row.createdAt,
    changeKind: row.changeKind ?? null,
    starsDelta: row.starsDelta ?? 0,
    changedAt: row.changedAt ?? null,
    source: row.source === "manual" ? "manual" : "sync",
    isFavorite: Boolean(row.isFavorite),
    detailJson: row.detailJson ?? null,
    readmeMd: row.readmeMd ?? null,
    readmeMdKo: row.readmeMdKo ?? null,
    detailFetchedAt: row.detailFetchedAt ?? null,
  };
}
