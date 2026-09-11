// DESIGN.md·UI 사이트 7개를 bookmarks 디자인 카테고리에 저장한다
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
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

export const CATEGORY = "디자인";
export const LOCAL_USER = "dev";
export const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const META_CONCURRENCY = 4;
const META_TIMEOUT_SEC = 8;

const require = createRequire(import.meta.url);
let urlLib = null;
let metaLib = null;

function loadUrlLib() {
  if (urlLib) return urlLib;
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  urlLib = require(resolve(root, "src/lib/bookmark-url.ts"));
  return urlLib;
}

function loadMetaLib() {
  if (metaLib) return metaLib;
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  metaLib = require(resolve(root, "src/lib/meta.ts"));
  return metaLib;
}

export function bookmarkUrlKey(raw) {
  return loadUrlLib().bookmarkUrlKey(raw);
}

export function isSameBookmarkUrl(a, b) {
  return loadUrlLib().isSameBookmarkUrl(a, b);
}

/** http를 https로 올리고 비교용 키를 만든다. */
export function toHttpsUrl(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed.replace(/^http:\/\//i, "https://")
    : `https://${trimmed}`;
  const key = bookmarkUrlKey(withScheme);
  if (!key) return withScheme;
  try {
    const parsed = new URL(withScheme);
    parsed.protocol = "https:";
    parsed.hash = "";
    parsed.search = "";
    return parsed.href;
  } catch {
    return withScheme;
  }
}

export const ITEMS = [
  {
    title: "GetLayers",
    url: "https://www.getlayers.ai/",
    description:
      "프롬프트를 복사해 AI에 붙여 넣으면 시네마틱 랜딩과 3D 장면을 만드는 템플릿 라이브러리다.",
    tags: ["GetLayers", "템플릿", "프롬프트"],
  },
  {
    title: "shadcn/ui",
    url: "https://ui.shadcn.com/",
    description:
      "복사해 쓰는 React 컴포넌트 모음이다. Tailwind와 Radix 위에 직접 커스터마이즈한다.",
    tags: ["shadcn", "React", "Tailwind"],
  },
  {
    title: "designmd.supply",
    url: "https://designmd.supply/",
    description:
      "공개 도메인을 넣으면 브랜드 스타일가이드를 DESIGN.md로 만들어 주는 오픈소스다.",
    tags: ["DESIGN.md", "스타일가이드", "오픈소스"],
  },
  {
    title: "21st.dev",
    url: "https://21st.dev/",
    description:
      "AI 코딩에 붙여 넣는 React 컴포넌트와 템플릿을 모은 UI 마켓플레이스다.",
    tags: ["21st", "컴포넌트", "마켓플레이스"],
  },
  {
    title: "designmd.me",
    url: "https://designmd.me/",
    description:
      "사이트 URL에서 토큰을 뽑아 DESIGN.md와 HTML 미리보기, 피그마 가져오기를 만든다.",
    tags: ["DESIGN.md", "토큰", "Figma"],
  },
  {
    title: "designmd.co",
    url: "https://designmd.co/",
    description:
      "브랜드 DESIGN.md 카탈로그와 MCP로 에이전트에 디자인 맥락을 넣는 서비스다.",
    tags: ["DESIGN.md", "카탈로그", "MCP"],
  },
  {
    title: "getdesign.md",
    url: "https://getdesign.md/",
    description:
      "실제 사이트 분석으로 만든 DESIGN.md를 모아 코딩 에이전트에 디자인 레퍼런스를 준다.",
    tags: ["DESIGN.md", "레퍼런스", "카탈로그"],
  },
];

export function filterNewItems(items, existingUrls) {
  const pending = [];
  const skippedDup = [];
  const pool = [...existingUrls];
  for (const item of items) {
    if (
      pool.some((url) =>
        isSameBookmarkUrl(toHttpsUrl(url), toHttpsUrl(item.url))
      )
    ) {
      skippedDup.push(item);
      continue;
    }
    pending.push(item);
    pool.push(item.url);
  }
  return { pending, skippedDup };
}

/** 태그가 없거나 빈 배열이면 채울 대상으로 본다. */
export function isEmptyTags(tags) {
  if (tags == null) return true;
  if (Array.isArray(tags)) return tags.length === 0;
  const raw = String(tags).trim();
  if (!raw || raw === "null") return true;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.length === 0;
  } catch {
    return false;
  }
  return false;
}

/** 이미 있는 URL 중 태그만 비어 있는 항목을 고른다. */
export function itemsNeedingTags(items, existingRows) {
  const tagged = [];
  for (const item of items) {
    const existing = existingRows.find((row) =>
      isSameBookmarkUrl(toHttpsUrl(row.url), toHttpsUrl(item.url))
    );
    if (!existing) continue;
    if (!isEmptyTags(existing.tags)) continue;
    tagged.push(item);
  }
  return tagged;
}

function findExistingUrl(existingRows, item) {
  const existing = existingRows.find((row) =>
    isSameBookmarkUrl(toHttpsUrl(row.url), toHttpsUrl(item.url))
  );
  return existing?.url ?? null;
}

function toRow(item, userId, now, image, favicon) {
  return {
    id: randomUUID(),
    user_id: userId,
    url: item.url,
    title: item.title,
    description: item.description,
    image,
    favicon,
    tags: JSON.stringify(item.tags),
    category: CATEGORY,
    is_favorite: 0,
    created_at: now,
  };
}

