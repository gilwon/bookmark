// Octokit으로 GitHub Star 목록을 가져와 upsert / unstar 정리 + 변경 감지
import { v4 as uuidv4 } from "uuid";
import { store } from "@/lib/store";
import { Octokit } from "octokit";

export type StarRepo = {
  repoFullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  topics: string[];
  url: string;
};

export type UpsertStarsResult = {
  count: number;
  removed: number;
  lastSynced: string;
  /** A: 동기화 요약 */
  added: number;
  updated: number;
  starsChanged: number;
  addedRepos: string[];
  updatedRepos: { name: string; starsDelta: number }[];
  removedRepos: string[];
};

/** GitHub access_token으로 starred 레포를 페이지네이션해 가져온다. */
export async function fetchStarredRepos(
  accessToken: string
): Promise<StarRepo[]> {
  const octokit = new Octokit({ auth: accessToken });
  const repos: StarRepo[] = [];

  for await (const response of octokit.paginate.iterator(
    octokit.rest.activity.listReposStarredByAuthenticatedUser,
    { per_page: 100 }
  )) {
    for (const item of response.data) {
      const repo =
        "repo" in item && item.repo
          ? (item.repo as {
              full_name: string;
              description: string | null;
              language: string | null;
              stargazers_count: number;
              topics?: string[];
              html_url: string;
            })
          : (item as {
              full_name: string;
              description: string | null;
              language: string | null;
              stargazers_count: number;
              topics?: string[];
              html_url: string;
            });

      repos.push({
        repoFullName: repo.full_name,
        description: repo.description ?? null,
        language: repo.language ?? null,
        stars: repo.stargazers_count ?? 0,
        topics: repo.topics ?? [],
        url: repo.html_url,
      });
    }
  }

  return repos;
}

function topicsEqual(a: string, bTopics: string[]): boolean {
  try {
    const parsed = JSON.parse(a || "[]") as string[];
    if (parsed.length !== bTopics.length) return false;
    const sa = [...parsed].sort().join("\0");
    const sb = [...bTopics].sort().join("\0");
    return sa === sb;
  } catch {
    return false;
  }
}

/** 사용자 Star 목록 upsert + unstar 로컬 삭제 + 변경 뱃지 */
export async function upsertStars(
  userId: string,
  repos: StarRepo[]
): Promise<UpsertStarsResult> {
  const now = new Date().toISOString();
  const seen = new Set(repos.map((r) => r.repoFullName));
  const localBefore = await store.listStars(userId);
  const isFirstSync = localBefore.length === 0;

  const addedRepos: string[] = [];
  const updatedRepos: { name: string; starsDelta: number }[] = [];
  let starsChanged = 0;

  for (const repo of repos) {
    const existing = await store.getStarByRepo(userId, repo.repoFullName);
    if (existing) {
      const starsDelta = repo.stars - (existing.stars ?? 0);
      const metaChanged =
        (existing.description ?? null) !== repo.description ||
        (existing.language ?? null) !== repo.language ||
        existing.url !== repo.url ||
        !topicsEqual(existing.topics, repo.topics);

      const hasChange = starsDelta !== 0 || metaChanged;
      if (starsDelta !== 0) starsChanged += 1;

      if (hasChange) {
        updatedRepos.push({ name: repo.repoFullName, starsDelta });
        await store.updateStar(existing.id, userId, {
          description: repo.description,
          language: repo.language,
          stars: repo.stars,
          topics: JSON.stringify(repo.topics),
          url: repo.url,
          lastSynced: now,
          // 이미 new 이면 유지, 아니면 updated
          changeKind: existing.changeKind === "new" ? "new" : "updated",
          starsDelta,
          changedAt: now,
        });
      } else {
        await store.updateStar(existing.id, userId, {
          lastSynced: now,
        });
      }
    } else {
      // 첫 전체 동기화는 전부 new 로 표시하면 과다 → 뱃지 없음
      const kind = isFirstSync ? null : "new";
      if (kind === "new") addedRepos.push(repo.repoFullName);
      await store.insertStar({
        id: uuidv4(),
        userId,
        repoFullName: repo.repoFullName,
        description: repo.description,
        language: repo.language,
        stars: repo.stars,
        topics: JSON.stringify(repo.topics),
        url: repo.url,
        lastSynced: now,
        createdAt: now,
        changeKind: kind,
        starsDelta: 0,
        changedAt: kind ? now : null,
      });
    }
  }

  const local = await store.listStars(userId);
  let removed = 0;
  const removedRepos: string[] = [];
  for (const row of local) {
    if (!seen.has(row.repoFullName)) {
      removedRepos.push(row.repoFullName);
      await store.deleteStar(row.id, userId);
      removed += 1;
    }
  }

  return {
    count: repos.length,
    removed,
    lastSynced: now,
    added: addedRepos.length,
    updated: updatedRepos.length,
    starsChanged,
    addedRepos,
    updatedRepos,
    removedRepos,
  };
}
