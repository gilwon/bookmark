// Drizzle SQLite 스키마 — bookmarks / github_stars / custom_pages
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** 사용자 북마크 */
export const bookmarks = sqliteTable("bookmarks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  url: text("url").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  image: text("image"),
  favicon: text("favicon"),
  // JSON 문자열 배열로 저장
  tags: text("tags").notNull().default("[]"),
  category: text("category"),
  createdAt: text("created_at").notNull(),
});

/** GitHub Star 동기화 결과 */
export const githubStars = sqliteTable("github_stars", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  repoFullName: text("repo_full_name").notNull(),
  description: text("description"),
  language: text("language"),
  stars: integer("stars").notNull().default(0),
  // JSON 문자열 배열로 저장
  topics: text("topics").notNull().default("[]"),
  url: text("url").notNull(),
  lastSynced: text("last_synced").notNull(),
  createdAt: text("created_at").notNull(),
});

/** Notion-like 커스텀 페이지 */
export const customPages = sqliteTable("custom_pages", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  // Tiptap JSON 문서
  content: text("content").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type BookmarkRow = typeof bookmarks.$inferSelect;
export type GithubStarRow = typeof githubStars.$inferSelect;
export type CustomPageRow = typeof customPages.$inferSelect;
