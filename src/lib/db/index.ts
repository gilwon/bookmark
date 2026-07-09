// Drizzle + better-sqlite3 싱글톤 및 테이블 자동 생성
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  sqlite?: Database.Database;
  db?: ReturnType<typeof drizzle<typeof schema>>;
};

/** data 디렉터리와 SQLite 파일을 보장한 뒤 연결을 연다. */
function createSqlite() {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, "mymark.db");
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  // 첫 import 시 테이블 생성 (마이그레이션 없이 MVP 기동)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      image TEXT,
      favicon TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      category TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS github_stars (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      repo_full_name TEXT NOT NULL,
      description TEXT,
      language TEXT,
      stars INTEGER NOT NULL DEFAULT 0,
      topics TEXT NOT NULL DEFAULT '[]',
      url TEXT NOT NULL,
      last_synced TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS custom_pages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS oauth_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      access_token_enc TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
    CREATE INDEX IF NOT EXISTS idx_stars_user ON github_stars(user_id);
    CREATE INDEX IF NOT EXISTS idx_stars_repo ON github_stars(user_id, repo_full_name);
    CREATE INDEX IF NOT EXISTS idx_pages_user ON custom_pages(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_user_provider
      ON oauth_tokens(user_id, provider);
  `);
  return sqlite;
}

const sqlite = globalForDb.sqlite ?? createSqlite();
const db = globalForDb.db ?? drizzle(sqlite, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.sqlite = sqlite;
  globalForDb.db = db;
}

export { db, schema };
