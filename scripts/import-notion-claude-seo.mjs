// GILWON 이번 주 Claude SEO 설치 정리본을 Pages에만 저장한다.
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import { buildMarkdown, documentStats, imageMime, plainText } from "./import-claude-eli5-page.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const NOTION_ENDPOINT = "https://www.notion.so/api/v3/loadPageChunk";
const COOKIE_RELATIVE = "tmp/notion-kst-20260920/cookies.txt";
const TRACKING_KEY = ["fb", "clid"].join("");
const EXPIRED_URL_PARTS = ["prod-files-secure", "file.notion.so", "expirationTimestamp", "X-Amz", "blob:"];

export const PAGE_ID = "f94b2568-27ac-8321-a4cd-016dff13ec55";
export const SOURCE_URL = "https://app.notion.com/p/f94b256827ac8321a4cd016dff13ec55";
export const PAGE_TITLE = "Claude SEO 설치·첫 점검 정리본 — 댓글 트리거 'SEO' DM본 (2026-10-29)";
export const REQUIRED_HREFS = [
  SOURCE_URL,
  // URL 파서가 경로 없는 호스트에 슬래시를 붙인다.
  "https://aiinsight.kr/",
  "https://open.kakao.com/o/gjYQmOLh",
  "https://github.com/AgriciDaniel/claude-seo",
  "https://www.youtube.com/watch?v=COMnNlUakQk",
  "https://agricidaniel.com/about",
];
export const EXPECTED = { images: 2, attachments: 0, tables: 0, codes: 3, rules: 1 };
export const EXPECTED_IMAGES = [
  {
    file: "aiinsight_home_banner.jpg",
    caption: "AI인사이트 홈페이지",
    bytes: 317972,
    sha256: "9f08e46de4b7049c9a04a4ba404fcdaca166c27e30f0fefb2fa9f37555badbea",
  },
  {
    file: "aiinsight_kakao_banner.jpg",
    caption: "AI인사이트 카카오톡 단톡방",
    bytes: 213218,
    sha256: "7f28091c89edea30383f14e1a707a0eeab7d54b71e88b5c57c8dcc46958c4fb1",
  },
];
const REQUIRED_PHRASES = [
  "1. 무엇을 해 주나요",
  "3. 설치 3줄 (Claude Code 안에서 입력)",
  "공식 링크",
  "/plugin marketplace add AgriciDaniel/claude-seo",
  "/plugin install claude-seo@agricidaniel-claude-seo",
  "/seo setup",
  "/seo audit https://내사이트주소",
  "/plugin uninstall claude-seo@agricidaniel-claude-seo",
];

let lastRequestAt = 0;
let cachedCookie;

function loadEnv() {
  const envPath = resolve(root, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[match[1].trim()]) process.env[match[1].trim()] = value;
  }
}

const pause = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));

function dropsXShareQuery(hostname) {
  const host = String(hostname ?? "").toLowerCase();
  return host === "x.com" || host === "twitter.com" || host.endsWith(".x.com") || host.endsWith(".twitter.com");
}

function isTrackingParam(key, value, hostname) {
  return (
    key.startsWith("utm_") ||
    key === TRACKING_KEY ||
    key === "pvs" ||
    key === "igsh" ||
    key === "gclid" ||
    key === "mcp_token" ||
    (key === "source" && value === "copy_link") ||
    (key === "m" && value === "1") ||
    (key === "from" && ["dm", "littly", "guide"].includes(value)) ||
    (key === "s" && dropsXShareQuery(hostname))
  );
}

/** 유입 추적 쿼리를 빼고 http는 https로 바꾼다. localhost는 http로 남긴다. */
export function stripTracking(url, base = SOURCE_URL) {
  if (!url || String(url).startsWith("data:") || String(url).startsWith("mailto:")) return url;
  try {
    const parsed = new URL(url, base);
    if (parsed.hostname === "l.threads.com") {
      const target = parsed.searchParams.get("u");
      if (target) return stripTracking(target, base);
    }
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol === "http:" && !local) parsed.protocol = "https:";
    if (parsed.hostname === "instagram.com" || parsed.hostname === "www.instagram.com") {
      parsed.hostname = "www.instagram.com";
      if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    }
    for (const key of [...parsed.searchParams.keys()]) {
      if (isTrackingParam(key, parsed.searchParams.get(key), parsed.hostname)) parsed.searchParams.delete(key);
    }
    if ([...parsed.searchParams.keys()].length === 0) parsed.search = "";
    parsed.hash = "";
    return parsed.href;
  } catch {
    return String(url);
  }
}

