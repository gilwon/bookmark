// Slashpage ChatGPT 프롬프트 해킹 99개를 Pages에만 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import { documentStats } from "./import-claude-eli5-page.mjs";
import {
  blocksToMarkdown,
  hasNoExpiredUrl,
  isDuplicateRow,
  stripTracking,
} from "./import-slashpage-chatgpt-image-prompts-99.mjs";

export {
  blocksToMarkdown,
  hasNoExpiredUrl,
  isDuplicateRow,
  stripTracking,
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
export const PAGE_TITLE = "ChatGPT 프롬프트 해킹 99개";
export const SOURCE_URL =
  "https://slashpage.com/biggie-ai/3p4kj92yjdq9ym57q1x8";
export const PAGE_HASH = "3p4kj92yjdq9ym57q1x8";
export const EXPECTED_IMAGES = 0;
export const EXPECTED_ATTACHMENTS = 0;
export const EXPECTED_TABLES = 11;
const PAGE_API = `https://slashpage.com/api/page/${PAGE_HASH}`;
const CONTENT_API = `https://slashpage.com/api/page/${PAGE_HASH}/content`;
const REQUIRED_PHRASES = [
  "쓰는 법",
  "01. 화질과 시점",
  "09. 재질과 특수효과",
  "한 번에 두세 개까지만",
  "/35mmfilm",
  "/goldenhour",
  "/softlighting",
  "잘 나오게 하는 요령",
];
const CODE_EXAMPLE =
  "카페 창가에 앉은 20대 여성 /35mmfilm /softlighting /shallowdepth";
const EXPIRED_TRANSFORM_PARTS = ["s=1920x1", "t=outside"];
const FILE_BLOCK_TYPES = new Set(["file", "pdf", "zip", "attachment"]);
const CHROME_PARTS = [
  "slashpageUser/",
  "slashDomainFavicon/",
  "Made with Slashpage",
];

const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const k = match[1].trim();
    let v = match[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

function allBlocks(blockMap) {
  if (!blockMap) return [];
  if (typeof blockMap.values === "function") return [...blockMap.values()];
  return Object.values(blockMap);
}

function countType(blockMap, type) {
  return allBlocks(blockMap).filter((block) => block.type === type).length;
}

function attachmentBlocks(blockMap) {
  return allBlocks(blockMap).filter((block) => FILE_BLOCK_TYPES.has(block.type));
}

function withoutDataUrls(text) {
  return String(text ?? "").replace(/data:[^\s"'<>)]+/gi, "");
}

function buildPageMarkdown(bodyMarkdown) {
  return [`# ${PAGE_TITLE}`, `> 원문. [Slashpage](${SOURCE_URL})`, bodyMarkdown]
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function imageSourcesOf(tiptapJsonString) {
  const sources = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "image") sources.push(String(node.attrs?.src ?? ""));
    for (const child of node.content ?? []) visit(child);
  }
  visit(JSON.parse(tiptapJsonString));
  return sources;
}

function loadLibs() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(
    resolve(root, "src/lib/markdown-to-tiptap.ts")
  );
  const { preparePageFindability, isMissingPageFindabilityColumn } = require(
    resolve(root, "src/lib/page-findability.ts")
  );
  return {
    markdownToTiptapDoc,
    preparePageFindability,
    isMissingPageFindabilityColumn,
  };
}

function assertIntegrity({ markdown, content, stats, blockMap }) {
  if (!markdown.startsWith(`# ${PAGE_TITLE}`)) {
    throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
  }
  if (PAGE_TITLE === "ChatGPT 이미지 프롬프트 99개") {
    throw new Error("다른 Slashpage 글 제목과 섞였습니다.");
  }
  if (PAGE_HASH === "1q3vdn2pdpnk82xy49pr") {
    throw new Error("다른 Slashpage 글 해시와 섞였습니다.");
  }
  if (!markdown.includes(SOURCE_URL)) throw new Error("원문 주소가 없습니다.");
  if (!markdown.includes(`> 원문. [Slashpage](${SOURCE_URL})`)) {
    throw new Error("원문 인용이 없습니다.");
  }
  if (markdown.includes("?post=") || SOURCE_URL.includes("?post=")) {
    throw new Error("리다이렉트 post 쿼리를 저장하면 안 됩니다.");
  }
  if (markdown.includes("fbclid") || SOURCE_URL.includes("fbclid")) {
    throw new Error("fbclid가 남아 있습니다.");
  }
  for (const phrase of REQUIRED_PHRASES) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  if (!markdown.includes(CODE_EXAMPLE)) {
    throw new Error(`코드 예가 없습니다. ${CODE_EXAMPLE}`);
  }
  if (countType(blockMap, "image") !== EXPECTED_IMAGES) {
    throw new Error(`이미지 블록 수가 다릅니다. ${countType(blockMap, "image")}`);
  }
  if (attachmentBlocks(blockMap).length !== EXPECTED_ATTACHMENTS) {
    throw new Error(`첨부 블록 수가 다릅니다. ${attachmentBlocks(blockMap).length}`);
  }
  if (countType(blockMap, "table") !== EXPECTED_TABLES) {
    throw new Error(`표 블록 수가 다릅니다. ${countType(blockMap, "table")}`);
  }
  if (stats.tables !== EXPECTED_TABLES) {
    throw new Error(`TipTap 표 수가 다릅니다. ${stats.tables}`);
  }
  if (stats.images !== EXPECTED_IMAGES) {
    throw new Error(`TipTap 이미지 수가 다릅니다. ${stats.images}`);
  }
  if (stats.attachments !== EXPECTED_ATTACHMENTS) {
    throw new Error(`TipTap 첨부 수가 다릅니다. ${stats.attachments}`);
  }
  const sources = imageSourcesOf(content);
  if (sources.length !== EXPECTED_IMAGES) {
    throw new Error(`본문 이미지 수가 다릅니다. ${sources.length}`);
  }
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(content)) {
    throw new Error("만료 URL이 본문에 남아 있습니다.");
  }
  const plain = `${withoutDataUrls(markdown)}\n${withoutDataUrls(content)}`;
  for (const part of EXPIRED_TRANSFORM_PARTS) {
    if (plain.includes(part)) {
      throw new Error(`변환 URL이 본문에 남아 있습니다. ${part}`);
    }
  }
  if (plain.includes("upload.cafenono.com")) {
    throw new Error("카페노노 이미지 URL이 본문에 남아 있습니다.");
  }
  for (const part of CHROME_PARTS) {
    if (plain.includes(part)) {
      throw new Error(`작성자 크롬 문구가 본문에 있습니다. ${part}`);
    }
  }
}

function sqliteHasFindability(db) {
  const cols = db
    .prepare("PRAGMA table_info(custom_pages)")
    .all()
    .map((c) => c.name);
  return ["tags", "source_url", "search_text", "is_favorite"].every((n) =>
    cols.includes(n)
  );
}

function pageColumns(db) {
  return db
    .prepare("PRAGMA table_info(custom_pages)")
    .all()
    .map((c) => c.name);
}

function markersOf() {
  return [SOURCE_URL, PAGE_HASH];
}

function findLocalPage(db, title, markers) {
  const cols = pageColumns(db);
  const fields = ["id", "title", "content"];
  if (cols.includes("source_url")) fields.push("source_url");
  const select = fields.join(", ");
  const byTitle = db
    .prepare(
      `SELECT ${select} FROM custom_pages WHERE user_id = ? AND title = ?`
    )
    .get(LOCAL_USER, title);
  if (isDuplicateRow(byTitle, title, markers)) return byTitle;
  if (cols.includes("source_url")) {
    for (const marker of markers) {
      if (!marker) continue;
      const row = db
        .prepare(
          `SELECT ${select} FROM custom_pages
           WHERE user_id = ? AND source_url = ?
           LIMIT 1`
        )
        .get(LOCAL_USER, marker);
      if (isDuplicateRow(row, title, markers)) return row;
    }
  }
  for (const marker of markers) {
    if (!marker) continue;
    const row = db
      .prepare(
        `SELECT ${select} FROM custom_pages
         WHERE user_id = ? AND content LIKE ?
         LIMIT 1`
      )
      .get(LOCAL_USER, `%${marker}%`);
    if (isDuplicateRow(row, title, markers)) return row;
  }
  return null;
}

function findabilityOf(libs, page) {
  const found = libs.preparePageFindability({
    title: page.title,
    content: page.content,
    existingSourceUrl: SOURCE_URL,
  });
  return {
    tags: JSON.stringify(found.tags ?? []),
    sourceUrl: found.sourceUrl || SOURCE_URL,
    searchText: found.searchText ?? "",
  };
}

function importLocal(page, markers, libs) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pages: 0, pageUpdates: 0, pageSkips: 0, pageId: page.id };
  const existing = findLocalPage(db, page.title, markers);
  if (existing) {
    result.pageSkips += 1;
    result.pageId = existing.id;
    db.close();
    return result;
  }
  const found = findabilityOf(libs, page);
  if (sqliteHasFindability(db)) {
    db.prepare(
      `INSERT INTO custom_pages (
         id, user_id, title, content, tags, source_url, search_text, is_favorite, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(
      page.id,
      LOCAL_USER,
      page.title,
      page.content,
      found.tags,
      found.sourceUrl,
      found.searchText,
      page.created_at,
      page.updated_at
    );
  } else {
    db.prepare(
      `INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      page.id,
      LOCAL_USER,
      page.title,
      page.content,
      page.created_at,
      page.updated_at
    );
  }
  result.pages += 1;
  db.close();
  return result;
}

