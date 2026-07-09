// Drizzle Kit 설정 — SQLite 로컬 DB 경로
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data/mymark.db",
  },
});
