// Supabase JS (service_role) 스토어 — PostgREST, 직접 DATABASE_URL 없음
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { v4 as uuidv4 } from "uuid";
import {
  agentDocToDb,
  bookmarkToDb,
  categoryToDb,
  mapAgentDoc,
  mapBookmark,
  mapCategory,
  mapPage,
  mapPrompt,
  mapStar,
  mapToken,
  pageToDb,
  promptToDb,
  starToDb,
  tokenToDb,
} from "./mappers";
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

function sb() {
  return getSupabaseAdmin();
}

function throwIfError(error: { message: string } | null, ctx: string) {
  if (error) throw new Error(`[supabase] ${ctx}: ${error.message}`);
}

// --- bookmarks ---
export async function listBookmarks(
  userId: string,
  opts?: { limit?: number }
): Promise<BookmarkRow[]> {
  let query = sb()
    .from("bookmarks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (opts?.limit && opts.limit > 0) {
    query = query.limit(opts.limit);
  }
  const { data, error } = await query;
  throwIfError(error, "listBookmarks");
  return (data ?? []).map(mapBookmark);
}

export async function getBookmark(
  id: string,
  userId: string
): Promise<BookmarkRow | undefined> {
  const { data, error } = await sb()
    .from("bookmarks")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  throwIfError(error, "getBookmark");
  return data ? mapBookmark(data) : undefined;
}

export async function insertBookmark(row: BookmarkRow): Promise<BookmarkRow> {
  const { data, error } = await sb()
    .from("bookmarks")
    .insert(bookmarkToDb(row))
    .select("*")
    .single();
  throwIfError(error, "insertBookmark");
  return mapBookmark(data);
}

export async function updateBookmark(
  id: string,
  userId: string,
  patch: Partial<BookmarkRow>
): Promise<BookmarkRow | undefined> {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.image !== undefined) body.image = patch.image;
  if (patch.favicon !== undefined) body.favicon = patch.favicon;
  if (patch.tags !== undefined) body.tags = patch.tags;
  if (patch.category !== undefined) body.category = patch.category;
  if (patch.url !== undefined) body.url = patch.url;

  const { data, error } = await sb()
    .from("bookmarks")
    .update(body)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  throwIfError(error, "updateBookmark");
  return data ? mapBookmark(data) : undefined;
}

export async function deleteBookmark(id: string, userId: string): Promise<void> {
  const { error } = await sb()
    .from("bookmarks")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  throwIfError(error, "deleteBookmark");
}

export async function listBookmarkUrls(userId: string): Promise<string[]> {
  const { data, error } = await sb()
    .from("bookmarks")
    .select("url")
    .eq("user_id", userId);
  throwIfError(error, "listBookmarkUrls");
  return (data ?? []).map((r: { url: string }) => r.url);
}

export async function renameBookmarkCategory(
  userId: string,
  fromName: string,
  toName: string | null
): Promise<number> {
  const from = fromName.trim();
  const { data, error } = await sb()
    .from("bookmarks")
    .update({ category: toName })
    .eq("user_id", userId)
    .eq("category", from)
    .select("id");
  throwIfError(error, "renameBookmarkCategory");
  return data?.length ?? 0;
}

export async function listCategories(userId: string): Promise<CategoryRow[]> {
  const { data, error } = await sb()
    .from("categories")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  throwIfError(error, "listCategories");
  return (data ?? []).map(mapCategory);
}

export async function getCategory(
  id: string,
  userId: string
): Promise<CategoryRow | undefined> {
  const { data, error } = await sb()
    .from("categories")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  throwIfError(error, "getCategory");
  return data ? mapCategory(data) : undefined;
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
  const { data, error } = await sb()
    .from("categories")
    .insert(categoryToDb(row))
    .select("*")
    .single();
  throwIfError(error, "insertCategory");
  return mapCategory(data);
}

export async function updateCategory(
  id: string,
  userId: string,
  patch: Partial<CategoryRow>
): Promise<CategoryRow | undefined> {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.updatedAt !== undefined) body.updated_at = patch.updatedAt;
  const { data, error } = await sb()
    .from("categories")
    .update(body)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  throwIfError(error, "updateCategory");
  return data ? mapCategory(data) : undefined;
}