function isTimeoutError(error) {
  const message = String(error?.message ?? error ?? "");
  const code = String(error?.code ?? error?.cause?.code ?? "");
  return /timeout|57014|canceling statement/i.test(`${message} ${code}`);
}

async function findProductionPage(supabase, title, sourceUrl) {
  // 운영 content ilike는 큰 JSON에서 57014 statement timeout이 난다.
  const { data, error } = await supabase
    .from("custom_pages")
    .select("id, title")
    .eq("user_id", PROD_USER)
    .eq("title", title)
    .limit(1);
  if (error) throw error;
  if (data?.[0]) return data[0];
  if (!sourceUrl) return null;
  try {
    const bySource = await supabase
      .from("custom_pages")
      .select("id, title")
      .eq("user_id", PROD_USER)
      .eq("source_url", sourceUrl)
      .limit(1);
    if (bySource.error) {
      if (!/source_url/i.test(bySource.error.message)) throw bySource.error;
      return null;
    }
    return bySource.data?.[0] ?? null;
  } catch (error) {
    if (/source_url/i.test(String(error?.message ?? error))) return null;
    throw error;
  }
}

function isMissingFindability(error, libs) {
  const message = String(error?.message ?? error ?? "");
  return (
    libs.isMissingPageFindabilityColumn(message) ||
    /(tags|source_url|search_text|is_favorite)/i.test(message)
  );
}

