// Supabase Postgres 스키마 (앱 코드와 동일: text JSON 문자열 유지)
import { integer, pgTable, text } from "drizzle-orm/pg-core";

export const bookmarks = pgTable("bookmarks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  url: text("url").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  image: text("image"),
  favicon: text("favicon"),
  tags: text("tags").notNull().default("[]"),
  category: text("category"),
  createdAt: text("created_at").notNull(),
});

export const githubStars = pgTable("github_stars", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  repoFullName: text("repo_full_name").notNull(),
  description: text("description"),
  language: text("language"),
  stars: integer("stars").notNull().default(0),
  topics: text("topics").notNull().default("[]"),
  url: text("url").notNull(),
  lastSynced: text("last_synced").notNull(),
  createdAt: text("created_at").notNull(),
  changeKind: text("change_kind"),
  starsDelta: integer("stars_delta").notNull().default(0),
  changedAt: text("changed_at"),
  /** sync | manual */
  source: text("source").notNull().default("sync"),
});

export const customPages = pgTable("custom_pages", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const oauthTokens = pgTable("oauth_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  provider: text("provider").notNull(),
  accessTokenEnc: text("access_token_enc").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const agentDocs = pgTable("agent_docs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  kind: text("kind").notNull().default("other"),
  filename: text("filename").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  content: text("content").notNull().default(""),
  bundle: text("bundle").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** 프롬프트 라이브러리 (1차/2차 섹션 JSON) */
export const prompts = pgTable("prompts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  category: text("category"),
  summary: text("summary"),
  whenToUse: text("when_to_use"),
  sections: text("sections").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
