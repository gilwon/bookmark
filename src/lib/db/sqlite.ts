// 로컬 SQLite 전용 Drizzle 인스턴스 (Supabase JS 모드가 아닐 때만 사용)
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import * as schema from "./schema.sqlite";

const globalForDb = globalThis as unknown as {
  sqlite?: Database.Database;
  sqliteDb?: ReturnType<typeof drizzle<typeof schema>>;
};

function createSqlite() {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const sqlite = new Database(path.join(dataDir, "mymark.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, url TEXT NOT NULL,
      title TEXT NOT NULL, description TEXT, image TEXT, favicon TEXT,
      tags TEXT NOT NULL DEFAULT '[]', category TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS github_stars (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, repo_full_name TEXT NOT NULL,
      description TEXT, language TEXT, stars INTEGER NOT NULL DEFAULT 0,
      topics TEXT NOT NULL DEFAULT '[]', url TEXT NOT NULL,
      last_synced TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS custom_pages (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS oauth_tokens (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, provider TEXT NOT NULL,
      access_token_enc TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agent_docs (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'other',
      filename TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
      content TEXT NOT NULL DEFAULT '', bundle TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
    CREATE INDEX IF NOT EXISTS idx_stars_user ON github_stars(user_id);
    CREATE INDEX IF NOT EXISTS idx_stars_repo ON github_stars(user_id, repo_full_name);
    CREATE INDEX IF NOT EXISTS idx_pages_user ON custom_pages(user_id);
    CREATE INDEX IF NOT EXISTS idx_agent_docs_user ON agent_docs(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_user_provider ON oauth_tokens(user_id, provider);
  `);
  const cols = sqlite.prepare("PRAGMA table_info(agent_docs)").all() as {
    name: string;
  }[];
  if (cols.length && !cols.some((c) => c.name === "bundle")) {
    sqlite.exec(
      "ALTER TABLE agent_docs ADD COLUMN bundle TEXT NOT NULL DEFAULT '[]'"
    );
  }
  return drizzle(sqlite, { schema });
}

export const db = globalForDb.sqliteDb ?? createSqlite();
if (process.env.NODE_ENV !== "production") {
  globalForDb.sqliteDb = db;
}