async function insertViaKodakStub(supabase, full, withFindability) {
  // 대용량 본문은 직접 INSERT하면 statement timeout이 나서 짧은 행을 만든 뒤 갱신한다.
  const stub = JSON.stringify({ type: "doc", content: [] });
  const stubRow = withFindability
    ? { ...full, content: stub }
    : {
        id: full.id,
        user_id: full.user_id,
        title: full.title,
        content: stub,
        created_at: full.created_at,
        updated_at: full.updated_at,
      };
  const { error: insertError } = await supabase.from("custom_pages").insert(stubRow);
  if (insertError) throw insertError;
  const { error: fillError } = await supabase
    .from("custom_pages")
    .update({ content: full.content, updated_at: full.updated_at })
    .eq("id", full.id)
    .eq("user_id", full.user_id);
  if (fillError) throw fillError;
}

async function insertProductionRow(supabase, full, libs) {
  const { error: insertError } = await supabase.from("custom_pages").insert(full);
  if (!insertError) return;
  if (isMissingFindability(insertError, libs)) {
    const slim = {
      id: full.id,
      user_id: full.user_id,
      title: full.title,
      content: full.content,
      created_at: full.created_at,
      updated_at: full.updated_at,
    };
    const { error: retryError } = await supabase.from("custom_pages").insert(slim);
    if (!retryError) return;
    if (isTimeoutError(retryError)) {
      await insertViaKodakStub(supabase, full, false);
      return;
    }
    throw retryError;
  }
  if (isTimeoutError(insertError)) {
    await insertViaKodakStub(supabase, full, true);
    return;
  }
  throw insertError;
}