export async function deleteCategory(
  id: string,
  userId: string
): Promise<void> {
  const { error } = await sb()
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  throwIfError(error, "deleteCategory");
}

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
  const { data, error } = await sb()
    .from("github_stars")
    .select("*")
    .eq("user_id", userId)
    .order("stars", { ascending: false });
  throwIfError(error, "listStars");
  return (data ?? []).map(mapStar);
}

export async function listStarsBySynced(
  userId: string,
  opts?: { limit?: number }
): Promise<GithubStarRow[]> {
  let query = sb()
    .from("github_stars")
    .select("*")
    .eq("user_id", userId)
    .order("last_synced", { ascending: false });
  if (opts?.limit && opts.limit > 0) {
    query = query.limit(opts.limit);
  }
  const { data, error } = await query;
  throwIfError(error, "listStarsBySynced");
  return (data ?? []).map(mapStar);
}

export async function getStar(
  id: string,
  userId: string
): Promise<GithubStarRow | undefined> {
  const { data, error } = await sb()
    .from("github_stars")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  throwIfError(error, "getStar");
  return data ? mapStar(data) : undefined;
}

export async function getStarByRepo(
  userId: string,
  repoFullName: string
): Promise<GithubStarRow | undefined> {
  // 대소문자 무시 (ilike 는 와일드카드 없으면 대소문자 무시 완전 일치)
  const { data, error } = await sb()
    .from("github_stars")
    .select("*")
    .eq("user_id", userId)
    .ilike("repo_full_name", repoFullName.trim())
    .maybeSingle();
  throwIfError(error, "getStarByRepo");
  return data ? mapStar(data) : undefined;
}

export async function insertStar(row: GithubStarRow): Promise<void> {
  const { error } = await sb().from("github_stars").insert(starToDb(row));
  throwIfError(error, "insertStar");
}

export async function updateStar(
  id: string,
  userId: string,
  patch: Partial<GithubStarRow>
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.language !== undefined) body.language = patch.language;
  if (patch.stars !== undefined) body.stars = patch.stars;
  if (patch.topics !== undefined) body.topics = patch.topics;
  if (patch.url !== undefined) body.url = patch.url;
  if (patch.lastSynced !== undefined) body.last_synced = patch.lastSynced;
  if (patch.repoFullName !== undefined) body.repo_full_name = patch.repoFullName;
  if (patch.changeKind !== undefined) body.change_kind = patch.changeKind;
  if (patch.starsDelta !== undefined) body.stars_delta = patch.starsDelta;
  if (patch.changedAt !== undefined) body.changed_at = patch.changedAt;
  if (patch.source !== undefined) body.source = patch.source;

  const { error } = await sb()
    .from("github_stars")
    .update(body)
    .eq("id", id)
    .eq("user_id", userId);
  throwIfError(error, "updateStar");
}

/** 미확인 Star 변경 뱃지 모두 제거 */
export async function clearStarChanges(userId: string): Promise<number> {
  const { data, error } = await sb()
    .from("github_stars")
    .update({ change_kind: null, stars_delta: 0, changed_at: null })
    .eq("user_id", userId)
    .not("change_kind", "is", null)
    .select("id");
  throwIfError(error, "clearStarChanges");
  return data?.length ?? 0;
}

/** 미확인 변경(신규/업데이트) 개수 */
export async function countStarChanges(userId: string): Promise<number> {
  const { count, error } = await sb()
    .from("github_stars")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("change_kind", "is", null);
  throwIfError(error, "countStarChanges");
  return count ?? 0;
}

export async function deleteStar(id: string, userId: string): Promise<void> {
  const { error } = await sb()
    .from("github_stars")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  throwIfError(error, "deleteStar");
}

// --- pages ---
export async function listPages(userId: string): Promise<CustomPageRow[]> {
  const { data, error } = await sb()
    .from("custom_pages")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  throwIfError(error, "listPages");
  return (data ?? []).map(mapPage);
}

export async function getPage(
  id: string,
  userId: string
): Promise<CustomPageRow | undefined> {
  const { data, error } = await sb()
    .from("custom_pages")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  throwIfError(error, "getPage");
  return data ? mapPage(data) : undefined;
}

export async function insertPage(row: CustomPageRow): Promise<CustomPageRow> {
  const { data, error } = await sb()
    .from("custom_pages")
    .insert(pageToDb(row))
    .select("*")
    .single();
  throwIfError(error, "insertPage");
  return mapPage(data);
}

