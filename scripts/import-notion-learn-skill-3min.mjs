// 클로드 learn 스킬 3분 가이드를 Pages에만 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import {
  buildMarkdown,
  documentStats,
  plainText,
} from "./import-claude-eli5-page.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
export const NOTION_PAGE_ID = "3e8bc8af-735e-81e2-a399-fc2d47d80b00";
export const NOTION_PAGE_HEX = "3e8bc8af735e81e2a399fc2d47d80b00";
export const SPACE_ID = "e08bc8af-735e-8168-8d34-000335fa9e9d";
export const SOURCE_URL = `https://app.notion.com/p/${NOTION_PAGE_HEX}`;
export const EXPECTED_TITLE =
  "클로드 '학습의 신' 모드 — learn 스킬 켜는 법 (3분)";
export const EXPECTED_ROOT_CHILDREN = 33;
export const EXPECTED_BLOCKS = 38;
export const EXPECTED_IMAGES = 0;
export const EXPECTED_ATTACHMENTS = 0;
export const EXPECTED_TABLES = 0;
export const EXPECTED_CODES = 2;
export const EXPECTED_CALLOUTS = 4;
export const PLACEHOLDERS = [
  "이미지 넣을 자리 — step1_settings.png",
  "이미지 넣을 자리 — step2_find_learn.png",
  "이미지 넣을 자리 — step3_toggle_on.png",
];
export const REQUIRED_PHRASES = [
  "learn 스킬로 가르쳐줘",
  "Anthropic 작성",
  "코드 실행 및 파일 생성",
  "어디서 막혔어요?",
];
export const CONTENT_HREFS = [
  "https://claude.ai",
  "https://turnflow.link/@use-ai-likejimin",
];
const RAW_HREFS = [
  "http://claude.ai",
  "https://turnflow.link/@use-ai-likejimin",
];
const NOTION_ENDPOINT = "https://www.notion.so/api/v3/loadPageChunk";
const SYNC_ENDPOINT = "https://www.notion.so/api/v3/syncRecordValues";
const REQUEST_GAP_MS = 1500;
const RETRY_WAITS_MS = [30000, 60000];
const SYNC_BATCH = 50;
const EXPIRED_URL_PARTS = [
  "prod-files-secure",
  "X-Amz",
  "file.notion.so",
  "fbclid",
  "source=copy_link",
];
const FORBIDDEN_TYPES = ["image", "file", "pdf", "video", "table"];
let lastRequestAt = 0;

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

const pause = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

