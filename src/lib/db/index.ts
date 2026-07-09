// DB 싱글톤 — DATABASE_URL 있으면 Supabase Postgres, 없으면 로컬 SQLite
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import postgres from "postgres";
import { getDatabaseUrl, usePostgres } from "./env";
import * as pgSchema from "./schema.pg";
import * as sqliteSchema from "./schema.sqlite";

const globalForDb = globalThis as unknown as {
  sqlite?: Database.Database;
  pgClient?: ReturnType<typeof postgres>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema?: any;
  dbDriver?: "sqlite" | "postgres";
};

function createSqlite() {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, "mymark.db");
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
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
    CREATE TABLE IF NOT EXISTS agent_docs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'other',
      filename TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      content TEXT NOT NULL DEFAULT '',
      bundle TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
    CREATE INDEX IF NOT EXISTS idx_stars_user ON github_stars(user_id);
    CREATE INDEX IF NOT EXISTS idx_stars_repo ON github_stars(user_id, repo_full_name);
    CREATE INDEX IF NOT EXISTS idx_pages_user ON custom_pages(user_id);
    CREATE INDEX IF NOT EXISTS idx_agent_docs_user ON agent_docs(user_id);
    CREATE INDEX IF NOT EXISTS idx_agent_docs_kind ON agent_docs(user_id, kind);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_user_provider
      ON oauth_tokens(user_id, provider);
  `);

  const cols = sqlite
    .prepare("PRAGMA table_info(agent_docs)")
    .all() as { name: string }[];
  if (cols.length > 0 && !cols.some((c) => c.name === "bundle")) {
    sqlite.exec(
      "ALTER TABLE agent_docs ADD COLUMN bundle TEXT NOT NULL DEFAULT '[]'"
    );
  }

  return drizzleSqlite(sqlite, { schema: sqliteSchema });
}

function createPostgres() {
  const url = getDatabaseUrl();
  const client =
    globalForDb.pgClient ??
    postgres(url, {
      prepare: false, // Supabase pooler (transaction mode) 호환
      max: 10,
    });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.pgClient = client;
  }
  return drizzlePg(client, { schema: pgSchema });
}

const driver: "sqlite" | "postgres" = usePostgres()
  ? "postgres"
  : "sqlite";

const schema = driver === "postgres" ? pgSchema : sqliteSchema;
const db =
  globalForDb.db && globalForDb.dbDriver === driver
    ? globalForDb.db
    : driver === "postgres"
      ? createPostgres()
      : createSqlite();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
  globalForDb.dbDriver = driver;
  globalForDb.schema = schema;
}

if (typeof console !== "undefined" && process.env.NODE_ENV !== "test") {
  // 기동 시 한 번 로그
  if (!(globalThis as { __mymarkDbLogged?: boolean }).__mymarkDbLogged) {
    console.info(
      `[db] driver=${driver}${driver === "postgres" ? " (Supabase/Postgres)" : " (local SQLite)"}`
    );
    (globalThis as { __mymarkDbLogged?: boolean }).__mymarkDbLogged = true;
  }
}

export { db, schema, driver };
export const bookmarks = schema.bookmarks;
export const githubStars = schema.githubStars;
export const customPages = schema.customPages;
export const oauthTokens = schema.oauthTokens;
export const agentDocs = schema.agentDocs;

export type BookmarkRow = typeof bookmarks.$inferSelect;
export type GithubStarRow = typeof githubStars.$inferSelect;
export type CustomPageRow = typeof customPages.$inferSelect;
export type OauthTokenRow = typeof oauthTokens.$inferSelect;
export type AgentDocRow = typeof agentDocs.$inferSelect;