export async function updatePage(
  id: string,
  userId: string,
  patch: Partial<CustomPageRow>
): Promise<CustomPageRow | undefined> {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.content !== undefined) body.content = patch.content;
  if (patch.updatedAt !== undefined) body.updated_at = patch.updatedAt;

  const { data, error } = await sb()
    .from("custom_pages")
    .update(body)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  throwIfError(error, "updatePage");
  return data ? mapPage(data) : undefined;
}

export async function deletePage(id: string, userId: string): Promise<void> {
  const { error } = await sb()
    .from("custom_pages")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  throwIfError(error, "deletePage");
}

// --- tokens ---
export async function getToken(
  userId: string,
  provider: string
): Promise<OauthTokenRow | undefined> {
  const { data, error } = await sb()
    .from("oauth_tokens")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  throwIfError(error, "getToken");
  return data ? mapToken(data) : undefined;
}

export async function upsertToken(row: OauthTokenRow): Promise<void> {
  const existing = await getToken(row.userId, row.provider);
  if (existing) {
    const { error } = await sb()
      .from("oauth_tokens")
      .update({
        access_token_enc: row.accessTokenEnc,
        updated_at: row.updatedAt,
      })
      .eq("id", existing.id);
    throwIfError(error, "upsertToken.update");
  } else {
    const { error } = await sb().from("oauth_tokens").insert(tokenToDb(row));
    throwIfError(error, "upsertToken.insert");
  }
}

export async function deleteToken(
  userId: string,
  provider: string
): Promise<void> {
  const { error } = await sb()
    .from("oauth_tokens")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);
  throwIfError(error, "deleteToken");
}

// --- agent docs ---
/**
 * 목록용. full=false 이면 bundle 제외(용량).
 * content 는 유지해 클라이언트 본문 검색이 동작한다.
 */
export async function listAgentDocs(
  userId: string,
  opts?: { full?: boolean }
): Promise<AgentDocRow[]> {
  const full = opts?.full === true;
  // 컬럼 목록을 분기해 Supabase 타입 추론 오류 방지
  const res = full
    ? await sb()
        .from("agent_docs")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
    : await sb()
        .from("agent_docs")
        .select(
          "id, user_id, kind, filename, title, description, content, created_at, updated_at"
        )
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
  throwIfError(res.error, "listAgentDocs");
  return (res.data ?? []).map((r) =>
    mapAgentDoc(full ? r : { ...r, bundle: "[]" })
  );
}

export async function getAgentDoc(
  id: string,
  userId: string
): Promise<AgentDocRow | undefined> {
  const { data, error } = await sb()
    .from("agent_docs")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  throwIfError(error, "getAgentDoc");
  return data ? mapAgentDoc(data) : undefined;
}

export async function insertAgentDoc(row: AgentDocRow): Promise<AgentDocRow> {
  const { data, error } = await sb()
    .from("agent_docs")
    .insert(agentDocToDb(row))
    .select("*")
    .single();
  throwIfError(error, "insertAgentDoc");
  return mapAgentDoc(data);
}

export async function updateAgentDoc(
  id: string,
  userId: string,
  patch: Partial<AgentDocRow>
): Promise<AgentDocRow | undefined> {
  const body: Record<string, unknown> = {};
  if (patch.kind !== undefined) body.kind = patch.kind;
  if (patch.filename !== undefined) body.filename = patch.filename;
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.content !== undefined) body.content = patch.content;
  if (patch.bundle !== undefined) body.bundle = patch.bundle;
  if (patch.updatedAt !== undefined) body.updated_at = patch.updatedAt;

  const { data, error } = await sb()
    .from("agent_docs")
    .update(body)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  throwIfError(error, "updateAgentDoc");
  return data ? mapAgentDoc(data) : undefined;
}

export async function deleteAgentDoc(id: string, userId: string): Promise<void> {
  const { error } = await sb()
    .from("agent_docs")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  throwIfError(error, "deleteAgentDoc");
}

// --- prompts (공유 라이브러리 — 로그인 사용자 전원 조회/수정) ---
export async function listPrompts(_userId?: string): Promise<PromptRow[]> {
  const { data, error } = await sb()
    .from("prompts")
    .select("*")
    .order("updated_at", { ascending: false });
  throwIfError(error, "listPrompts");
  return (data ?? []).map(mapPrompt);
}

