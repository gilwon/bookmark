// Drizzle Kit 설정 — DATABASE_URL 있으면 Postgres, 없으면 SQLite
import { defineConfig } from "drizzle-kit";

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.POSTGRES_URL ||
  "";

const usePg =
  databaseUrl.startsWith("postgres://") ||
  databaseUrl.startsWith("postgresql://");

export default usePg
  ? defineConfig({
      schema: "./src/lib/db/schema.pg.ts",
      out: "./drizzle",
      dialect: "postgresql",
      dbCredentials: { url: databaseUrl },
    })
  : defineConfig({
      schema: "./src/lib/db/schema.sqlite.ts",
      out: "./drizzle",
      dialect: "sqlite",
      dbCredentials: { url: "./data/mymark.db" },
    });
