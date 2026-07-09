// Octokit으로 GitHub Star 목록을 가져와 upsert한다
import { and, eq } from "drizzle-orm";
import { Octokit } from "octokit";
import { v4 as uuidv4 } from "uuid";
import { db } from "./db";
import { githubStars } from "./db/schema";

export type StarRepo = {
  repoFullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  topics: string[];
  url: string;
};

/** GitHub access_token으로 starred 레포를 페이지네이션해 가져온다. */
export async function fetchStarredRepos(
  accessToken: string
): Promise<StarRepo[]> {
  const octokit = new Octokit({ auth: accessToken });
  const repos: StarRepo[] = [];

  // GET /user/starred 페이지네이션
  for await (const response of octokit.paginate.iterator(
    octokit.rest.activity.listReposStarredByAuthenticatedUser,
    { per_page: 100 }
  )) {
    for (const item of response.data) {
      // starred 응답은 repo 래핑 또는 repo 자체일 수 있음
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

/** 사용자 기준으로 Star 목록을 upsert한다. */
export async function upsertStars(userId: string, repos: StarRepo[]) {
  const now = new Date().toISOString();

  for (const repo of repos) {
    const existing = db
      .select()
      .from(githubStars)
      .where(
        and(
          eq(githubStars.userId, userId),
          eq(githubStars.repoFullName, repo.repoFullName)
        )
      )
      .get();

    if (existing) {
      db.update(githubStars)
        .set({
          description: repo.description,
          language: repo.language,
          stars: repo.stars,
          topics: JSON.stringify(repo.topics),
          url: repo.url,
          lastSynced: now,
        })
        .where(eq(githubStars.id, existing.id))
        .run();
    } else {
      db.insert(githubStars)
        .values({
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
        })
        .run();
    }
  }

  return repos.length;
}