export async function getPrompt(
  id: string,
  _userId?: string
): Promise<PromptRow | undefined> {
  const { data, error } = await sb()
    .from("prompts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwIfError(error, "getPrompt");
  return data ? mapPrompt(data) : undefined;
}

export async function insertPrompt(row: PromptRow): Promise<PromptRow> {
  const { data, error } = await sb()
    .from("prompts")
    .insert(promptToDb(row))
    .select("*")
    .single();
  throwIfError(error, "insertPrompt");
  return mapPrompt(data);
}

export async function updatePrompt(
  id: string,
  _userId: string,
  patch: Partial<PromptRow>
): Promise<PromptRow | undefined> {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.category !== undefined) body.category = patch.category;
  if (patch.summary !== undefined) body.summary = patch.summary;
  if (patch.whenToUse !== undefined) body.when_to_use = patch.whenToUse;
  if (patch.sections !== undefined) body.sections = patch.sections;
  if (patch.updatedAt !== undefined) body.updated_at = patch.updatedAt;

  const { data, error } = await sb()
    .from("prompts")
    .update(body)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  throwIfError(error, "updatePrompt");
  return data ? mapPrompt(data) : undefined;
}

export async function deletePrompt(id: string, _userId: string): Promise<void> {
  const { error } = await sb().from("prompts").delete().eq("id", id);
  throwIfError(error, "deletePrompt");
}

// --- dashboard / search (가벼운 쿼리) ---
async function countTable(
  table: "bookmarks" | "github_stars" | "custom_pages" | "agent_docs",
  userId: string
): Promise<number> {
  const { count, error } = await sb()
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  throwIfError(error, `count:${table}`);
  return count ?? 0;
}

/** 대시보드 숫자 요약 (본문 로드 없음) */
export async function getDashboardCounts(
  userId: string
): Promise<DashboardCounts> {
  const [bookmarks, stars, pages, agentDocs, catRows] = await Promise.all([
    countTable("bookmarks", userId),
    countTable("github_stars", userId),
    countTable("custom_pages", userId),
    countTable("agent_docs", userId),
    sb()
      .from("bookmarks")
      .select("category")
      .eq("user_id", userId)
      .then((r) => {
        throwIfError(r.error, "count categories");
        return r.data ?? [];
      }),
  ]);
  const cats = new Set(
    (catRows as { category: string | null }[]).map(
      (r) => r.category?.trim() || "미분류"
    )
  );
  return {
    bookmarks,
    stars,
    pages,
    agentDocs,
    categories: cats.size,
  };
}