/** 코드 울타리와 인라인 코드 밖의 실제 주소를 링크로 만든다. */
export function autolinkBareUrls(markdown) {
  const parts = String(markdown).split(/(```[\s\S]*?```)/);
  return parts
    .map((part) => {
      if (part.startsWith("```")) return part;
      return part.replace(
        /(`[^`]*`)|(!?\[[^\]]*]\([^)]*\))|(https?:\/\/[^\s)<]+)/g,
        (match, code, linked, bare) => {
          if (code || linked || !bare || bare.includes("내사이트주소")) return match;
          const cleaned = stripTracking(bare);
          return `[${cleaned}](${cleaned})`;
        },
      );
    })
    .join("");
}

/** 제목 또는 원문 주소가 같으면 중복이다. 본문 언급은 중복이 아니다. */
export function isDuplicateRow(row, title, markers) {
  if (!row) return false;
  if (row.title === title) return true;
  const raw = String(row.source_url || "").trim();
  if (!raw) return false;
  const source = stripTracking(raw).replace(/\/+$/, "");
  return markers.some((marker) => source === stripTracking(marker).replace(/\/+$/, ""));
}

function sourceOf(block) {
  return plainText(block?.properties?.source) || block?.format?.display_source || block?.format?.original_url || "";
}

function fileNameOf(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() || "") || "notion-image";
  } catch {
    return "notion-image";
  }
}

function stripRichLinks(value) {
  if (!Array.isArray(value)) return;
  for (const fragment of value) {
    if (!Array.isArray(fragment) || !Array.isArray(fragment[1])) continue;
    for (const mark of fragment[1]) {
      if (Array.isArray(mark) && mark[0] === "a" && mark[1]) mark[1] = stripTracking(mark[1]);
    }
  }
}

function blockFromRecord(record) {
  const nested = record?.value?.value;
  if (nested && typeof nested === "object" && nested.type) return nested;
  const value = record?.value;
  if (value && typeof value === "object" && value.type) return value;
  return null;
}

function absorbChunk(blocks, chunk) {
  for (const [id, record] of Object.entries(chunk.recordMap?.block ?? {})) {
    const block = blockFromRecord(record);
    if (!block?.type) continue;
    if (!block.id) block.id = id;
    blocks.set(block.id, block);
  }
}

function subtreeIds(blocks, pageId) {
  const ids = new Set();
  const stack = [pageId];
  while (stack.length) {
    const id = stack.pop();
    if (!id || ids.has(id)) continue;
    const block = blocks.get(id);
    if (!block) continue;
    ids.add(id);
    if (block.type === "page" && id !== pageId) continue;
    for (const childId of block.content ?? []) stack.push(childId);
  }
  return ids;
}

function keepSubtree(blocks, pageId) {
  const owned = subtreeIds(blocks, pageId);
  const kept = new Map();
  for (const [id, block] of blocks) {
    if (owned.has(id)) kept.set(id, block);
  }
  return kept;
}

function missingChildCount(blocks, pageId) {
  let missing = 0;
  for (const [id, block] of blocks) {
    if (block.type === "page" && id !== pageId) continue;
    for (const childId of block.content ?? []) {
      if (!blocks.has(childId)) missing += 1;
    }
  }
  return missing;
}

function notionCookie() {
  if (cachedCookie != null) return cachedCookie;
  if (!existsSync(resolve(root, COOKIE_RELATIVE))) throw new Error(`Notion 쿠키가 없습니다. ${COOKIE_RELATIVE}`);
  const raw = readFileSync(resolve(root, COOKIE_RELATIVE), "utf8").trim();
  if (!raw) throw new Error(`Notion 쿠키가 없습니다. ${COOKIE_RELATIVE}`);
  cachedCookie = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .join("; ");
  return cachedCookie;
}

function redact(text) {
  return String(text ?? "")
    .replace(/https?:\/\/\S+/g, "[url]")
    .replace(/token_v2=[^;\s]+/g, "token_v2=[redacted]");
}

async function pace() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < 1200) await pause(1200 - elapsed);
  lastRequestAt = Date.now();
}

async function requestJson(body) {
  const retryDelays = [30000, 60000];
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    await pace();
    const response = await fetch(NOTION_ENDPOINT, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0",
        cookie: notionCookie(),
      },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    if (response.ok) {
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Notion 응답이 JSON이 아닙니다. HTTP ${response.status}`);
      }
    }
    if (![429, 503].includes(response.status) || attempt === retryDelays.length) {
      throw new Error(`Notion HTTP ${response.status}. ${redact(text).slice(0, 160)}`);
    }
    await pause(retryDelays[attempt]);
  }
  throw new Error("Notion 요청 실패.");
}

