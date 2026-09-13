// 다솔인 그록봇 공개 템플릿 710개를 grok_bots에 넣는다
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
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

export const LOCAL_USER = "dev";
export const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
export const SOURCE_URL = "https://dasolin.net/tips/grokbot-templates";
export const EXPECTED_COUNT = 710;
export const SNAPSHOT_PATH = resolve(
  root,
  "scripts/data/grokbot-templates.json"
);
export const CATEGORY_ORDER = [
  "공식 마켓플레이스",
  "어시스턴트",
  "엔지니어링",
  "리서치",
  "세일즈·마케팅",
  "금융·비용",
  "크리에이티브",
  "개인·생활",
];

const CREATE_SQL = `
    CREATE TABLE IF NOT EXISTS grok_bots (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, slug TEXT,
      name TEXT NOT NULL, name_en TEXT NOT NULL DEFAULT '',
      creator TEXT NOT NULL DEFAULT '', category TEXT,
      description TEXT NOT NULL DEFAULT '',
      how_it_works TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      skills TEXT NOT NULL DEFAULT '[]',
      routines TEXT NOT NULL DEFAULT '[]',
      template_url TEXT NOT NULL, source_url TEXT,
      official_marketplace INTEGER NOT NULL DEFAULT 0,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_grok_bots_user ON grok_bots(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_grok_bots_user_template ON grok_bots(user_id, template_url);
`;

/** trim 후 끝 슬래시를 제거한다. */
export function normalizeTemplateUrl(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/\/+$/, "");
}

/** 스냅샷 JSON의 items 배열을 읽는다. */
export function loadCatalog() {
  const raw = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
  return Array.isArray(raw.items) ? raw.items : [];
}

function entriesJson(raw) {
  const entries = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    if (!name) continue;
    const row = { name };
    if (typeof item.descriptionKo === "string" && item.descriptionKo.trim()) {
      row.descriptionKo = item.descriptionKo.trim();
    }
    if (typeof item.schedule === "string" && item.schedule.trim()) {
      row.schedule = item.schedule.trim();
    }
    entries.push(row);
  }
  return JSON.stringify(entries);
}

function toRow(item, userId, now) {
  const source = typeof item.sourceUrl === "string" ? item.sourceUrl.trim() : "";
  const slug = typeof item.slug === "string" ? item.slug.trim() : "";
  const category =
    typeof item.category === "string" ? item.category.trim() : "";
  return {
    id: randomUUID(),
    user_id: userId,
    slug: slug || null,
    name: String(item.name ?? "").trim(),
    name_en: typeof item.nameEn === "string" ? item.nameEn.trim() : "",
    creator: typeof item.creator === "string" ? item.creator.trim() : "",
    category: category || null,
    description:
      typeof item.description === "string" ? item.description : "",
    how_it_works:
      typeof item.howItWorks === "string" ? item.howItWorks : "",
    notes: typeof item.notes === "string" ? item.notes : "",
    skills: entriesJson(item.skills),
    routines: entriesJson(item.routines),
    template_url: normalizeTemplateUrl(item.templateUrl),
    source_url: source || null,
    official_marketplace: item.officialMarketplace === true ? 1 : 0,
    is_favorite: 0,
    created_at: now,
    updated_at: now,
  };
}

function insertLocal(items, now) {
  const db = new Database(resolve(root, "data/mymark.db"));
  db.exec(CREATE_SQL);
  const existing = new Set(
    db
      .prepare("SELECT template_url FROM grok_bots WHERE user_id = ?")
      .all(LOCAL_USER)
      .map((row) => normalizeTemplateUrl(row.template_url))
  );
  const insert = db.prepare(`
    INSERT INTO grok_bots (
      id, user_id, slug, name, name_en, creator, category,
      description, how_it_works, notes, skills, routines,
      template_url, source_url, official_marketplace, is_favorite,
      created_at, updated_at
    ) VALUES (
      @id, @user_id, @slug, @name, @name_en, @creator, @category,
      @description, @how_it_works, @notes, @skills, @routines,
      @template_url, @source_url, @official_marketplace, @is_favorite,
      @created_at, @updated_at
    )
  `);
  let added = 0;
  const add = db.transaction(() => {
    for (const item of items) {
      const row = toRow(item, LOCAL_USER, now);
      if (!row.name || !row.template_url) continue;
      if (existing.has(row.template_url)) continue;
      insert.run(row);
      existing.add(row.template_url);
      added += 1;
    }
  });
  add();
  db.close();
  return added;
}

function isMissingGrokBotsTable(message) {
  const text = String(message ?? "");
  if (!/grok_bots/i.test(text)) return false;
  return /schema cache|does not exist|PGRST205|Could not find the table/i.test(
    text
  );
}

async function insertProduction(items, now) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase 환경변수가 없습니다.");

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const existing = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("grok_bots")
      .select("template_url")
      .eq("user_id", PROD_USER)
      .range(from, from + 999);
    if (error && isMissingGrokBotsTable(error.message || error.code)) {
      const err = new Error(
        "그록봇 테이블이 없습니다. supabase/add_grok_bots.sql 을 SQL Editor에서 실행하세요."
      );
      err.missingTable = true;
      throw err;
    }
    if (error) throw error;
    for (const row of data ?? []) {
      existing.add(normalizeTemplateUrl(row.template_url));
    }
    if (!data || data.length < 1000) break;
  }

  const pending = [];
  for (const item of items) {
    const row = toRow(item, PROD_USER, now);
    if (!row.name || !row.template_url) continue;
    if (existing.has(row.template_url)) continue;
    pending.push(row);
    existing.add(row.template_url);
  }

  for (let i = 0; i < pending.length; i += 100) {
    const chunk = pending.slice(i, i + 100);
    const { error } = await sb.from("grok_bots").insert(chunk);
    if (error) throw error;
  }
  return pending.length;
}

async function main() {
  const items = loadCatalog();
  const now = new Date().toISOString();
  const localAdded = insertLocal(items, now);
  let productionAdded;
  try {
    productionAdded = await insertProduction(items, now);
  } catch (err) {
    if (err?.missingTable || isMissingGrokBotsTable(err?.message)) {
      console.error(err.message);
      productionAdded = 0;
    } else {
      throw err;
    }
  }
  console.log(
    JSON.stringify({
      localAdded,
      productionAdded,
      total: items.length,
    })
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