/** 카테고리별 개수 (상위 N) */
export async function listCategoryCounts(
  userId: string,
  limit = 8
): Promise<CategoryCount[]> {
  const { data, error } = await sb()
    .from("bookmarks")
    .select("category")
    .eq("user_id", userId);
  throwIfError(error, "listCategoryCounts");
  const map = new Map<string, number>();
  for (const r of data ?? []) {
    const name = (r.category as string | null)?.trim() || "미분류";
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
  const { data, error } = await sb()
    .from("bookmarks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  throwIfError(error, "listRecentBookmarks");
  return (data ?? []).map(mapBookmark);
}

export async function listRecentStars(
  userId: string,
  limit = 5
): Promise<GithubStarRow[]> {
  const { data, error } = await sb()
    .from("github_stars")
    .select("*")
    .eq("user_id", userId)
    .order("last_synced", { ascending: false })
    .limit(limit);
  throwIfError(error, "listRecentStars");
  return (data ?? []).map(mapStar);
}

export async function listRecentPages(
  userId: string,
  limit = 5
): Promise<CustomPageRow[]> {
  const { data, error } = await sb()
    .from("custom_pages")
    .select("id, user_id, title, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  throwIfError(error, "listRecentPages");
  return (data ?? []).map((r) =>
    mapPage({ ...r, content: "{}" })
  );
}

/** ilike 패턴 이스케이프 */
function likePat(q: string): string {
  return `%${q.replace(/[%_]/g, "\\$&")}%`;
}

function applyDateRange(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  col: string,
  from?: string,
  to?: string
) {
  let q = query;
  if (from) q = q.gte(col, from.length === 10 ? `${from}T00:00:00.000Z` : from);
  if (to) q = q.lte(col, to.length === 10 ? `${to}T23:59:59.999Z` : to);
  return q;
}

/** 북마크 검색 (PostgREST 필터) */
export async function searchBookmarks(
  userId: string,
  opts: SearchOpts = {}
): Promise<BookmarkRow[]> {
  const lim = Math.min(Math.max(opts.limit ?? 100, 1), 200);
  // 태그 후처리 시 여유분 — 이후 slice
  const fetchLim = opts.tag?.trim() ? Math.min(lim * 20, 2000) : lim;
  let query = sb()
    .from("bookmarks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(fetchLim);

  if (opts.category?.trim()) {
    query = query.ilike("category", opts.category.trim());
  }
  query = applyDateRange(query, "created_at", opts.from, opts.to);

  const q = opts.q?.trim();
  if (q) {
    const p = likePat(q);
    query = query.or(
      `title.ilike.${p},description.ilike.${p},url.ilike.${p},tags.ilike.${p},category.ilike.${p}`
    );
  }

  const { data, error } = await query;
  throwIfError(error, "searchBookmarks");
  let rows = (data ?? []).map(mapBookmark);

  // tag 는 JSON 배열 문자열 — 메모리 필터 후 limit 슬라이스
  if (opts.tag?.trim()) {
    const t = opts.tag.trim().toLowerCase();
    rows = rows.filter((r) => {
      try {
        return (JSON.parse(r.tags || "[]") as string[]).some(
          (x) => x.toLowerCase() === t
        );
      } catch {
        return (r.tags || "").toLowerCase().includes(t);
      }
    });
  }
  return rows.slice(0, lim);
}

/** Star 검색 */
export async function searchStars(
  userId: string,
  opts: SearchOpts = {}
): Promise<GithubStarRow[]> {
  const lim = Math.min(Math.max(opts.limit ?? 100, 1), 200);
  const fetchLim = opts.tag?.trim() ? Math.min(lim * 20, 2000) : lim;
  let query = sb()
    .from("github_stars")
    .select("*")
    .eq("user_id", userId)
    .order("stars", { ascending: false })
    .limit(fetchLim);

  query = applyDateRange(query, "created_at", opts.from, opts.to);

  const q = opts.q?.trim();
  if (q) {
    const p = likePat(q);
    query = query.or(
      `repo_full_name.ilike.${p},description.ilike.${p},language.ilike.${p},topics.ilike.${p}`
    );
  }

  const { data, error } = await query;
  throwIfError(error, "searchStars");
  let rows = (data ?? []).map(mapStar);
  if (opts.tag?.trim()) {
    const t = opts.tag.trim().toLowerCase();
    rows = rows.filter((r) => {
      try {
        return (JSON.parse(r.topics || "[]") as string[]).some(
          (x) => x.toLowerCase() === t
        );
      } catch {
        return (r.topics || "").toLowerCase().includes(t);
      }
    });
  }
  return rows.slice(0, lim);
}

/** 페이지 검색 (제목; 본문은 로드 후 필요 시 추가 필터) */
export async function searchPages(
  userId: string,
  opts: SearchOpts = {}
): Promise<CustomPageRow[]> {
  const lim = opts.limit ?? 50;
  let query = sb()
    .from("custom_pages")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(lim);

  query = applyDateRange(query, "updated_at", opts.from, opts.to);

  const q = opts.q?.trim();
  if (q) {
    // 제목 1차 필터 — 본문 매칭은 호출측에서 content 검사 가능하도록 전체 필드 반환
    const p = likePat(q);
    // content 도 text 이므로 ilike 가능
    query = query.or(`title.ilike.${p},content.ilike.${p}`);
  }

  const { data, error } = await query;
  throwIfError(error, "searchPages");
  return (data ?? []).map(mapPage);
}

/** 에이전트 문서 검색 */
export async function searchAgentDocs(
  userId: string,
  opts: SearchOpts = {}
): Promise<AgentDocRow[]> {
  const lim = opts.limit ?? 50;
  let query = sb()
    .from("agent_docs")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(lim);

  query = applyDateRange(query, "updated_at", opts.from, opts.to);

  const q = opts.q?.trim();
  if (q) {
    const p = likePat(q);
    query = query.or(
      `title.ilike.${p},filename.ilike.${p},description.ilike.${p},content.ilike.${p},bundle.ilike.${p},kind.ilike.${p}`
    );
  }

  const { data, error } = await query;
  throwIfError(error, "searchAgentDocs");
  return (data ?? []).map(mapAgentDoc);
}