async function requestChunk(id, cursor = { stack: [] }, chunkNumber = 0) {
  return requestJson({ page: { id }, limit: 100, cursor, chunkNumber, verticalColumns: false });
}

async function collectBlocks() {
  const blocks = new Map();
  let cursor = { stack: [] };
  let chunkNumber = 0;
  do {
    const chunk = await requestChunk(PAGE_ID, cursor, chunkNumber);
    absorbChunk(blocks, chunk);
    cursor = chunk.cursor ?? { stack: [] };
    chunkNumber += 1;
    if (chunkNumber > 20) throw new Error("페이지 청크가 너무 많습니다.");
  } while (cursor.stack?.length);

  const fetched = new Set([PAGE_ID]);
  for (let guard = 0; guard < 30; guard += 1) {
    const parents = [];
    for (const block of blocks.values()) {
      if (!block.id || fetched.has(block.id)) continue;
      if (block.type === "page" && block.id !== PAGE_ID) continue;
      if ((block.content ?? []).some((childId) => !blocks.has(childId))) parents.push(block.id);
    }
    if (!parents.length) break;
    for (const parentId of parents) {
      fetched.add(parentId);
      absorbChunk(blocks, await requestChunk(parentId));
    }
  }
  const kept = keepSubtree(blocks, PAGE_ID);
  if (missingChildCount(kept, PAGE_ID) !== 0) throw new Error("빠진 자식 블록이 있습니다.");
  let pages = 0;
  for (const block of kept.values()) {
    if (block.type === "page") pages += 1;
  }
  if (pages !== 1) throw new Error(`페이지 블록 수가 다릅니다. ${pages}`);
  return kept;
}

function blocksInOrder(blocks, type) {
  const found = [];
  function visit(id) {
    const block = blocks.get(id);
    if (!block) return;
    if (block.type === "page" && id !== PAGE_ID) return;
    if (block.type === type) found.push(block);
    for (const childId of block.content ?? []) visit(childId);
  }
  visit(PAGE_ID);
  return found;
}

function notionImageUrl(url, block) {
  const params = new URLSearchParams({
    table: "block",
    id: block.id,
    spaceId: block.space_id || "",
    width: "2000",
    cache: "v2",
  });
  return `https://www.notion.so/image/${encodeURIComponent(url)}?${params}`;
}

async function downloadBytes(url, block) {
  await pace();
  let response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0", referer: "https://www.notion.so/" },
  });
  if (!response.ok) {
    await response.arrayBuffer().catch(() => {});
    await pace();
    response = await fetch(notionImageUrl(url, block), {
      headers: { "user-agent": "Mozilla/5.0", referer: "https://www.notion.so/", cookie: notionCookie() },
    });
  }
  if (!response.ok) {
    await response.arrayBuffer().catch(() => {});
    throw new Error(`파일 HTTP ${response.status}`);
  }
  return { bytes: Buffer.from(await response.arrayBuffer()), header: response.headers.get("content-type") };
}

function dataImageUrl(bytes, header) {
  const mime = imageMime(bytes, header);
  if (!String(mime).startsWith("image/")) throw new Error("이미지 형식이 아닙니다.");
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

function jpegSize(bytes) {
  let index = 2;
  while (index + 8 < bytes.length) {
    if (bytes[index] !== 0xff) return null;
    const marker = bytes[index + 1];
    const length = (bytes[index + 2] << 8) + bytes[index + 3];
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: (bytes[index + 5] << 8) + bytes[index + 6], width: (bytes[index + 7] << 8) + bytes[index + 8] };
    }
    if (length < 2) return null;
    index += 2 + length;
  }
  return null;
}

async function resolveImages(blocks) {
  const media = new Map();
  const images = [];
  for (const block of blocksInOrder(blocks, "image")) {
    const url = sourceOf(block);
    if (!url) throw new Error("이미지 주소가 없습니다.");
    const downloaded = await downloadBytes(url, block);
    media.set(block.id, dataImageUrl(downloaded.bytes, downloaded.header));
    const caption = plainText(block.properties?.caption).trim();
    if (caption.includes("]")) {
      block.properties = { ...(block.properties || {}), caption: [[fileNameOf(url)]] };
    }
    images.push({
      file: fileNameOf(url),
      caption,
      bytes: downloaded.bytes.length,
      sha256: createHash("sha256").update(downloaded.bytes).digest("hex"),
      ...jpegSize(downloaded.bytes),
    });
  }
  return { media, images };
}

