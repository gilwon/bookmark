// Octokit으로 GitHub Star 목록을 가져와 upsert / unstar 정리
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

/** 사용자 Star 목록 upsert + unstar 로컬 삭제 */
export async function upsertStars(
  userId: string,
  repos: StarRepo[]
): Promise<UpsertStarsResult> {
  const now = new Date().toISOString();
  const seen = new Set(repos.map((r) => r.repoFullName));

  for (const repo of repos) {
    const existing = await store.getStarByRepo(userId, repo.repoFullName);
    if (existing) {
      await store.updateStar(existing.id, userId, {
        description: repo.description,
        language: repo.language,
        stars: repo.stars,
        topics: JSON.stringify(repo.topics),
        url: repo.url,
        lastSynced: now,
      });
    } else {
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
      });
    }
  }

  const local = await store.listStars(userId);
  let removed = 0;
  for (const row of local) {
    if (!seen.has(row.repoFullName)) {
      await store.deleteStar(row.id, userId);
      removed += 1;
    }
  }

  return { count: repos.length, removed, lastSynced: now };
}