/** 유입 추적 쿼리를 빼고 http는 https로 바꾼다. */
export function stripTracking(url, base) {
  if (!url) return url;
  if (String(url).startsWith("data:")) return url;
  try {
    const parsed = new URL(url, base);
    if (parsed.protocol === "http:") parsed.protocol = "https:";
    for (const key of [...parsed.searchParams.keys()]) {
      const value = parsed.searchParams.get(key);
      if (
        key.startsWith("utm_") ||
        key === "fbclid" ||
        key === "pvs" ||
        key === "mcp_token" ||
        (key === "source" && value === "copy_link")
      ) {
        parsed.searchParams.delete(key);
      }
    }
    if ([...parsed.searchParams.keys()].length === 0) parsed.search = "";
    const source = String(url);
    const hadTrailingSlash = source.split(/[?#]/, 1)[0].endsWith("/");
    if (parsed.pathname === "/" && !hadTrailingSlash) {
      return `${parsed.origin}${parsed.search}${parsed.hash}`;
    }
    return parsed.href;
  } catch {
    return String(url)
      .replace(/^http:\/\//i, "https://")
      .replace(/[?&](?:utm_[^=&#]*|fbclid|pvs|mcp_token)=[^&\s)#]*/g, "")
      .replace(/[?&]source=copy_link/g, "")
      .replace(/[?&]$/, "")
      .replace(/\?&/, "?");
  }
}

/** data URL을 지운 뒤에 만료 URL 조각이 없으면 true다. */
export function hasNoExpiredUrl(text) {
  const value = String(text ?? "").replace(
    /data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi,
    ""
  );
  return EXPIRED_URL_PARTS.every((part) => !value.includes(part));
}

/** 제목이 같거나 source_url에 hex가 있으면 중복이다. 본문만 같으면 중복이 아니다. */
export function isDuplicateRow(row, title, hex) {
  if (!row) return false;
  if (title && row.title === title) return true;
  const source = String(row.source_url ?? "");
  return Boolean(hex && source.includes(hex));
}

function getBlock(blocks, id) {
  if (!blocks || id == null) return null;
  if (typeof blocks.get === "function") return blocks.get(id) ?? null;
  return blocks[id] ?? null;
}

/** 대상 페이지와 자손만 남긴다. 자손 page 안은 따라가지 않는다. */
export function scopeBlocks(blocks, pageId) {
  const scoped = new Map();
  const rootBlock = getBlock(blocks, pageId);
  if (!rootBlock) return scoped;
  const visit = (block, isRoot) => {
    if (!block?.id || scoped.has(block.id)) return;
    scoped.set(block.id, block);
    if (!isRoot && block.type === "page") return;
    for (const childId of block.content ?? []) {
      const child = getBlock(blocks, childId);
      if (child) visit(child, false);
    }
  };
  visit(rootBlock, true);
  return scoped;
}

function blockFromRecord(record) {
  const nested = record?.value?.value;
  if (nested && typeof nested === "object" && nested.type) return nested;
  const value = record?.value;
  if (value && typeof value === "object" && value.type) return value;
  return null;
}

function rewriteRichText(value) {
  if (!Array.isArray(value)) return;
  for (const fragment of value) {
    if (!Array.isArray(fragment) || !Array.isArray(fragment[1])) continue;
    for (const mark of fragment[1]) {
      if (Array.isArray(mark) && mark[0] === "a" && typeof mark[1] === "string") {
        mark[1] = stripTracking(mark[1]);
      }
    }
  }
}

/** 렌더 전에 본문 링크를 정리한다. 콜아웃 자리 표시 글은 지우지 않는다. */
export function preprocessBlocks(blocks) {
  for (const block of blocks.values()) {
    const properties = block.properties;
    if (!properties) continue;
    for (const value of Object.values(properties)) rewriteRichText(value);
  }
}

function linkHrefs(blocks) {
  const hrefs = [];
  for (const block of blocks.values()) {
    const title = block.properties?.title;
    if (!Array.isArray(title)) continue;
    for (const fragment of title) {
      if (!Array.isArray(fragment?.[1])) continue;
      for (const mark of fragment[1]) {
        if (Array.isArray(mark) && mark[0] === "a" && typeof mark[1] === "string") {
          hrefs.push(mark[1]);
        }
      }
    }
  }
  return hrefs;
}

function countType(blocks, type) {
  let count = 0;
  for (const block of blocks.values()) {
    if (block.type === type) count += 1;
  }
  return count;
}

function plainBody(blocks) {
  const parts = [];
  for (const block of blocks.values()) {
    parts.push(plainText(block.properties?.title));
  }
  return parts.join("\n");
}

function sameList(left, right) {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function missingChildCount(blocks, pageId) {
  let missing = 0;
  for (const block of blocks.values()) {
    if (block.type === "page" && block.id !== pageId) continue;
    for (const childId of block.content ?? []) {
      if (!blocks.has(childId)) missing += 1;
    }
  }
  return missing;
}

function assertShape(blocks) {
  const page = blocks.get(NOTION_PAGE_ID);
  if (!page) throw new Error("Notion 페이지를 찾지 못했습니다.");
  const title = plainText(page.properties?.title).trim();
  if (title !== EXPECTED_TITLE) throw new Error(`페이지 제목이 다릅니다. ${title}`);
  if ((page.content ?? []).length !== EXPECTED_ROOT_CHILDREN) {
    throw new Error(`루트 자식 수가 33이 아닙니다. ${(page.content ?? []).length}`);
  }
  if (blocks.size !== EXPECTED_BLOCKS) {
    throw new Error(`블록 수가 38이 아닙니다. ${blocks.size}`);
  }
  if (missingChildCount(blocks, NOTION_PAGE_ID) !== 0) {
    throw new Error("빠진 자식 블록이 있습니다.");
  }
  for (const type of FORBIDDEN_TYPES) {
    const count = countType(blocks, type);
    if (count !== 0) throw new Error(`${type} 블록이 있습니다. ${count}`);
  }
  if (countType(blocks, "code") !== EXPECTED_CODES) {
    throw new Error(`코드 블록 수가 2가 아닙니다. ${countType(blocks, "code")}`);
  }
  if (countType(blocks, "callout") !== EXPECTED_CALLOUTS) {
    throw new Error(`콜아웃 수가 4가 아닙니다. ${countType(blocks, "callout")}`);
  }
  const body = plainBody(blocks);
  for (const line of PLACEHOLDERS) {
    if (!body.includes(line)) throw new Error(`자리 표시가 없습니다. ${line}`);
  }
  for (const phrase of REQUIRED_PHRASES) {
    if (!body.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  if (!sameList(linkHrefs(blocks), RAW_HREFS)) {
    throw new Error(`원문 링크가 기대와 다릅니다. ${linkHrefs(blocks).join(" ")}`);
  }
}

function assertRendered(markdown, content, stats) {
  if (!markdown.startsWith(`# ${EXPECTED_TITLE}`)) {
    throw new Error("마크다운 제목이 Notion 제목과 다릅니다.");
  }
  if (!markdown.includes(SOURCE_URL) || !markdown.includes(NOTION_PAGE_HEX)) {
    throw new Error("원문 주소가 없습니다.");
  }
  for (const line of PLACEHOLDERS) {
    if (!markdown.includes(line) || !content.includes(line)) {
      throw new Error(`자리 표시가 본문에서 빠졌습니다. ${line}`);
    }
  }
  for (const phrase of REQUIRED_PHRASES) {
    if (!markdown.includes(phrase) || !content.includes(phrase)) {
      throw new Error(`문구가 본문에서 빠졌습니다. ${phrase}`);
    }
  }
  const expectedHrefs = [SOURCE_URL, ...CONTENT_HREFS];
  if (stats.hrefs.length !== expectedHrefs.length || !sameList(stats.hrefs, expectedHrefs)) {
    throw new Error(`링크가 기대와 다릅니다. ${stats.hrefs.join(" ")}`);
  }
  if (stats.images !== EXPECTED_IMAGES) {
    throw new Error(`이미지 수가 0이 아닙니다. ${stats.images}`);
  }
  if (stats.attachments !== EXPECTED_ATTACHMENTS) {
    throw new Error(`첨부 수가 0이 아닙니다. ${stats.attachments}`);
  }
  if (stats.tables !== EXPECTED_TABLES) {
    throw new Error(`표 수가 0이 아닙니다. ${stats.tables}`);
  }
  if (stats.codes !== EXPECTED_CODES) {
    throw new Error(`코드 수가 2가 아닙니다. ${stats.codes}`);
  }
  if (stats.callouts !== EXPECTED_CALLOUTS) {
    throw new Error(`콜아웃 수가 4가 아닙니다. ${stats.callouts}`);
  }
  if (markdown.includes("http://") || content.includes("http://")) {
    throw new Error("http 링크가 남아 있습니다.");
  }
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(content)) {
    throw new Error("만료 URL이 본문에 남아 있습니다.");
  }
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

async function waitGap() {
  if (!lastRequestAt) return;
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < REQUEST_GAP_MS) await pause(REQUEST_GAP_MS - elapsed);
}

async function pacedFetch(url, options = {}) {
  for (let attempt = 0; attempt <= RETRY_WAITS_MS.length; attempt += 1) {
    if (attempt > 0) await pause(RETRY_WAITS_MS[attempt - 1]);
    await waitGap();
    const response = await fetch(url, {
      ...options,
      signal: options.signal ?? AbortSignal.timeout(90000),
    });
    lastRequestAt = Date.now();
    if (response.status !== 429 || attempt === RETRY_WAITS_MS.length) return response;
  }
  throw new Error("Notion 요청 실패.");
}

async function requestJson(endpoint, body) {
  const response = await pacedFetch(endpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0",
    },
    body: JSON.stringify(body),
  });
  if (response.ok) return response.json();
  const message = await response.text();
  throw new Error(`Notion HTTP ${response.status}. ${message.slice(0, 180)}`);
}

async function requestChunk(id, cursor = { stack: [] }, chunkNumber = 0) {
  return requestJson(NOTION_ENDPOINT, {
    pageId: id,
    limit: 100,
    cursor,
    chunkNumber,
    verticalColumns: false,
  });
}

function absorbChunk(blocks, chunk) {
  for (const [id, record] of Object.entries(chunk.recordMap?.block ?? {})) {
    const block = blockFromRecord(record);
    if (block?.type) blocks.set(id, { ...block, id: block.id || id });
  }
}

function missingIds(blocks, fetched, pageId) {
  const ids = [];
  const seen = new Set();
  const walk = (block, isRoot) => {
    if (!block?.id || seen.has(block.id)) return;
    seen.add(block.id);
    if (!isRoot && block.type === "page") return;
    for (const childId of block.content ?? []) {
      const child = blocks.get(childId);
      if (!child) {
        if (!fetched.has(childId)) ids.push(childId);
        continue;
      }
      walk(child, false);
    }
  };
  const page = blocks.get(pageId);
  if (page) walk(page, true);
  return ids;
}

async function syncBlocks(ids) {
  return requestJson(SYNC_ENDPOINT, {
    requests: ids.map((id) => ({
      pointer: { table: "block", id },
      version: -1,
    })),
  });
}

async function collectBlocks(pageId) {
  const blocks = new Map();
  let cursor = { stack: [] };
  let chunkNumber = 0;
  do {
    const chunk = await requestChunk(pageId, cursor, chunkNumber);
    absorbChunk(blocks, chunk);
    cursor = chunk.cursor ?? { stack: [] };
    chunkNumber += 1;
    if (chunkNumber > 5) throw new Error("페이지 청크 한도를 넘었습니다.");
  } while (cursor.stack?.length);

  const fetched = new Set();
  let guard = 0;
  let missing = missingIds(blocks, fetched, pageId);
  while (missing.length) {
    if (guard++ > 8) throw new Error("블록 수집 한도를 넘었습니다.");
    const batch = missing.slice(0, SYNC_BATCH);
    for (const id of batch) fetched.add(id);
    absorbChunk(blocks, await syncBlocks(batch));
    missing = missingIds(blocks, fetched, pageId);
  }
  return scopeBlocks(blocks, pageId);
}

function sqliteHasFindability(db) {
  const names = db
    .prepare("PRAGMA table_info(custom_pages)")
    .all()
    .map((column) => column.name);
  return ["tags", "source_url", "search_text", "is_favorite"].every((name) =>
    names.includes(name)
  );
}

function pageColumns(db) {
  return db
    .prepare("PRAGMA table_info(custom_pages)")
    .all()
    .map((column) => column.name);
}

function findLocalPage(db, title, hex) {
  const columns = pageColumns(db);
  const fields = ["id", "title"];
  if (columns.includes("source_url")) fields.push("source_url");
  const select = fields.join(", ");
  const byTitle = db
    .prepare(
      `SELECT ${select} FROM custom_pages WHERE user_id = ? AND title = ? LIMIT 1`
    )
    .get(LOCAL_USER, title);
  if (isDuplicateRow(byTitle, title, hex)) return byTitle;
  if (columns.includes("source_url") && hex) {
    const bySource = db
      .prepare(
        `SELECT ${select} FROM custom_pages
         WHERE user_id = ? AND source_url IS NOT NULL AND instr(source_url, ?) > 0
         LIMIT 1`
      )
      .get(LOCAL_USER, hex);
    if (isDuplicateRow(bySource, bySource?.title, hex)) return bySource;
  }
  return null;
}

function findabilityOf(libs, page) {
  const found = libs.preparePageFindability({
    title: page.title,
    content: page.content,
    existingSourceUrl: page.sourceUrl,
  });
  return {
    tags: JSON.stringify(found.tags ?? []),
    sourceUrl: found.sourceUrl || page.sourceUrl,
    searchText: found.searchText ?? "",
  };
}

function importLocal(page, title, hex, libs) {
  const db = new Database(resolve(root, "data/mymark.db"));
  db.pragma("busy_timeout = 5000");
  try {
    const existing = findLocalPage(db, title, hex);
    if (existing) return { action: "skip", pageId: existing.id };
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
    return { action: "insert", pageId: page.id };
  } finally {
    db.close();
  }
}

function createSupabase() {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

async function findProductionPage(supabase, title, hex) {
  const { data, error } = await supabase
    .from("custom_pages")
    .select("id, title, source_url")
    .eq("user_id", PROD_USER)
    .eq("title", title)
    .limit(1);
  if (error) throw error;
  if (isDuplicateRow(data?.[0], title, hex)) return data[0];
  if (!hex) return null;
  const bySource = await supabase
    .from("custom_pages")
    .select("id, title, source_url")
    .eq("user_id", PROD_USER)
    .like("source_url", `%${hex}%`)
    .limit(1);
  if (bySource.error) {
    if (/source_url/i.test(bySource.error.message)) return null;
    throw bySource.error;
  }
  return bySource.data?.[0] ?? null;
}

async function importProduction(page, title, hex, libs, supabase) {
  const existing = await findProductionPage(supabase, title, hex);
  if (existing) return { action: "skip", pageId: existing.id };
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
  const { error: insertError } = await supabase.from("custom_pages").insert(full);
  if (insertError) {
    const missing =
      libs.isMissingPageFindabilityColumn(insertError.message) ||
      /(tags|source_url|search_text|is_favorite)/i.test(insertError.message);
    if (!missing) throw insertError;
    const { error: retryError } = await supabase.from("custom_pages").insert({
      id: page.id,
      user_id: PROD_USER,
      title: page.title,
      content: page.content,
      created_at: page.created_at,
      updated_at: page.updated_at,
    });
    if (retryError) throw retryError;
  }
  return { action: "insert", pageId: page.id };
}

function openFindLocal(title, hex) {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  db.pragma("busy_timeout = 5000");
  try {
    return findLocalPage(db, title, hex);
  } finally {
    db.close();
  }
}

async function buildPage(libs) {
  const blocks = await collectBlocks(NOTION_PAGE_ID);
  assertShape(blocks);
  preprocessBlocks(blocks);
  if (!sameList(linkHrefs(blocks), CONTENT_HREFS)) {
    throw new Error(`정리한 링크가 기대와 다릅니다. ${linkHrefs(blocks).join(" ")}`);
  }
  const built = buildMarkdown(blocks, NOTION_PAGE_ID, SOURCE_URL);
  if (built.pageTitle !== EXPECTED_TITLE) {
    throw new Error("마크다운 제목이 Notion 제목과 다릅니다.");
  }
  const content = JSON.stringify(libs.markdownToTiptapDoc(built.markdown));
  const stats = documentStats(content);
  assertRendered(built.markdown, content, stats);
  return {
    title: EXPECTED_TITLE,
    sourceUrl: SOURCE_URL,
    content,
    stats,
  };
}

async function main() {
  const libs = loadLibs();
  const supabase = createSupabase();
  const localExisting = openFindLocal(EXPECTED_TITLE, NOTION_PAGE_HEX);
  const productionExisting = await findProductionPage(
    supabase,
    EXPECTED_TITLE,
    NOTION_PAGE_HEX
  );
  if (localExisting && productionExisting) {
    console.log(
      JSON.stringify({
        local: "skip",
        production: "skip",
        pageId: localExisting.id,
        productionPageId: productionExisting.id,
      })
    );
    return;
  }
  const built = await buildPage(libs);
  const now = new Date().toISOString();
  const record = {
    id: localExisting?.id || productionExisting?.id || randomUUID(),
    title: built.title,
    content: built.content,
    sourceUrl: built.sourceUrl,
    created_at: now,
    updated_at: now,
  };
  const local = localExisting
    ? { action: "skip", pageId: localExisting.id }
    : importLocal(record, EXPECTED_TITLE, NOTION_PAGE_HEX, libs);
  record.id = local.pageId || record.id;
  const production = productionExisting
    ? { action: "skip", pageId: productionExisting.id }
    : await importProduction(record, EXPECTED_TITLE, NOTION_PAGE_HEX, libs, supabase);
  console.log(
    JSON.stringify({
      local: local.action,
      production: production.action,
      pageId: production.pageId || local.pageId,
      images: built.stats.images,
      attachments: built.stats.attachments,
      tables: built.stats.tables,
      codes: built.stats.codes,
      callouts: built.stats.callouts,
      links: CONTENT_HREFS.length,
      hrefs: built.stats.hrefs,
    })
  );
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
