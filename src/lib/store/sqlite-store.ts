// SQLite(Drizzle) 스토어 구현
import { and, count, desc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/lib/db/sqlite";
import {
  agentDocs,
  bookmarks,
  categories,
  customPages,
  githubStars,
  oauthTokens,
  prompts,
} from "@/lib/db/schema.sqlite";
import { qall, qget, qrun } from "@/lib/db/query";
import type {
  CategoryCount,
  DashboardCounts,
  SearchOpts,
} from "./query-types";
import type {
  AgentDocRow,
  BookmarkRow,
  CategoryRow,
  CustomPageRow,
  GithubStarRow,
  OauthTokenRow,
  PromptRow,
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

/** 북마크.category 문자열 일괄 변경 */
export async function renameBookmarkCategory(
  userId: string,
  fromName: string,
  toName: string | null
): Promise<number> {
  const rows = await listBookmarks(userId);
  let n = 0;
  for (const r of rows) {
    if ((r.category ?? "").trim() !== fromName.trim()) continue;
    await updateBookmark(r.id, userId, { category: toName });
    n += 1;
  }
  return n;
}

// --- categories ---
export async function listCategories(userId: string): Promise<CategoryRow[]> {
  return qall(
    db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(categories.name)
  );
}

export async function getCategory(
  id: string,
  userId: string
): Promise<CategoryRow | undefined> {
  return qget(
    db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
  );
}

export async function getCategoryByName(
  userId: string,
  name: string
): Promise<CategoryRow | undefined> {
  const rows = await listCategories(userId);
  const key = name.trim().toLowerCase();
  return rows.find((r) => r.name.trim().toLowerCase() === key);
}

export async function insertCategory(row: CategoryRow): Promise<CategoryRow> {
  await qrun(db.insert(categories).values(row));
  return (await getCategory(row.id, row.userId))!;
}

export async function updateCategory(
  id: string,
  userId: string,
  patch: Partial<CategoryRow>
): Promise<CategoryRow | undefined> {
  const { id: _i, userId: _u, ...rest } = patch as CategoryRow;
  await qrun(
    db
      .update(categories)
      .set(rest)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
  );
  return getCategory(id, userId);
}

export async function deleteCategory(
  id: string,
  userId: string
): Promise<void> {
  await qrun(
    db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
  );
}

/**
 * 북마크에 쓰인 카테고리 이름을 마스터에 동기화 (없을 때만 추가).
 */
export async function ensureCategoriesFromBookmarks(
  userId: string
): Promise<void> {
  const rows = await listBookmarks(userId);
  const existing = await listCategories(userId);
  const have = new Set(existing.map((c) => c.name.trim().toLowerCase()));
  const now = new Date().toISOString();
  for (const r of rows) {
    const name = r.category?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (have.has(key)) continue;
    await insertCategory({
      id: uuidv4(),
      userId,
      name,
      createdAt: now,
      updatedAt: now,
    });
    have.add(key);
  }
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
  // 대소문자 무시 조회 (GitHub full_name 정규화 전후 모두)
  const rows = await qall(
    db.select().from(githubStars).where(eq(githubStars.userId, userId))
  );
  const key = repoFullName.trim().toLowerCase();
  return rows.find((r) => r.repoFullName.toLowerCase() === key);
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

/** 미확인 Star 변경 뱃지 모두 제거 */
export async function clearStarChanges(userId: string): Promise<number> {
  const rows = await qall(
    db
      .select()
      .from(githubStars)
      .where(eq(githubStars.userId, userId))
  );
  let n = 0;
  for (const r of rows) {
    if (r.changeKind) {
      await qrun(
        db
          .update(githubStars)
          .set({ changeKind: null, starsDelta: 0, changedAt: null })
          .where(eq(githubStars.id, r.id))
      );
      n += 1;
    }
  }
  return n;
}

/** 미확인 변경(신규/업데이트) 개수 */
export async function countStarChanges(userId: string): Promise<number> {
  const rows = await qall(
    db
      .select()
      .from(githubStars)
      .where(eq(githubStars.userId, userId))
  );
  return rows.filter((r) => r.changeKind === "new" || r.changeKind === "updated")
    .length;
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
/** 목록용. full=false 이면 content/bundle 비움(속도). */
export async function listAgentDocs(
  userId: string,
  opts?: { full?: boolean }
): Promise<AgentDocRow[]> {
  const rows = await qall(
    db
      .select()
      .from(agentDocs)
      .where(eq(agentDocs.userId, userId))
      .orderBy(desc(agentDocs.updatedAt))
  );
  if (opts?.full === true) return rows;
  return rows.map((r) => ({ ...r, content: "", bundle: "[]" }));
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

// --- prompts ---
export async function listPrompts(userId: string): Promise<PromptRow[]> {
  return qall(
    db
      .select()
      .from(prompts)
      .where(eq(prompts.userId, userId))
      .orderBy(desc(prompts.updatedAt))
  );
}

export async function getPrompt(
  id: string,
  userId: string
): Promise<PromptRow | undefined> {
  return qget(
    db
      .select()
      .from(prompts)
      .where(and(eq(prompts.id, id), eq(prompts.userId, userId)))
  );
}

export async function insertPrompt(row: PromptRow): Promise<PromptRow> {
  await qrun(db.insert(prompts).values(row));
  return (await getPrompt(row.id, row.userId))!;
}

export async function updatePrompt(
  id: string,
  userId: string,
  patch: Partial<PromptRow>
): Promise<PromptRow | undefined> {
  const { id: _i, userId: _u, ...rest } = patch as PromptRow;
  await qrun(
    db
      .update(prompts)
      .set(rest)
      .where(and(eq(prompts.id, id), eq(prompts.userId, userId)))
  );
  return getPrompt(id, userId);
}

export async function deletePrompt(id: string, userId: string): Promise<void> {
  await qrun(
    db
      .delete(prompts)
      .where(and(eq(prompts.id, id), eq(prompts.userId, userId)))
  );
}

// --- dashboard / search ---
export async function getDashboardCounts(
  userId: string
): Promise<DashboardCounts> {
  const [b] = await qall(
    db
      .select({ c: count() })
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
  );
  const [s] = await qall(
    db
      .select({ c: count() })
      .from(githubStars)
      .where(eq(githubStars.userId, userId))
  );
  const [p] = await qall(
    db
      .select({ c: count() })
      .from(customPages)
      .where(eq(customPages.userId, userId))
  );
  const [a] = await qall(
    db
      .select({ c: count() })
      .from(agentDocs)
      .where(eq(agentDocs.userId, userId))
  );
  const cats = await qall(
    db
      .select({ category: bookmarks.category })
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
  );
  const catSet = new Set(
    cats.map((r) => r.category?.trim() || "미분류")
  );
  return {
    bookmarks: Number(b?.c ?? 0),
    stars: Number(s?.c ?? 0),
    pages: Number(p?.c ?? 0),
    agentDocs: Number(a?.c ?? 0),
    categories: catSet.size,
  };
}

export async function listCategoryCounts(
  userId: string,
  limit = 8
): Promise<CategoryCount[]> {
  const rows = await qall(
    db
      .select({ category: bookmarks.category })
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
  );
  const map = new Map<string, number>();
  for (const r of rows) {
    const name = r.category?.trim() || "미분류";
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

export async function listRecentBookmarks(
  userId: string,
  limit = 6
): Promise<BookmarkRow[]> {
  return qall(
    db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.createdAt))
      .limit(limit)
  );
}

export async function listRecentStars(
  userId: string,
  limit = 5
): Promise<GithubStarRow[]> {
  return qall(
    db
      .select()
      .from(githubStars)
      .where(eq(githubStars.userId, userId))
      .orderBy(desc(githubStars.lastSynced))
      .limit(limit)
  );
}

export async function listRecentPages(
  userId: string,
  limit = 5
): Promise<CustomPageRow[]> {
  return qall(
    db
      .select()
      .from(customPages)
      .where(eq(customPages.userId, userId))
      .orderBy(desc(customPages.updatedAt))
      .limit(limit)
  );
}

export async function searchBookmarks(
  userId: string,
  opts: SearchOpts = {}
): Promise<BookmarkRow[]> {
  const lim = opts.limit ?? 100;
  const rows = await qall(
    db
      .select()
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.createdAt))
      .limit(Math.min(lim * 3, 500))
  );
  const q = opts.q?.trim().toLowerCase();
  const cat = opts.category?.trim().toLowerCase();
  const tag = opts.tag?.trim().toLowerCase();
  return rows
    .filter((r) => {
      if (cat && (r.category ?? "").toLowerCase() !== cat) return false;
      if (opts.from && r.createdAt < opts.from) return false;
      if (opts.to && r.createdAt > opts.to + "T23:59:59") return false;
      if (tag) {
        try {
          if (
            !(JSON.parse(r.tags || "[]") as string[]).some(
              (t) => t.toLowerCase() === tag
            )
          )
            return false;
        } catch {
          if (!(r.tags || "").toLowerCase().includes(tag)) return false;
        }
      }
      if (!q) return true;
      const hay = [r.title, r.description ?? "", r.url, r.tags, r.category ?? ""]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    })
    .slice(0, lim);
}

export async function searchStars(
  userId: string,
  opts: SearchOpts = {}
): Promise<GithubStarRow[]> {
  const lim = opts.limit ?? 100;
  const rows = await qall(
    db
      .select()
      .from(githubStars)
      .where(eq(githubStars.userId, userId))
      .orderBy(desc(githubStars.stars))
      .limit(Math.min(lim * 3, 500))
  );
  const q = opts.q?.trim().toLowerCase();
  const tag = opts.tag?.trim().toLowerCase();
  return rows
    .filter((r) => {
      if (opts.from && r.createdAt < opts.from) return false;
      if (opts.to && r.createdAt > opts.to + "T23:59:59") return false;
      if (tag) {
        try {
          if (
            !(JSON.parse(r.topics || "[]") as string[]).some(
              (t) => t.toLowerCase() === tag
            )
          )
            return false;
        } catch {
          if (!(r.topics || "").toLowerCase().includes(tag)) return false;
        }
      }
      if (!q) return true;
      const hay = [
        r.repoFullName,
        r.description ?? "",
        r.language ?? "",
        r.topics,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    })
    .slice(0, lim);
}

export async function searchPages(
  userId: string,
  opts: SearchOpts = {}
): Promise<CustomPageRow[]> {
  const lim = opts.limit ?? 50;
  const rows = await qall(
    db
      .select()
      .from(customPages)
      .where(eq(customPages.userId, userId))
      .orderBy(desc(customPages.updatedAt))
      .limit(Math.min(lim * 3, 300))
  );
  const q = opts.q?.trim().toLowerCase();
  return rows
    .filter((r) => {
      if (opts.from && r.updatedAt < opts.from) return false;
      if (opts.to && r.updatedAt > opts.to + "T23:59:59") return false;
      if (!q) return true;
      return `${r.title} ${r.content}`.toLowerCase().includes(q);
    })
    .slice(0, lim);
}

export async function searchAgentDocs(
  userId: string,
  opts: SearchOpts = {}
): Promise<AgentDocRow[]> {
  const lim = opts.limit ?? 50;
  const rows = await qall(
    db
      .select()
      .from(agentDocs)
      .where(eq(agentDocs.userId, userId))
      .orderBy(desc(agentDocs.updatedAt))
      .limit(Math.min(lim * 3, 300))
  );
  const q = opts.q?.trim().toLowerCase();
  return rows
    .filter((r) => {
      if (opts.from && r.updatedAt < opts.from) return false;
      if (opts.to && r.updatedAt > opts.to + "T23:59:59") return false;
      if (!q) return true;
      const hay = [
        r.title,
        r.filename,
        r.description ?? "",
        r.kind,
        r.content,
        r.bundle,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    })
    .slice(0, lim);
}