function countType(content, type) {
  let count = 0;
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === type) count += 1;
    for (const child of node.content ?? []) walk(child);
  };
  walk(JSON.parse(content));
  return count;
}

function imageAlts(content) {
  const alts = [];
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "image") alts.push(node.attrs?.alt || "");
    for (const child of node.content ?? []) walk(child);
  };
  walk(JSON.parse(content));
  return alts;
}

function assertIntegrity(markdown, content, images) {
  if (!markdown.startsWith(`# ${PAGE_TITLE}`)) throw new Error("첫 헤딩이 제목과 다릅니다.");
  if (markdown.includes("utm_") || markdown.includes(TRACKING_KEY)) throw new Error("추적 쿼리가 본문에 있습니다.");
  for (const part of EXPIRED_URL_PARTS) {
    if (content.includes(part)) throw new Error("만료 URL이 본문에 있습니다.");
  }
  const stats = documentStats(content);
  if (stats.images !== EXPECTED.images) throw new Error(`이미지 수가 다릅니다. ${stats.images}`);
  if (stats.attachments !== EXPECTED.attachments) throw new Error(`첨부 수가 다릅니다. ${stats.attachments}`);
  if (stats.tables !== EXPECTED.tables) throw new Error(`표 수가 다릅니다. ${stats.tables}`);
  if (stats.codes !== EXPECTED.codes) throw new Error(`코드 수가 다릅니다. ${stats.codes}`);
  if (countType(content, "horizontalRule") !== EXPECTED.rules) throw new Error("구분선 수가 다릅니다.");
  const hrefs = new Set(stats.hrefs.map((href) => stripTracking(href)));
  for (const href of REQUIRED_HREFS) {
    if (!hrefs.has(href)) throw new Error(`링크가 없습니다. ${href}`);
  }
  for (const phrase of REQUIRED_PHRASES) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  const byFile = new Map(images.map((image) => [image.file, image]));
  for (const expected of EXPECTED_IMAGES) {
    const image = byFile.get(expected.file);
    if (!image) throw new Error(`이미지 파일이 없습니다. ${expected.file}`);
    if (image.bytes !== expected.bytes || image.sha256 !== expected.sha256) {
      throw new Error(`이미지 바이트가 다릅니다. ${expected.file}`);
    }
    if (image.caption !== expected.caption) throw new Error(`이미지 캡션이 다릅니다. ${expected.file}`);
  }
  const alts = imageAlts(content);
  for (const expected of EXPECTED_IMAGES) {
    if (!alts.includes(expected.caption)) throw new Error(`이미지 캡션이 본문에 없습니다. ${expected.caption}`);
  }
}

function loadLibs() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(resolve(root, "src/lib/markdown-to-tiptap.ts"));
  const { preparePageFindability, isMissingPageFindabilityColumn } = require(resolve(root, "src/lib/page-findability.ts"));
  return { markdownToTiptapDoc, preparePageFindability, isMissingPageFindabilityColumn };
}

async function buildImportedPage(libs) {
  const blocks = await collectBlocks();
  for (const block of blocks.values()) {
    for (const value of Object.values(block.properties || {})) stripRichLinks(value);
  }
  const { media, images } = await resolveImages(blocks);
  const rendered = buildMarkdown(blocks, PAGE_ID, SOURCE_URL, media);
  if (rendered.pageTitle !== PAGE_TITLE) throw new Error(`제목이 다릅니다. ${rendered.pageTitle}`);
  const markdown = autolinkBareUrls(rendered.markdown);
  const content = JSON.stringify(libs.markdownToTiptapDoc(markdown));
  assertIntegrity(markdown, content, images);
  const stats = documentStats(content);
  return {
    pageTitle: PAGE_TITLE,
    sourceUrl: SOURCE_URL,
    images: stats.images,
    attachments: stats.attachments,
    tables: stats.tables,
    codes: stats.codes,
    rules: countType(content, "horizontalRule"),
    links: stats.links,
    imageFiles: images.map(({ file, caption, bytes, sha256, width, height }) => ({
      file,
      caption,
      bytes,
      sha256,
      width,
      height,
    })),
    length: content.length,
    hash: createHash("sha256").update(content).digest("hex"),
    content,
  };
}

function pageColumns(db) {
  return db.prepare("PRAGMA table_info(custom_pages)").all().map((column) => column.name);
}

