// Octokit으로 GitHub Star 목록을 가져와 upsert / unstar 정리한다
import { and, eq } from "drizzle-orm";
import { Octokit } from "octokit";
import { v4 as uuidv4 } from "uuid";
import { db } from "./db";
import { githubStars } from "./db/schema";
import { qall, qget, qrun } from "@/lib/db/query";

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

/**
 * 사용자 Star 목록을 upsert하고,
 * 이번 동기화에 없는 레포(unstar)는 삭제한다.
 */
export async function upsertStars(
  userId: string,
  repos: StarRepo[]
): Promise<UpsertStarsResult> {
  const now = new Date().toISOString();
  const seen = new Set(repos.map((r) => r.repoFullName));

  for (const repo of repos) {
    const existing = await qget(db.select().from(githubStars)      .where(and(eq(githubStars.userId, userId),eq(githubStars.repoFullName, repo.repoFullName))));

    if (existing) {
      await qrun(db.update(githubStars)
        .set({
          description: repo.description,
          language: repo.language,
          stars: repo.stars,
          topics: JSON.stringify(repo.topics),
          url: repo.url,
          lastSynced: now,
        })
        .where(
          and(eq(githubStars.id, existing.id), eq(githubStars.userId, userId))
        ));
    } else {
      await qrun(db.insert(githubStars)
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
        }));
    }
  }

  // unstar된 로컬 행 정리 (본인 데이터만)
  const local = await qall(db.select().from(githubStars)    .where(eq(githubStars.userId, userId)));

  let removed = 0;
  for (const row of local) {
    if (!seen.has(row.repoFullName)) {
      await qrun(db.delete(githubStars)
        .where(
          and(eq(githubStars.id, row.id), eq(githubStars.userId, userId))
        ));
      removed += 1;
    }
  }

  return { count: repos.length, removed, lastSynced: now };
}
