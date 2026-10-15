// 웹디자인 참고 사이트 14곳을 bookmarks 디자인 카테고리에 저장한다
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

const REFERENCE_NOTE =
  "참고 사이트의 화면을 그대로 복제하는 것과 무료 코드를 활용하는 건 달라요. 특히 다른 회사의 이미지, 로고, 폰트는 별도 저작권이 있을 수 있으니 상업적 프로젝트에서는 사용 조건을 확인하세요.";

export const ITEMS = [
  {
    title: "Minimal Gallery",
    url: "https://minimal.gallery/",
    description: `깔끔하고 세련된 웹사이트 디자인 모음입니다. ${REFERENCE_NOTE}`,
    tags: ["Minimal Gallery", "갤러리", "미니멀"],
  },
  {
    title: "Kage",
    url: "https://kage.design/",
    description: `실제 웹사이트의 UI를 살펴보고 AI 프롬프트로 활용합니다. ${REFERENCE_NOTE}`,
    tags: ["Kage", "프롬프트", "ui"],
  },
  {
    title: "Refero Styles",
    url: "https://styles.refero.design/",
    description: `2,000개 이상의 디자인 스타일과 DESIGN.md를 참고합니다. ${REFERENCE_NOTE}`,
    tags: ["Refero", "스타일", "DESIGN.md"],
  },
  {
    title: "Component Gallery",
    url: "https://component.gallery/",
    description: `2,600개 이상의 UI 컴포넌트 사례입니다. ${REFERENCE_NOTE}`,
    tags: ["컴포넌트", "ui"],
  },
  {
    title: "AppShot Gallery",
    url: "https://www.appshot.gallery/",
    description: `실제 모바일 앱의 화면 디자인을 참고합니다. ${REFERENCE_NOTE}`,
    tags: ["AppShot", "모바일", "앱"],
  },
  {
    title: "DESIGN.md",
    url: "https://designmd.ai/",
    description: "AI 코딩 도구에서 사용할 무료 디자인 시스템입니다.",
    tags: ["DESIGN.md", "디자인시스템", "AI"],
  },
  {
    title: "VibePrompts",
    url: "https://vibeprompts.dev/",
    description: "랜딩 페이지, 대시보드 등 UI 제작 프롬프트입니다.",
    tags: ["프롬프트", "랜딩"],
  },
  {
    title: "21st.dev",
    url: "https://21st.dev/",
    description:
      "React UI 컴포넌트 라이브러리입니다. 무료 계정은 하루 2개 복사할 수 있습니다.",
    tags: ["21st", "컴포넌트", "ui"],
  },
  {
    title: "Kinetics",
    url: "https://kinetics.colorion.co/",
    description: "153가지 모션 효과와 CSS·React 코드입니다.",
    tags: ["Kinetics", "모션", "CSS"],
  },
  {
    title: "Circle Loaders",
    url: "https://circleloaders.dominikakissi.com/",
    description: "24가지 로딩 애니메이션과 SVG 코드입니다.",
    tags: ["로딩", "SVG"],
  },
  {
    title: "Gradient Buttons",
    url: "https://gradientbuttons.colorion.co/",
    description: "다양한 그라데이션 버튼 CSS 코드입니다.",
    tags: ["버튼", "CSS"],
  },
  {
    title: "Anime.js",
    url: "https://animejs.com/",
    description: "텍스트·SVG·스크롤 애니메이션 라이브러리입니다.",
    tags: ["Anime.js", "애니메이션", "SVG"],
  },
  {
    title: "Kitbitz",
    url: "https://kitbitz.art/",
    description:
      "2,000개 이상의 손그림 일러스트입니다. CC0 라이선스라 상업적으로 사용할 수 있습니다.",
    tags: ["일러스트", "CC0"],
  },
  {
    title: "3dicons",
    url: "https://3dicons.co/",
    description:
      "무료 3D 아이콘 라이브러리입니다. CC0 라이선스라 상업적으로 사용할 수 있습니다.",
    tags: ["아이콘", "3D", "CC0"],
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