async function importProduction(page, libs) {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const result = { pages: 0, pageUpdates: 0, pageSkips: 0, pageId: page.id };
  const existing = await findProductionPage(
    supabase,
    page.title,
    page.sourceUrl
  );
  if (existing) {
    result.pageSkips += 1;
    result.pageId = existing.id;
    return result;
  }
  const found = findabilityOf(libs, page);
  const full = {
    id: page.id,
    user_id: PROD_USER,
    title: page.title,
    content: page.content,
    tags: found.tags,
    source_url: found.sourceUrl,
    search_text: found.searchText,
    is_favorite: 0,
    created_at: page.created_at,
    updated_at: page.updated_at,
  };
  await insertProductionRow(supabase, full, libs);
  result.pages += 1;
  return result;
}

async function persist(content, extra, libs) {
  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    title: PAGE_TITLE,
    content,
    sourceUrl: SOURCE_URL,
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record, markersOf(), libs);
  record.id = local.pageId;
  const production = await importProduction(record, libs);
  const pageId = production.pageId || local.pageId;
  return {
    ...extra,
    pageId,
    path: `/pages/${pageId}`,
    local: {
      pages: local.pages,
      pageSkips: local.pageSkips,
    },
    production: {
      pages: production.pages,
      pageSkips: production.pageSkips,
    },
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0",
      referer: "https://slashpage.com/",
    },
  });
  if (!response.ok) {
    throw new Error(`Slashpage HTTP ${response.status}. ${url}`);
  }
  return response.json();
}

function snapshotOf(payload) {
  const data = payload?.data ?? payload;
  const snapshot = data?.snapshot;
  const blockMap = snapshot?.blockMap ?? data?.blockMap;
  const blockTree = snapshot?.blockTree ?? data?.blockTree;
  if (!blockMap || !blockTree) {
    throw new Error("Slashpage snapshot이 없습니다.");
  }
  return { blockMap, blockTree };
}

async function fetchPage() {
  const meta = await fetchJson(PAGE_API);
  const pageTitle = String(
    meta?.data?.title || meta?.data?.note?.title || ""
  ).trim();
  if (pageTitle !== PAGE_TITLE) {
    throw new Error(`페이지 제목이 다릅니다. ${pageTitle}`);
  }
  const payload = await fetchJson(CONTENT_API);
  return snapshotOf(payload);
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const libs = loadLibs();
  const snapshot = await fetchPage();
  const blockMap = snapshot.blockMap;
  const blockTree = snapshot.blockTree;
  const body = blocksToMarkdown(blockTree, blockMap, new Map());
  const markdown = buildPageMarkdown(body);
  const content = JSON.stringify(libs.markdownToTiptapDoc(markdown));
  const stats = documentStats(content);
  assertIntegrity({ markdown, content, stats, blockMap });
  const extra = {
    pageTitle: PAGE_TITLE,
    images: stats.images,
    attachments: stats.attachments,
    tables: stats.tables,
  };
  if (checkOnly) {
    console.log(JSON.stringify(extra, null, 2));
    return;
  }
  const result = await persist(content, extra, libs);
  console.log(JSON.stringify(result, null, 2));
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
