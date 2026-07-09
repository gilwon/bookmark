// 로컬 SQLite 전용 Drizzle 인스턴스 (Supabase JS 모드가 아닐 때만 로드·초기화)
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "fs";
import path from "path";
import * as schema from "./schema.sqlite";

type SqliteDb = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  sqliteDb?: SqliteDb;
};

function createSqlite(): SqliteDb {
  // Vercel 등 read-only 서버리스에서는 사용 불가 — store 가 supabase 경로로 우회해야 함
  if (process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    throw new Error(
      "[db] SQLite는 Vercel/서버리스에서 사용할 수 없습니다. " +
        "NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 를 설정하세요."
    );
  }

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
      last_synced TEXT NOT NULL, created_at TEXT NOT NULL,
      change_kind TEXT, stars_delta INTEGER NOT NULL DEFAULT 0, changed_at TEXT,
      source TEXT NOT NULL DEFAULT 'sync'
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
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL,
      category TEXT, summary TEXT, when_to_use TEXT,
      sections TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
    CREATE INDEX IF NOT EXISTS idx_stars_user ON github_stars(user_id);
    CREATE INDEX IF NOT EXISTS idx_stars_repo ON github_stars(user_id, repo_full_name);
    CREATE INDEX IF NOT EXISTS idx_pages_user ON custom_pages(user_id);
    CREATE INDEX IF NOT EXISTS idx_agent_docs_user ON agent_docs(user_id);
    CREATE INDEX IF NOT EXISTS idx_prompts_user ON prompts(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_user_provider ON oauth_tokens(user_id, provider);
  `);
  const agentCols = sqlite.prepare("PRAGMA table_info(agent_docs)").all() as {
    name: string;
  }[];
  if (agentCols.length && !agentCols.some((c) => c.name === "bundle")) {
    sqlite.exec(
      "ALTER TABLE agent_docs ADD COLUMN bundle TEXT NOT NULL DEFAULT '[]'"
    );
  }
  // Star 변경 뱃지 컬럼 (기존 DB 마이그레이션)
  const starCols = sqlite.prepare("PRAGMA table_info(github_stars)").all() as {
    name: string;
  }[];
  if (starCols.length && !starCols.some((c) => c.name === "change_kind")) {
    sqlite.exec(`
      ALTER TABLE github_stars ADD COLUMN change_kind TEXT;
      ALTER TABLE github_stars ADD COLUMN stars_delta INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE github_stars ADD COLUMN changed_at TEXT;
    `);
  }
  if (starCols.length && !starCols.some((c) => c.name === "source")) {
    sqlite.exec(
      `ALTER TABLE github_stars ADD COLUMN source TEXT NOT NULL DEFAULT 'sync'`
    );
  }
  return drizzle(sqlite, { schema });
}

/** 첫 접근 시에만 SQLite를 연다 (모듈 import 시 생성하지 않음). */
export function getSqliteDb(): SqliteDb {
  if (!globalForDb.sqliteDb) {
    globalForDb.sqliteDb = createSqlite();
  }
  return globalForDb.sqliteDb;
}

/** sqlite-store 호환용 — 지연 초기화 프록시 */
export const db = new Proxy({} as SqliteDb, {
  get(_t, prop, receiver) {
    const real = getSqliteDb();
    const value = Reflect.get(real, prop as string | symbol, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
