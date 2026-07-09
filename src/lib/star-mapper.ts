// GithubStarRow → UI GithubStar 변환
import type { GithubStar } from "@/lib/types";
import type { GithubStarRow } from "@/lib/store/types";

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
    description: row.description,
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
  };
}
