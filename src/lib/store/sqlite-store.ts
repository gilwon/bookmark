// SQLite(Drizzle) 스토어 구현
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/sqlite";
import {
  agentDocs,
  bookmarks,
  customPages,
  githubStars,
  oauthTokens,
} from "@/lib/db/schema.sqlite";
import { qall, qget, qrun } from "@/lib/db/query";
import type {
  AgentDocRow,
  BookmarkRow,
  CustomPageRow,
  GithubStarRow,
  OauthTokenRow,
} from "./types";

// --- bookmarks ---
export async function listBookmarks(userId: string): Promise<BookmarkRow[]> {
  return qall(
    db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.createdAt))
  );
}

export async function getBookmark(
  id: string,
  userId: string
): Promise<BookmarkRow | undefined> {
  return qget(
    db
      .select()
      .from(bookmarks)
      .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
  );
}

export async function insertBookmark(row: BookmarkRow): Promise<BookmarkRow> {
  await qrun(db.insert(bookmarks).values(row));
  return (await getBookmark(row.id, row.userId))!;
}

export async function updateBookmark(
  id: string,
  userId: string,
  patch: Partial<BookmarkRow>
): Promise<BookmarkRow | undefined> {
  const { id: _i, userId: _u, ...rest } = patch as BookmarkRow;
  await qrun(
    db
      .update(bookmarks)
      .set(rest)
      .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
  );
  return getBookmark(id, userId);
}

export async function deleteBookmark(id: string, userId: string): Promise<void> {
  await qrun(
    db
      .delete(bookmarks)
      .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
  );
}

export async function listBookmarkUrls(userId: string): Promise<string[]> {
  const rows = await qall<{ url: string }>(
    db
      .select({ url: bookmarks.url })
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
  );
  return rows.map((r) => r.url);
}

// --- stars ---
export async function listStars(userId: string): Promise<GithubStarRow[]> {
  return qall(
    db
      .select()
      .from(githubStars)
      .where(eq(githubStars.userId, userId))
      .orderBy(desc(githubStars.stars))
  );
}

export async function listStarsBySynced(userId: string): Promise<GithubStarRow[]> {
  return qall(
    db
      .select()
      .from(githubStars)
      .where(eq(githubStars.userId, userId))
      .orderBy(desc(githubStars.lastSynced))
  );
}

export async function getStar(
  id: string,
  userId: string
): Promise<GithubStarRow | undefined> {
  return qget(
    db
      .select()
      .from(githubStars)
      .where(and(eq(githubStars.id, id), eq(githubStars.userId, userId)))
  );
}

export async function getStarByRepo(
  userId: string,
  repoFullName: string
): Promise<GithubStarRow | undefined> {
  return qget(
    db
      .select()
      .from(githubStars)
      .where(
        and(
          eq(githubStars.userId, userId),
          eq(githubStars.repoFullName, repoFullName)
        )
      )
  );
}

export async function insertStar(row: GithubStarRow): Promise<void> {
  await qrun(db.insert(githubStars).values(row));
}

export async function updateStar(
  id: string,
  userId: string,
  patch: Partial<GithubStarRow>
): Promise<void> {
  const { id: _i, userId: _u, ...rest } = patch as GithubStarRow;
  await qrun(
    db
      .update(githubStars)
      .set(rest)
      .where(and(eq(githubStars.id, id), eq(githubStars.userId, userId)))
  );
}

export async function deleteStar(id: string, userId: string): Promise<void> {
  await qrun(
    db
      .delete(githubStars)
      .where(and(eq(githubStars.id, id), eq(githubStars.userId, userId)))
  );
}

// --- pages ---
export async function listPages(userId: string): Promise<CustomPageRow[]> {
  return qall(
    db
      .select()
      .from(customPages)
      .where(eq(customPages.userId, userId))
      .orderBy(desc(customPages.updatedAt))
  );
}

export async function getPage(
  id: string,
  userId: string
): Promise<CustomPageRow | undefined> {
  return qget(
    db
      .select()
      .from(customPages)
      .where(and(eq(customPages.id, id), eq(customPages.userId, userId)))
  );
}

export async function insertPage(row: CustomPageRow): Promise<CustomPageRow> {
  await qrun(db.insert(customPages).values(row));
  return (await getPage(row.id, row.userId))!;
}

export async function updatePage(
  id: string,
  userId: string,
  patch: Partial<CustomPageRow>
): Promise<CustomPageRow | undefined> {
  const { id: _i, userId: _u, ...rest } = patch as CustomPageRow;
  await qrun(
    db
      .update(customPages)
      .set(rest)
      .where(and(eq(customPages.id, id), eq(customPages.userId, userId)))
  );
  return getPage(id, userId);
}

export async function deletePage(id: string, userId: string): Promise<void> {
  await qrun(
    db
      .delete(customPages)
      .where(and(eq(customPages.id, id), eq(customPages.userId, userId)))
  );
}

// --- oauth tokens ---
export async function getToken(
  userId: string,
  provider: string
): Promise<OauthTokenRow | undefined> {
  return qget(
    db
      .select()
      .from(oauthTokens)
      .where(
        and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, provider))
      )
  );
}

export async function upsertToken(row: OauthTokenRow): Promise<void> {
  const existing = await getToken(row.userId, row.provider);
  if (existing) {
    await qrun(
      db
        .update(oauthTokens)
        .set({
          accessTokenEnc: row.accessTokenEnc,
          updatedAt: row.updatedAt,
        })
        .where(eq(oauthTokens.id, existing.id))
    );
  } else {
    await qrun(db.insert(oauthTokens).values(row));
  }
}

export async function deleteToken(
  userId: string,
  provider: string
): Promise<void> {
  await qrun(
    db
      .delete(oauthTokens)
      .where(
        and(eq(oauthTokens.userId, userId), eq(oauthTokens.provider, provider))
      )
  );
}

// --- agent docs ---
export async function listAgentDocs(userId: string): Promise<AgentDocRow[]> {
  return qall(
    db
      .select()
      .from(agentDocs)
      .where(eq(agentDocs.userId, userId))
      .orderBy(desc(agentDocs.updatedAt))
  );
}

export async function getAgentDoc(
  id: string,
  userId: string
): Promise<AgentDocRow | undefined> {
  return qget(
    db
      .select()
      .from(agentDocs)
      .where(and(eq(agentDocs.id, id), eq(agentDocs.userId, userId)))
  );
}

export async function insertAgentDoc(row: AgentDocRow): Promise<AgentDocRow> {
  await qrun(db.insert(agentDocs).values(row));
  return (await getAgentDoc(row.id, row.userId))!;
}

export async function updateAgentDoc(
  id: string,
  userId: string,
  patch: Partial<AgentDocRow>
): Promise<AgentDocRow | undefined> {
  const { id: _i, userId: _u, ...rest } = patch as AgentDocRow;
  await qrun(
    db
      .update(agentDocs)
      .set(rest)
      .where(and(eq(agentDocs.id, id), eq(agentDocs.userId, userId)))
  );
  return getAgentDoc(id, userId);
}

export async function deleteAgentDoc(id: string, userId: string): Promise<void> {
  await qrun(
    db
      .delete(agentDocs)
      .where(and(eq(agentDocs.id, id), eq(agentDocs.userId, userId)))
  );
}
