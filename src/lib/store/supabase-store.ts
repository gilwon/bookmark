// Supabase JS (service_role) 스토어 — PostgREST, 직접 DATABASE_URL 없음
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  agentDocToDb,
  bookmarkToDb,
  mapAgentDoc,
  mapBookmark,
  mapPage,
  mapStar,
  mapToken,
  pageToDb,
  starToDb,
  tokenToDb,
} from "./mappers";
import type {
  AgentDocRow,
  BookmarkRow,
  CustomPageRow,
  GithubStarRow,
  OauthTokenRow,
} from "./types";

function sb() {
  return getSupabaseAdmin();
}

function throwIfError(error: { message: string } | null, ctx: string) {
  if (error) throw new Error(`[supabase] ${ctx}: ${error.message}`);
}

// --- bookmarks ---
export async function listBookmarks(userId: string): Promise<BookmarkRow[]> {
  const { data, error } = await sb()
    .from("bookmarks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
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

export async function listStarsBySynced(userId: string): Promise<GithubStarRow[]> {
  const { data, error } = await sb()
    .from("github_stars")
    .select("*")
    .eq("user_id", userId)
    .order("last_synced", { ascending: false });
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
  const { data, error } = await sb()
    .from("github_stars")
    .select("*")
    .eq("user_id", userId)
    .eq("repo_full_name", repoFullName)
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

  const { error } = await sb()
    .from("github_stars")
    .update(body)
    .eq("id", id)
    .eq("user_id", userId);
  throwIfError(error, "updateStar");
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
 * 목록용. full=false 이면 content/bundle 제외(용량·속도).
 * 검색·본문 미리보기가 필요하면 full: true.
 */
export async function listAgentDocs(
  userId: string,
  opts?: { full?: boolean }
): Promise<AgentDocRow[]> {
  const full = opts?.full === true;
  const { data, error } = await sb()
    .from("agent_docs")
    .select(
      full
        ? "*"
        : "id, user_id, kind, filename, title, description, created_at, updated_at"
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  throwIfError(error, "listAgentDocs");
  return (data ?? []).map((r) => {
    if (full) return mapAgentDoc(r);
    const row = r as Record<string, unknown>;
    return mapAgentDoc({ ...row, content: "", bundle: "[]" });
  });
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