function findLocalPage(db) {
  const cols = pageColumns(db);
  const fields = ["id", "title"];
  if (cols.includes("source_url")) fields.push("source_url");
  const select = fields.join(", ");
  const byTitle = db.prepare(`SELECT ${select} FROM custom_pages WHERE user_id = ? AND title = ?`).get(LOCAL_USER, PAGE_TITLE);
  if (isDuplicateRow(byTitle, PAGE_TITLE, [SOURCE_URL])) return byTitle;
  if (!cols.includes("source_url")) return null;
  const bySource = db
    .prepare(`SELECT ${select} FROM custom_pages WHERE user_id = ? AND source_url = ? LIMIT 1`)
    .get(LOCAL_USER, SOURCE_URL);
  if (isDuplicateRow(bySource, PAGE_TITLE, [SOURCE_URL])) return bySource;
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

function sqliteHasFindability(db) {
  const cols = pageColumns(db);
  return ["tags", "source_url", "search_text", "is_favorite"].every((name) => cols.includes(name));
}

function importLocal(page, libs) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  const existing = findLocalPage(db);
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
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    ).run(
      page.id,
      LOCAL_USER,
      page.title,
      page.content,
      found.tags,
      found.sourceUrl,
      found.searchText,
      page.created_at,
      page.updated_at,
    );
  } else {
    db.prepare(
      `INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(page.id, LOCAL_USER, page.title, page.content, page.created_at, page.updated_at);
  }
  result.pages += 1;
  db.close();
  return result;
}

function createSupabase() {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

async function findProductionPage(supabase) {
  const byTitle = await supabase
    .from("custom_pages")
    .select("id, title, source_url")
    .eq("user_id", PROD_USER)
    .eq("title", PAGE_TITLE)
    .limit(1);
  if (byTitle.error) throw byTitle.error;
  if (isDuplicateRow(byTitle.data?.[0], PAGE_TITLE, [SOURCE_URL])) return byTitle.data[0];
  const bySource = await supabase
    .from("custom_pages")
    .select("id, title, source_url")
    .eq("user_id", PROD_USER)
    .eq("source_url", SOURCE_URL)
    .limit(1);
  if (bySource.error) throw bySource.error;
  if (isDuplicateRow(bySource.data?.[0], PAGE_TITLE, [SOURCE_URL])) return bySource.data[0];
  return null;
}

async function importProduction(page, libs) {
  const supabase = createSupabase();
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  const existing = await findProductionPage(supabase);
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
  result.pages += 1;
  return result;
}

async function savedOnBothSides() {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  let local = null;
  try {
    local = findLocalPage(db);
  } finally {
    db.close();
  }
  const production = await findProductionPage(createSupabase());
  if (!local && !production) return null;
  if (!local || !production) throw new Error(`로컬과 운영 중 한쪽에만 글이 있습니다. ${SOURCE_URL}`);
  if (local.id !== production.id) throw new Error(`로컬과 운영의 페이지 id가 다릅니다. ${SOURCE_URL}`);
  return { pageId: local.id, path: `/pages/${local.id}`, action: "skip" };
}

function emit(value) {
  const output = JSON.stringify(value, null, 2);
  if (output.includes("data:")) throw new Error("로그에 data URL이 있습니다.");
  if (output.includes(TRACKING_KEY) || output.includes("utm_source") || output.includes("token_v2")) {
    throw new Error("로그에 추적 값 또는 쿠키가 있습니다.");
  }
  console.log(output);
}

async function main() {
  loadEnv();
  const checkOnly = process.argv.includes("--check");
  const libs = loadLibs();
  if (!checkOnly) {
    const saved = await savedOnBothSides();
    if (saved) {
      emit(saved);
      return;
    }
  }
  const built = await buildImportedPage(libs);
  const { content, ...extra } = built;
  if (checkOnly) {
    emit(extra);
    return;
  }
  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    title: PAGE_TITLE,
    content,
    sourceUrl: SOURCE_URL,
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record, libs);
  record.id = local.pageId;
  let production;
  try {
    production = await importProduction(record, libs);
  } catch (error) {
    if (local.pages === 1) {
      const db = new Database(resolve(root, "data/mymark.db"));
      db.prepare("DELETE FROM custom_pages WHERE id = ? AND user_id = ?").run(record.id, LOCAL_USER);
      db.close();
    }
    throw error;
  }
  const pageId = production.pageId || local.pageId;
  emit({
    ...extra,
    pageId,
    path: `/pages/${pageId}`,
    createdAt: now,
    local: { action: local.pages ? "insert" : "skip", pages: local.pages, pageSkips: local.pageSkips },
    production: {
      action: production.pages ? "insert" : "skip",
      pages: production.pages,
      pageSkips: production.pageSkips,
    },
  });
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) await main();
