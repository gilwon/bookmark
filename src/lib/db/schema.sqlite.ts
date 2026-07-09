// SQLite 스키마 (로컬 개발 기본)
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const bookmarks = sqliteTable("bookmarks", {
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

export const githubStars = sqliteTable("github_stars", {
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
});

export const customPages = sqliteTable("custom_pages", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const oauthTokens = sqliteTable("oauth_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  provider: text("provider").notNull(),
  accessTokenEnc: text("access_token_enc").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const agentDocs = sqliteTable("agent_docs", {
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
