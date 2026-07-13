// snake_case (Supabase) ↔ camelCase (앱) 매핑
import type {
  AgentDocRow,
  BookmarkRow,
  CategoryRow,
  CustomPageRow,
  GithubStarRow,
  OauthTokenRow,
  PromptRow,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** DB 값(0/1/bool) → 0|1 */
function toFavoriteFlag(v: unknown): number {
  if (v === true || v === 1 || v === "1") return 1;
  return 0;
}

export function mapBookmark(r: any): BookmarkRow {
  return {
    id: r.id,
    userId: r.user_id ?? r.userId,
    url: r.url,
    title: r.title,
    description: r.description ?? null,
    image: r.image ?? null,
    favicon: r.favicon ?? null,
    tags: r.tags ?? "[]",
    category: r.category ?? null,
    isFavorite: toFavoriteFlag(r.is_favorite ?? r.isFavorite),
    createdAt: r.created_at ?? r.createdAt,
  };
}

export function mapCategory(r: any): CategoryRow {
  return {
    id: r.id,
    userId: r.user_id ?? r.userId,
    name: r.name,
    createdAt: r.created_at ?? r.createdAt,
    updatedAt: r.updated_at ?? r.updatedAt,
  };
}

export function categoryToDb(row: CategoryRow) {
  return {
    id: row.id,
    user_id: row.userId,
    name: row.name,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function mapStar(r: any): GithubStarRow {
  const rawKind = r.change_kind ?? r.changeKind ?? null;
  const changeKind =
    rawKind === "new" || rawKind === "updated" ? rawKind : null;
  return {
    id: r.id,
    userId: r.user_id ?? r.userId,
    repoFullName: r.repo_full_name ?? r.repoFullName,
    description: r.description ?? null,
    language: r.language ?? null,
    stars: r.stars ?? 0,
    topics: r.topics ?? "[]",
    url: r.url,
    lastSynced: r.last_synced ?? r.lastSynced,
    createdAt: r.created_at ?? r.createdAt,
    changeKind,
    starsDelta: Number(r.stars_delta ?? r.starsDelta ?? 0) || 0,
    changedAt: r.changed_at ?? r.changedAt ?? null,
    source: r.source === "manual" ? "manual" : "sync",
  };
}

export function mapPage(r: any): CustomPageRow {
  return {
    id: r.id,
    userId: r.user_id ?? r.userId,
    title: r.title,
    content: r.content ?? "{}",
    createdAt: r.created_at ?? r.createdAt,
    updatedAt: r.updated_at ?? r.updatedAt,
  };
}

export function mapToken(r: any): OauthTokenRow {
  return {
    id: r.id,
    userId: r.user_id ?? r.userId,
    provider: r.provider,
    accessTokenEnc: r.access_token_enc ?? r.accessTokenEnc,
    updatedAt: r.updated_at ?? r.updatedAt,
  };
}

export function mapAgentDoc(r: any): AgentDocRow {
  return {
    id: r.id,
    userId: r.user_id ?? r.userId,
    kind: r.kind,
    filename: r.filename,
    title: r.title,
    description: r.description ?? null,
    content: r.content ?? "",
    bundle: typeof r.bundle === "string" ? r.bundle : JSON.stringify(r.bundle ?? []),
    createdAt: r.created_at ?? r.createdAt,
    updatedAt: r.updated_at ?? r.updatedAt,
  };
}

export function bookmarkToDb(row: Partial<BookmarkRow> & { id: string; userId: string; url: string; title: string; createdAt: string }) {
  return {
    id: row.id,
    user_id: row.userId,
    url: row.url,
    title: row.title,
    description: row.description ?? null,
    image: row.image ?? null,
    favicon: row.favicon ?? null,
    tags: row.tags ?? "[]",
    category: row.category ?? null,
    is_favorite: toFavoriteFlag(row.isFavorite),
    created_at: row.createdAt,
  };
}

export function starToDb(row: GithubStarRow) {
  return {
    id: row.id,
    user_id: row.userId,
    repo_full_name: row.repoFullName,
    description: row.description,
    language: row.language,
    stars: row.stars,
    topics: row.topics,
    url: row.url,
    last_synced: row.lastSynced,
    created_at: row.createdAt,
    change_kind: row.changeKind ?? null,
    stars_delta: row.starsDelta ?? 0,
    changed_at: row.changedAt ?? null,
    source: row.source === "manual" ? "manual" : "sync",
  };
}

export function pageToDb(row: CustomPageRow) {
  return {
    id: row.id,
    user_id: row.userId,
    title: row.title,
    content: row.content,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function tokenToDb(row: OauthTokenRow) {
  return {
    id: row.id,
    user_id: row.userId,
    provider: row.provider,
    access_token_enc: row.accessTokenEnc,
    updated_at: row.updatedAt,
  };
}

export function agentDocToDb(row: AgentDocRow) {
  return {
    id: row.id,
    user_id: row.userId,
    kind: row.kind,
    filename: row.filename,
    title: row.title,
    description: row.description,
    content: row.content,
    bundle: row.bundle,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export function mapPrompt(r: any): PromptRow {
  return {
    id: r.id,
    userId: r.user_id ?? r.userId,
    title: r.title,
    category: r.category ?? null,
    summary: r.summary ?? null,
    whenToUse: r.when_to_use ?? r.whenToUse ?? null,
    sections:
      typeof r.sections === "string"
        ? r.sections
        : JSON.stringify(r.sections ?? []),
    isFavorite: toFavoriteFlag(r.is_favorite ?? r.isFavorite),
    createdAt: r.created_at ?? r.createdAt,
    updatedAt: r.updated_at ?? r.updatedAt,
  };
}

export function promptToDb(row: PromptRow) {
  return {
    id: row.id,
    user_id: row.userId,
    title: row.title,
    category: row.category,
    summary: row.summary,
    when_to_use: row.whenToUse,
    sections: row.sections,
    is_favorite: toFavoriteFlag(row.isFavorite),
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}