async function attachMeta(items) {
  const { extractMeta, mapPool } = loadMetaLib();
  return mapPool(items, META_CONCURRENCY, async (item) => {
    let image = null;
    let favicon = null;
    try {
      const meta = await extractMeta(item.url, { timeoutSec: META_TIMEOUT_SEC });
      image = meta?.image ?? null;
      favicon = meta?.favicon ?? null;
    } catch {
      image = null;
      favicon = null;
    }
    return { ...item, image, favicon };
  });
}

function ensureLocalCategory(db, now) {
  const row = db
    .prepare("SELECT id FROM categories WHERE user_id = ? AND name = ?")
    .get(LOCAL_USER, CATEGORY);
  if (row) return;
  db.prepare(
    `INSERT INTO categories (id, user_id, name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(randomUUID(), LOCAL_USER, CATEGORY, now, now);
}

function insertLocal(items, now) {
  const db = new Database(resolve(root, "data/mymark.db"));
  try {
    ensureLocalCategory(db, now);
    const existingRows = db
      .prepare("SELECT url, tags FROM bookmarks WHERE user_id = ?")
      .all(LOCAL_USER);
    const existing = existingRows.map((row) => row.url);
    const { pending, skippedDup } = filterNewItems(items, existing);
    const tagged = itemsNeedingTags(items, existingRows);
    const insert = db.prepare(`
      INSERT INTO bookmarks
        (id, user_id, url, title, description, image, favicon, tags, category, is_favorite, created_at)
      VALUES (@id, @user_id, @url, @title, @description, @image, @favicon, @tags, @category, @is_favorite, @created_at)
    `);
    const updateTags = db.prepare(
      `UPDATE bookmarks SET tags = ? WHERE user_id = ? AND url = ?`
    );
    const add = db.transaction(() => {
      for (const item of pending) {
        insert.run(
          toRow(item, LOCAL_USER, now, item.image ?? null, item.favicon ?? null)
        );
      }
      for (const item of tagged) {
        const existingUrl = findExistingUrl(existingRows, item);
        if (!existingUrl) continue;
        updateTags.run(JSON.stringify(item.tags), LOCAL_USER, existingUrl);
      }
    });
    add();
    return {
      added: pending.length,
      skippedDup: skippedDup.length,
      tagged: tagged.length,
      addedTitles: pending.map((item) => item.title),
      skippedDupTitles: skippedDup.map((item) => item.title),
      taggedTitles: tagged.map((item) => item.title),
    };
  } finally {
    db.close();
  }
}

async function ensureProductionCategory(sb, now) {
  const { data, error } = await sb
    .from("categories")
    .select("id")
    .eq("user_id", PROD_USER)
    .eq("name", CATEGORY)
    .limit(1);
  if (error) throw error;
  if (data?.length) return;
  const { error: insertError } = await sb.from("categories").insert({
    id: randomUUID(),
    user_id: PROD_USER,
    name: CATEGORY,
    created_at: now,
    updated_at: now,
  });
  if (insertError) throw insertError;
}

async function insertRows(sb, rows) {
  if (!rows.length) return;
  const { error } = await sb.from("bookmarks").insert(rows);
  if (!error) return;
  for (const row of rows) {
    const { error: oneError } = await sb.from("bookmarks").insert(row);
    if (!oneError) continue;
    const code = oneError.code ?? "";
    const message = String(oneError.message ?? "");
    if (code === "23505" || message.toLowerCase().includes("duplicate")) {
      continue;
    }
    throw oneError;
  }
}

async function insertProduction(items, now) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase 환경변수가 없습니다.");

  const sb = createClient(url, key, { auth: { persistSession: false } });
  await ensureProductionCategory(sb, now);
  const { data, error } = await sb
    .from("bookmarks")
    .select("url, tags")
    .eq("user_id", PROD_USER);
  if (error) throw error;
  const existingRows = data ?? [];
  const existing = existingRows.map((row) => row.url);
  const { pending, skippedDup } = filterNewItems(items, existing);
  const tagged = itemsNeedingTags(items, existingRows);
  await insertRows(
    sb,
    pending.map((item) =>
      toRow(item, PROD_USER, now, item.image ?? null, item.favicon ?? null)
    )
  );
  for (const item of tagged) {
    const existingUrl = findExistingUrl(existingRows, item);
    if (!existingUrl) continue;
    const { error: updateError } = await sb
      .from("bookmarks")
      .update({ tags: JSON.stringify(item.tags) })
      .eq("user_id", PROD_USER)
      .eq("url", existingUrl);
    if (updateError) throw updateError;
  }
  return {
    added: pending.length,
    skippedDup: skippedDup.length,
    tagged: tagged.length,
    addedTitles: pending.map((item) => item.title),
    skippedDupTitles: skippedDup.map((item) => item.title),
    taggedTitles: tagged.map((item) => item.title),
  };
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes("--check")) {
    const summary = {
      category: CATEGORY,
      count: ITEMS.length,
      items: ITEMS.map((item) => ({
        title: item.title,
        url: item.url,
        tags: item.tags,
      })),
    };
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  }

  const enriched = await attachMeta(ITEMS);
  const now = new Date().toISOString();
  const local = insertLocal(enriched, now);
  const production = await insertProduction(enriched, now);
  const summary = { local, production };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
