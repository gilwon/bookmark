// 디자인 엔지니어 UI 라이브러리 7곳을 bookmarks 디자인 카테고리에 저장한다
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
    title: "termcn",
    url: "https://www.termcn.dev/",
    description:
      "Ink와 OpenTUI 위에 올린 터미널 UI 컴포넌트다. shadcn CLI로 받아 테마와 차트를 바로 쓴다.",
    tags: ["termcn", "터미널", "shadcn", "ui"],
  },
  {
    title: "audiocn",
    url: "https://www.audiocn.dev/",
    description:
      "미터, 페이더, 노브, 파형과 믹서를 담은 React 오디오 UI다. shadcn 방식으로 소스를 받아 고친다.",
    tags: ["audiocn", "오디오", "shadcn", "ui"],
  },
  {
    title: "Arc UI",
    url: "https://uiarc.dev/",
    description:
      "모션이 있는 React 컴포넌트와 블록이다. shadcn CLI나 MCP로 받아 Next.js에 붙인다.",
    tags: ["Arc", "모션", "shadcn", "ui"],
  },
  {
    title: "Beautiful UI",
    url: "https://www.beautifului.dev/",
    description:
      "로딩, 생각 과정, 스트리밍, 승인 카드처럼 AI 화면용 프리미티브를 복사해 쓰는 모음이다.",
    tags: ["Beautiful UI", "에이전트", "프리미티브", "ui"],
  },
  {
    title: "23rd",
    url: "https://23rd.dev/",
    description:
      "셰이더와 배경, 인터랙티브 조각을 React와 Svelte용으로 제공한다. shadcn CLI로 받아 소스를 직접 고친다.",
    tags: ["23rd", "셰이더", "React", "ui"],
  },
  {
    title: "Bencho",
    url: "https://bencho.dev/",
    description:
      "눌러 보고 드래그하는 React 마이크로 인터랙션 모음이다. 블록을 복사해 프로젝트에 바로 넣는다.",
    tags: ["Bencho", "인터랙션", "React", "ui"],
  },
  {
    title: "BoardUI",
    url: "https://www.boardui.com/",
    description:
      "에이전트 화면과 대시보드를 위한 React 디자인 시스템이다. 차트와 컴포넌트를 CLI로 받아 쓴다.",
    tags: ["BoardUI", "에이전트", "React", "ui"],
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

/** 같은 URL의 기존 행을 찾아 저장된 주소를 반환한다. */
export function findExistingUrl(existingRows, item) {
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
      .prepare("SELECT url FROM bookmarks WHERE user_id = ?")
      .all(LOCAL_USER);
    const existing = existingRows.map((row) => row.url);
    const { pending, skippedDup } = filterNewItems(items, existing);
    const insert = db.prepare(`
      INSERT INTO bookmarks
        (id, user_id, url, title, description, image, favicon, tags, category, is_favorite, created_at)
      VALUES (@id, @user_id, @url, @title, @description, @image, @favicon, @tags, @category, @is_favorite, @created_at)
    `);
    const favorite = db.prepare(
      `UPDATE bookmarks SET is_favorite = 1 WHERE user_id = ? AND url = ?`
    );
    const add = db.transaction(() => {
      for (const item of pending) {
        insert.run(
          toRow(item, LOCAL_USER, now, item.image ?? null, item.favicon ?? null)
        );
      }
      for (const item of skippedDup) {
        const existingUrl = findExistingUrl(existingRows, item);
        if (!existingUrl) continue;
        favorite.run(LOCAL_USER, existingUrl);
      }
    });
    add();
    return {
      added: pending.length,
      skippedDup: skippedDup.length,
      favorited: skippedDup.length,
      addedTitles: pending.map((item) => item.title),
      skippedDupTitles: skippedDup.map((item) => item.title),
      favoritedTitles: skippedDup.map((item) => item.title),
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
    .select("url")
    .eq("user_id", PROD_USER);
  if (error) throw error;
  const existingRows = data ?? [];
  const existing = existingRows.map((row) => row.url);
  const { pending, skippedDup } = filterNewItems(items, existing);
  await insertRows(
    sb,
    pending.map((item) =>
      toRow(item, PROD_USER, now, item.image ?? null, item.favicon ?? null)
    )
  );
  for (const item of skippedDup) {
    const existingUrl = findExistingUrl(existingRows, item);
    if (!existingUrl) continue;
    const { error: updateError } = await sb
      .from("bookmarks")
      .update({ is_favorite: 1 })
      .eq("user_id", PROD_USER)
      .eq("url", existingUrl);
    if (updateError) throw updateError;
  }
  return {
    added: pending.length,
    skippedDup: skippedDup.length,
    favorited: skippedDup.length,
    addedTitles: pending.map((item) => item.title),
    skippedDupTitles: skippedDup.map((item) => item.title),
    favoritedTitles: skippedDup.map((item) => item.title),
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
