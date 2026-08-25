// 82studio 디자인 참고 사이트 모음을 bookmarks 디자인 카테고리에 저장한다
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

export const SPACE_ID = "a3d6c679-d11c-8103-8979-0003ba336b39";
export const SOURCE_COLLECTION_ID = "3446c679-d11c-81cb-a895-000b3f4e5ded";
export const VIEW_ID = "3446c679-d11c-8128-a49e-000c799daa7b";
export const CATEGORY = "디자인";
export const LOCAL_USER = "dev";
export const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
export const QUERY_COLLECTION_URL = "https://www.notion.so/api/v3/queryCollection";

const PROP_URL = "f:Bt";
const PROP_DESC = "jIRe";
const PROP_KIND = "dN]{";
const PROP_DETAILS = "PN}D";
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

/** Notion 속성에서 첫 번째 평문만 꺼낸다. 중첩 링크 주석은 이어붙이지 않는다. */
export function firstPlain(prop) {
  if (!Array.isArray(prop) || prop.length === 0) return "";
  const seg = prop[0];
  if (typeof seg === "string") return seg.trim();
  if (Array.isArray(seg) && typeof seg[0] === "string") {
    return String(seg[0]).trim();
  }
  return "";
}

export function notionUrl(prop) {
  return firstPlain(prop);
}

export function shouldSkipItem({ url, title } = {}) {
  const name = String(title ?? "").trim();
  if (name.includes("[이제만들시간]")) return true;
  if (!String(url ?? "").trim()) return true;
  return false;
}

function inferTagsFromDescription(description) {
  const text = String(description ?? "");
  if (!text.trim()) return [];
  const rules = [
    [/애니메이션/, "애니메이션"],
    [/컴포넌트/, "컴포넌트"],
    [/오픈소스/, "오픈소스"],
    [/3D/, "3D"],
    [/바이브\s*디자인/, "바이브디자인"],
    [/바이브코딩/, "바이브코딩"],
    [/이즘/, "스타일"],
    [/템플릿/, "템플릿"],
    [/인터렉티프|인터랙티프|인터랙션|인터렉션/, "인터랙션"],
    [/전환/, "전환"],
    [/모션/, "모션"],
    [/마케팅|CTA/, "마케팅"],
    [/피그마/, "피그마"],
    [/\bUI\b/, "UI"],
    [/앱/, "앱"],
    [/무료/, "무료"],
  ];
  const hits = [];
  const seen = new Set();
  for (const [re, tag] of rules) {
    if (!re.test(text) || seen.has(tag)) continue;
    seen.add(tag);
    hits.push(tag);
    if (hits.length >= 3) break;
  }
  return hits;
}

export function buildTags({ kind, details, description } = {}) {
  const tags = [];
  const seen = new Set();
  const add = (raw) => {
    const tag = String(raw ?? "").trim();
    if (!tag) return;
    if (tag === CATEGORY) return;
    const key = tag.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    tags.push(tag);
  };

  const detailText = String(details ?? "");
  for (const part of detailText.split(",")) add(part);
  if (kind && kind !== CATEGORY) add(kind);
  if (!detailText.trim()) {
    for (const inferred of inferTagsFromDescription(description)) add(inferred);
  }
  return tags.slice(0, 6);
}

export function unwrapBlock(entry) {
  if (!entry || typeof entry !== "object") return null;
  const outer = entry.value;
  if (
    outer &&
    typeof outer === "object" &&
    outer.value &&
    typeof outer.value === "object" &&
    ("type" in outer.value || "properties" in outer.value)
  ) {
    return outer.value;
  }
  if (outer && typeof outer === "object" && (outer.type || outer.properties)) {
    return outer;
  }
  if (entry.type || entry.properties) return entry;
  return null;
}

