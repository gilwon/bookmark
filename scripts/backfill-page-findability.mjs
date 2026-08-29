// 기존 custom_pages 행의 search_text·tags·source_url을 채운다
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const require = createRequire(import.meta.url);
const tsx = require("tsx/cjs/api");
tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
const { preparePageFindability, isJunkSourceUrl } = require(
  resolve(root, "src/lib/page-findability.ts")
);

export const LOCAL_USER = "dev";
export const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const PROD_CHUNK = 20;
const checkOnly = process.argv.includes("--check");
const MISSING_COL_MSG =
  "custom_pages에 tags/source_url/search_text/is_favorite 컬럼이 없습니다. supabase/add_page_findability.sql 을 실행하세요.";

function tagsAreEmpty(raw) {
  if (raw == null || raw === "") return true;
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return !Array.isArray(v) || v.length === 0;
  } catch {
    return true;
  }
}

function parseTags(raw) {
  if (raw == null || raw === "") return [];
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function parseContent(raw) {
  if (raw == null) return {};
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return raw;
  }
}

function isMissingColumnError(message) {
  return /(tags|source_url|search_text|is_favorite)/i.test(String(message ?? ""));
}

/** 한 행의 갱신값을 계산한다. is_favorite는 건드리지 않는다. */
function planRow(row) {
  const existingTags = tagsAreEmpty(row.tags) ? [] : parseTags(row.tags);
  const rawSource =
    typeof row.source_url === "string" && row.source_url.trim()
      ? row.source_url.trim()
      : "";
  const existingSourceUrl =
    rawSource && !isJunkSourceUrl(rawSource) ? rawSource : null;
  const found = preparePageFindability({
    title: row.title ?? "",
    content: parseContent(row.content),
    existingTags,
    existingSourceUrl,
  });
  const tags = tagsAreEmpty(row.tags) ? JSON.stringify(found.tags) : row.tags;
  const source_url = existingSourceUrl || found.sourceUrl;
  const search_text = found.searchText;
  const changed =
    search_text !== (row.search_text ?? "") ||
    tags !== (row.tags ?? "[]") ||
    (source_url ?? null) !== (row.source_url ?? null);
  return { changed, search_text, tags, source_url };
}

function sqliteHasColumns(db) {
  const cols = db
    .prepare("PRAGMA table_info(custom_pages)")
    .all()
    .map((c) => c.name);
  return ["tags", "source_url", "search_text", "is_favorite"].every((n) =>
    cols.includes(n)
  );
}

function backfillLocal() {
  const dbPath = resolve(root, "data/mymark.db");
  if (!existsSync(dbPath)) {
    console.log("로컬 DB 없음. 건너뜀.");
    return { planned: 0, updated: 0 };
  }
  const db = new Database(dbPath);
  try {
    if (!sqliteHasColumns(db)) {
      throw new Error(MISSING_COL_MSG);
    }
    const rows = db
      .prepare(
        "SELECT id, title, content, tags, source_url, search_text FROM custom_pages WHERE user_id = ?"
      )
      .all(LOCAL_USER);
    const pending = [];
    for (const row of rows) {
      const plan = planRow(row);
      if (plan.changed) pending.push({ id: row.id, ...plan });
    }
    if (checkOnly) {
      console.log(`로컬 갱신 예정 ${pending.length}건`);
      return { planned: pending.length, updated: 0 };
    }
    const update = db.prepare(
      "UPDATE custom_pages SET search_text = ?, tags = ?, source_url = ? WHERE id = ? AND user_id = ?"
    );
    const tx = db.transaction((items) => {
      for (const item of items) {
        update.run(
          item.search_text,
          item.tags,
          item.source_url,
          item.id,
          LOCAL_USER
        );
      }
    });
    tx(pending);
    console.log(`로컬 갱신 ${pending.length}건`);
    return { planned: pending.length, updated: pending.length };
  } finally {
    db.close();
  }
}

async function backfillProd() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log("운영 env 없음. 건너뜀.");
    return { planned: 0, updated: 0 };
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const probe = await sb
    .from("custom_pages")
    .select("id, title, content, tags, source_url, search_text, is_favorite")
    .eq("user_id", PROD_USER)
    .limit(1);
  if (probe.error && isMissingColumnError(probe.error.message)) {
    console.log(`${MISSING_COL_MSG} 운영은 건너뛴다.`);
    return { planned: 0, updated: 0, skipped: true };
  }
  if (probe.error) throw probe.error;

  const rows = [];
  const pageSize = 10;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb
      .from("custom_pages")
      .select("id, title, content, tags, source_url, search_text")
      .eq("user_id", PROD_USER)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error && isMissingColumnError(error.message)) {
      throw new Error(`${MISSING_COL_MSG} (${error.message})`);
    }
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }

  const pending = [];
  for (const row of rows) {
    const plan = planRow(row);
    if (plan.changed) pending.push({ id: row.id, ...plan });
  }
  if (checkOnly) {
    console.log(`운영 갱신 예정 ${pending.length}건`);
    return { planned: pending.length, updated: 0 };
  }

  let updated = 0;
  for (let i = 0; i < pending.length; i += PROD_CHUNK) {
    const chunk = pending.slice(i, i + PROD_CHUNK);
    const results = await Promise.all(
      chunk.map((item) =>
        sb
          .from("custom_pages")
          .update({
            search_text: item.search_text,
            tags: item.tags,
            source_url: item.source_url,
          })
          .eq("id", item.id)
          .eq("user_id", PROD_USER)
      )
    );
    for (const r of results) {
      if (r.error) throw r.error;
    }
    updated += chunk.length;
  }
  console.log(`운영 갱신 ${updated}건`);
  return { planned: pending.length, updated };
}

const local = backfillLocal();
const prod = await backfillProd();
console.log({ local, prod, check: checkOnly });
