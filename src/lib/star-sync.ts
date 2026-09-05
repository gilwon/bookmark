// GitHub Star 동기화 계획. DB 쓰기는 applyStarSync가 맡는다.
import type { GithubStarRow } from "@/lib/store/types";

export type StarSyncRepo = {
  repoFullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  topics: string[];
  url: string;
};

export type StarSyncUpdate = {
  id: string;
  patch: Partial<GithubStarRow>;
};

export type StarSyncBatch = {
  inserts: GithubStarRow[];
  updates: StarSyncUpdate[];
  deleteIds: string[];
};

export type StarSyncPlan = {
  batch: StarSyncBatch;
  added: number;
  updated: number;
  starsChanged: number;
  addedRepos: string[];
  updatedRepos: { name: string; starsDelta: number }[];
  removedRepos: string[];
};

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

export type TranslateStarDescription = (
  repoFullName: string,
  incoming: string | null,
  existing: string | null
) => string | null;

/** 로컬 행과 GitHub 목록을 한 번에 대조해 insert/update/delete를 만든다. */
export function planStarSync(args: {
  userId: string;
  repos: StarSyncRepo[];
  local: GithubStarRow[];
  now: string;
  newId: () => string;
  translate: TranslateStarDescription;
}): StarSyncPlan {
  const { userId, repos, local, now, newId, translate } = args;
  const seen = new Set(repos.map((r) => r.repoFullName));
  const isFirstSync = local.length === 0;

  const byRepo = new Map<string, GithubStarRow>();
  for (const row of local) {
    const key = row.repoFullName.trim().toLowerCase();
    if (!byRepo.has(key)) byRepo.set(key, row);
  }

  const inserts: GithubStarRow[] = [];
  const updates: StarSyncUpdate[] = [];
  const addedRepos: string[] = [];
  const updatedRepos: { name: string; starsDelta: number }[] = [];
  let starsChanged = 0;

  for (const repo of repos) {
    const existing = byRepo.get(repo.repoFullName.trim().toLowerCase());
    if (existing) {
      const description = translate(
        repo.repoFullName,
        repo.description,
        existing.description
      );
      const starsDelta = repo.stars - (existing.stars ?? 0);
      const metaChanged =
        (existing.description ?? null) !== description ||
        (existing.language ?? null) !== repo.language ||
        existing.url !== repo.url ||
        !topicsEqual(existing.topics, repo.topics);

      const hasChange = starsDelta !== 0 || metaChanged;
      if (starsDelta !== 0) starsChanged += 1;

      if (hasChange) {
        updatedRepos.push({ name: repo.repoFullName, starsDelta });
        updates.push({
          id: existing.id,
          patch: {
            description,
            language: repo.language,
            stars: repo.stars,
            topics: JSON.stringify(repo.topics),
            url: repo.url,
            lastSynced: now,
            changeKind: existing.changeKind === "new" ? "new" : "updated",
            starsDelta,
            changedAt: now,
          },
        });
      } else {
        updates.push({
          id: existing.id,
          patch: { lastSynced: now },
        });
      }
    } else {
      const kind = isFirstSync ? null : "new";
      if (kind === "new") addedRepos.push(repo.repoFullName);
      inserts.push({
        id: newId(),
        userId,
        repoFullName: repo.repoFullName,
        description: translate(repo.repoFullName, repo.description, null),
        language: repo.language,
        stars: repo.stars,
        topics: JSON.stringify(repo.topics),
        url: repo.url,
        lastSynced: now,
        createdAt: now,
        changeKind: kind,
        starsDelta: 0,
        changedAt: kind ? now : null,
        source: "sync",
        isFavorite: 0,
        detailJson: null,
        readmeMd: null,
        readmeMdKo: null,
        detailFetchedAt: null,
      });
    }
  }

  const deleteIds: string[] = [];
  const removedRepos: string[] = [];
  for (const row of local) {
    if (row.source === "manual") continue;
    if (!seen.has(row.repoFullName)) {
      removedRepos.push(row.repoFullName);
      deleteIds.push(row.id);
    }
  }

  return {
    batch: { inserts, updates, deleteIds },
    added: addedRepos.length,
    updated: updatedRepos.length,
    starsChanged,
    addedRepos,
    updatedRepos,
    removedRepos,
  };
}