export function parseCollection(payload) {
  const recordMap = payload?.recordMap ?? payload ?? {};
  const blocks = recordMap.block ?? {};
  const blockIds =
    payload?.result?.reducerResults?.collection_group_results?.blockIds ??
    Object.keys(blocks);
  const items = [];
  const skippedNoUrl = [];
  for (const id of blockIds) {
    const value = unwrapBlock(blocks[id]);
    if (!value || value.type !== "page") continue;
    const props = value.properties ?? {};
    const title = firstPlain(props.title);
    const url = notionUrl(props[PROP_URL]);
    const description = firstPlain(props[PROP_DESC]) || null;
    const kind = firstPlain(props[PROP_KIND]);
    const details = firstPlain(props[PROP_DETAILS]);
    if (String(title).includes("[이제만들시간]")) continue;
    if (!url) {
      skippedNoUrl.push({ title, url: "" });
      continue;
    }
    items.push({
      title,
      url,
      description,
      kind,
      details,
      tags: buildTags({ kind, details, description }),
    });
  }
  return { items, skippedNoUrl };
}

export function filterNewItems(items, existingUrls) {
  const pending = [];
  const skippedDup = [];
  const pool = [...existingUrls];
  for (const item of items) {
    if (pool.some((url) => isSameBookmarkUrl(url, item.url))) {
      skippedDup.push(item);
      continue;
    }
    pending.push(item);
    pool.push(item.url);
  }
  return { pending, skippedDup };
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

async function queryCollection() {
  const res = await fetch(QUERY_COLLECTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    },
    body: JSON.stringify({
      collection: { id: SOURCE_COLLECTION_ID, spaceId: SPACE_ID },
      collectionView: { id: VIEW_ID, spaceId: SPACE_ID },
      loader: {
        reducers: {
          collection_group_results: { type: "results", limit: 200 },
        },
        searchQuery: "",
        userTimeZone: "Asia/Seoul",
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`queryCollection 실패 ${res.status}`);
  }
  return res.json();
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
    const existing = db
      .prepare("SELECT url FROM bookmarks WHERE user_id = ?")
      .all(LOCAL_USER)
      .map((row) => row.url);
    const { pending, skippedDup } = filterNewItems(items, existing);
    const insert = db.prepare(`
      INSERT INTO bookmarks
        (id, user_id, url, title, description, image, favicon, tags, category, is_favorite, created_at)
      VALUES (@id, @user_id, @url, @title, @description, @image, @favicon, @tags, @category, @is_favorite, @created_at)
    `);
    const add = db.transaction(() => {
      for (const item of pending) {
        insert.run(
          toRow(item, LOCAL_USER, now, item.image ?? null, item.favicon ?? null)
        );
      }
    });
    add();
    return {
      added: pending.length,
      skippedDup: skippedDup.length,
      addedTitles: pending.map((item) => item.title),
      skippedDupTitles: skippedDup.map((item) => item.title),
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
  const chunkSize = 8;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error: chunkError } = await sb.from("bookmarks").insert(chunk);
    if (!chunkError) continue;
    for (const row of chunk) {
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
  const existing = (data ?? []).map((row) => row.url);
  const { pending, skippedDup } = filterNewItems(items, existing);
  await insertRows(
    sb,
    pending.map((item) =>
      toRow(item, PROD_USER, now, item.image ?? null, item.favicon ?? null)
    )
  );
  return {
    added: pending.length,
    skippedDup: skippedDup.length,
    addedTitles: pending.map((item) => item.title),
    skippedDupTitles: skippedDup.map((item) => item.title),
  };
}

export async function main(argv = process.argv.slice(2)) {
  const checkOnly = argv.includes("--check");
  const payload = await queryCollection();
  const { items, skippedNoUrl } = parseCollection(payload);
  if (checkOnly) {
    const summary = {
      withUrl: items.length,
      skipNoUrl: skippedNoUrl.length,
      skipNoUrlTitles: skippedNoUrl.map((item) => item.title),
      items: items.map((item) => ({
        title: item.title,
        url: item.url,
        description: item.description,
        tags: item.tags,
      })),
    };
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  }

  const enriched = await attachMeta(items);
  const now = new Date().toISOString();
  const local = insertLocal(enriched, now);
  const production = await insertProduction(enriched, now);
  const summary = {
    withUrl: items.length,
    skipNoUrl: skippedNoUrl.length,
    skipNoUrlTitles: skippedNoUrl.map((item) => item.title),
    local,
    production,
  };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
