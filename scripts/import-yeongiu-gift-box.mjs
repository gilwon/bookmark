// 연기우 특별선물함 하위 글 중 Pages에 없는 것만 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync, writeSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import {
  assertDownloadableAttachment,
  buildMarkdown,
  documentStats,
  fileNameOf,
  imageMime,
  isZipBytes,
  plainText,
} from "./import-claude-eli5-page.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
export const LIST_PAGE_ID = "378fec6d-90d2-8070-a4cb-f33bf8733f02";
export const LIST_HEX = "378fec6d90d28070a4cbf33bf8733f02";
export const SPACE_ID = "ea73981a-6b7f-4b32-b897-1f5879c4f918";
export const ZIP_SOURCE_ID = "yeongiu-gift-box";
export const ZIP_FILENAMES = [];
export const REQUEST_GAP_MS = 1500;
export const RETRY_WAITS_MS = [30000, 60000];
const LIST_PATH = "/tmp/yeongiu-list.json";
const RESULT_PATH = "/tmp/yeongiu-gift-box-result.json";
const NOTION_ENDPOINT = "https://www.notion.so/api/v3/loadPageChunk";
const SYNC_ENDPOINT = "https://www.notion.so/api/v3/syncRecordValues";
const SIGNED_FILE_ENDPOINT = "https://www.notion.so/api/v3/getSignedFileUrls";
const SYNC_BATCH = 50;
const NOTICE_MARK = "추가 업로드 진행중";
const EXPIRED_URL_PARTS = [
  "prod-files-secure",
  "file.notion.so",
  "expirationTimestamp",
  "X-Amz",
];
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

/** 제목은 Notion 제목 그대로 둔다. 앞 번호도 빼지 않는다. */
export function storedTitleOf(title) {
  return String(title ?? "").trim();
}

export function sourceUrlOf(hex) {
  return `https://app.notion.com/p/${hex}`;
}

export function isNoticeTitle(title) {
  return String(title ?? "").includes(NOTICE_MARK);
}

function getBlock(blocks, id) {
  if (!blocks || id == null) return null;
  if (typeof blocks.get === "function") return blocks.get(id) ?? null;
  return blocks[id] ?? null;
}

/** 목록의 직계 page만 고른다. 안내 text와 callout은 대상이 아니다. */
export function selectListPages(blocks, listPageId = LIST_PAGE_ID) {
  const page = getBlock(blocks, listPageId);
  const items = [];
  const seen = new Set();
  for (const childId of page?.content ?? []) {
    const block = getBlock(blocks, childId);
    if (!block || block.type !== "page") continue;
    if (!block.id || block.id === listPageId) continue;
    const title = storedTitleOf(plainText(block.properties?.title));
    if (!title || isNoticeTitle(title)) continue;
    const hex = String(block.id).replaceAll("-", "");
    if (hex === LIST_HEX || seen.has(hex)) continue;
    seen.add(hex);
    items.push({
      id: block.id,
      hex,
      title,
      sourceUrl: sourceUrlOf(hex),
    });
  }
  return items;
}

/** 스냅샷 항목에서 목록 자신과 안내 문구를 뺀다. */
export function targetsFromItems(items) {
  const targets = [];
  const seen = new Set();
  for (const item of items ?? []) {
    const title = storedTitleOf(item?.title);
    const id = item?.id;
    const hex = String(item?.hex || id || "").replaceAll("-", "");
    if (!id || !/^[0-9a-f]{32}$/.test(hex) || !title) continue;
    if (id === LIST_PAGE_ID || hex === LIST_HEX) continue;
    if (isNoticeTitle(title) || seen.has(hex)) continue;
    seen.add(hex);
    targets.push({ id, hex, title, sourceUrl: sourceUrlOf(hex) });
  }
  return targets;
}

/** 대상 페이지와 자손만 남긴다. 자손 page 안은 따라가지 않는다. */
export function scopeBlocks(blocks, pageId) {
  const scoped = new Map();
  const root = getBlock(blocks, pageId);
  if (!root) return scoped;
  const visit = (block, isRoot) => {
    if (!block?.id || scoped.has(block.id)) return;
    scoped.set(block.id, block);
    if (!isRoot && block.type === "page") return;
    for (const childId of block.content ?? []) {
      const child = getBlock(blocks, childId);
      if (child) visit(child, false);
    }
  };
  visit(root, true);
  return scoped;
}

function blockFromRecord(record) {
  const nested = record?.value?.value;
  if (nested && typeof nested === "object" && nested.type) return nested;
  const value = record?.value;
  if (value && typeof value === "object" && value.type) return value;
  return null;
}

function sourceOf(block) {
  return (
    plainText(block?.properties?.source) ||
    block?.format?.display_source ||
    block?.format?.original_url ||
    ""
  );
}

function bookmarkHref(block) {
  return (
    plainText(block?.properties?.link) ||
    sourceOf(block) ||
    block?.format?.bookmark_url ||
    ""
  );
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

/** 북마크를 링크 문단으로 바꾸고 본문 링크의 추적 쿼리를 뺀다. */
export function preprocessBlocks(blocks) {
  for (const block of blocks.values()) {
    const properties = block.properties;
    if (properties) {
      for (const value of Object.values(properties)) rewriteRichText(value);
    }
    if (block.type === "bookmark") {
      const href = stripTracking(bookmarkHref(block));
      if (href) {
        const label = plainText(block.properties?.title).trim() || href;
        block.properties = {
          ...(block.properties || {}),
          title: [[label, [["a", href]]]],
        };
      }
    }
    if (block.type === "to_do") {
      const checked = /^(yes|true)$/i.test(plainText(block.properties?.checked));
      const prefix = checked ? "[x] " : "[ ] ";
      const title = Array.isArray(block.properties?.title)
        ? block.properties.title
        : [];
      block.type = "bulleted_list";
      block.properties = {
        ...(block.properties || {}),
        title: [[prefix], ...title],
      };
    }
  }
}

/** 이미 링크가 아닌 맨 URL을 마크다운 링크로 바꾼다. */
export function autolinkBareUrls(markdown) {
  const parts = String(markdown).split(/(```[\s\S]*?```)/);
  return parts
    .map((part) => {
      if (part.startsWith("```")) return part;
      return part.replace(
        /(!?\[[^\]]*]\()([^)]*)(\))|(https?:\/\/[^\s)<]+)/g,
        (match, prefix, href, suffix, bare) => {
          if (bare) {
            if (bare.startsWith("data:")) return match;
            const cleaned = stripTracking(bare);
            return `[${cleaned}](${cleaned})`;
          }
          if (href && /^https?:\/\//i.test(href)) {
            return `${prefix}${stripTracking(href)}${suffix}`;
          }
          return match;
        }
      );
    })
    .join("");
}

function looksLikeSvg(bytes, hint = "") {
  if (/\.svg(?:$|[?#])/i.test(String(hint))) return true;
  const head = Buffer.from(bytes.subarray(0, 512)).toString("utf8");
  return /<svg[\s>/]/i.test(head);
}

function imageMimeOf(bytes, header, hint = "") {
  if (looksLikeSvg(bytes, hint) || /svg/i.test(String(header ?? ""))) {
    return "image/svg+xml";
  }
  return imageMime(bytes, header);
}

function attachmentKind(filename, isVideo) {
  if (isVideo || /\.mp4$/i.test(filename)) return "mp4";
  if (/\.pdf$/i.test(filename)) return "pdf";
  if (isZipBytes(new Uint8Array(), filename) || /\.zip$/i.test(filename)) return "zip";
  const ext = String(filename).includes(".")
    ? String(filename).split(".").pop().toLowerCase()
    : "file";
  return ext || "file";
}

function zipHref(filename) {
  return `/api/page-attachments/${ZIP_SOURCE_ID}/${encodeURIComponent(filename)}`;
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
  const attachment = require(resolve(root, "src/lib/page-attachment-storage.ts"));
  return {
    markdownToTiptapDoc,
    preparePageFindability,
    isMissingPageFindabilityColumn,
    attachment,
  };
}

function mediaHeaders() {
  return {
    referer: "https://www.notion.so/",
    "user-agent": "Mozilla/5.0",
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
  const root = blocks.get(pageId);
  if (root) walk(root, true);
  return ids;
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
    if (chunkNumber > 30) throw new Error("페이지 청크 한도를 넘었습니다.");
  } while (cursor.stack?.length);

  const fetched = new Set();
  let guard = 0;
  let missing = missingIds(blocks, fetched, pageId);
  while (missing.length) {
    if (guard++ > 40) throw new Error("블록 수집 한도를 넘었습니다.");
    const batch = missing.slice(0, SYNC_BATCH);
    for (const id of batch) fetched.add(id);
    absorbChunk(blocks, await syncBlocks(batch));
    missing = missingIds(blocks, fetched, pageId);
  }
  return scopeBlocks(blocks, pageId);
}

async function dataUrlFromResponse(response, hint = "") {
  if (!response.ok) throw new Error(`이미지 HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const dataUrl = `data:${imageMimeOf(bytes, response.headers.get("content-type"), hint)};base64,${Buffer.from(bytes).toString("base64")}`;
  if (!dataUrl.startsWith("data:image/")) {
    throw new Error("이미지 src가 data URL이 아닙니다.");
  }
  if (!hasNoExpiredUrl(dataUrl)) {
    throw new Error("만료 URL이 이미지 데이터에 남아 있습니다.");
  }
  return dataUrl;
}

function signedUrlValue(value) {
  if (typeof value === "string") return value;
  if (value && typeof value.url === "string") return value.url;
  return "";
}

async function signedUrlFor(block, url) {
  const signed = await requestJson(SIGNED_FILE_ENDPOINT, {
    urls: [
      {
        permissionRecord: {
          table: "block",
          id: block.id,
          spaceId: block.space_id || SPACE_ID,
        },
        url,
      },
    ],
  });
  const signedUrl = signedUrlValue(signed.signedUrls?.[0]);
  if (!signedUrl) throw new Error(`서명 URL을 받지 못했습니다. ${block.id}`);
  return signedUrl;
}

function notionImageUrl(url, block) {
  const spaceId = block.space_id || SPACE_ID;
  const params = new URLSearchParams({
    table: "block",
    id: block.id,
    spaceId,
    width: "2000",
    cache: "v2",
  });
  return `https://www.notion.so/image/${encodeURIComponent(url)}?${params}`;
}

async function fetchMedia(url, block) {
  const headers = mediaHeaders();
  if (url.startsWith("attachment:")) {
    const wrapped = await pacedFetch(notionImageUrl(url, block), { headers });
    const wrappedType = wrapped.headers.get("content-type") || "";
    if (wrapped.ok && !wrappedType.startsWith("text/") && !wrappedType.includes("json")) {
      return wrapped;
    }
    return pacedFetch(await signedUrlFor(block, url), { headers });
  }
  const absolute = url.startsWith("/") ? `https://www.notion.so${url}` : url;
  return pacedFetch(absolute, { headers });
}

/** 영상은 /image/ 래퍼가 422일 수 있어 서명 URL을 쓴다. */
async function fetchSignedFile(url, block) {
  const headers = mediaHeaders();
  if (
    url.startsWith("attachment:") ||
    /prod-files-secure|file\.notion\.so|expirationTimestamp|X-Amz/.test(url)
  ) {
    return pacedFetch(await signedUrlFor(block, url), { headers });
  }
  const absolute = url.startsWith("/") ? `https://www.notion.so${url}` : url;
  return pacedFetch(absolute, { headers });
}

function isFetchableCover(cover) {
  return (
    typeof cover === "string" &&
    (/^https?:/i.test(cover) ||
      cover.startsWith("attachment:") ||
      cover.startsWith("/"))
  );
}

async function resolveMedia(blocks, pageId) {
  const media = new Map();
  for (const block of blocks.values()) {
    if (block.type !== "image") continue;
    const url = sourceOf(block);
    if (!url) throw new Error(`이미지 URL이 없습니다. ${block.id}`);
    const hint = `${fileNameOf(block)} ${url}`;
    media.set(
      block.id,
      await dataUrlFromResponse(await fetchMedia(url, block), hint)
    );
  }
  const page = blocks.get(pageId);
  const cover = page?.format?.page_cover;
  if (isFetchableCover(cover)) {
    media.set(
      `${pageId}:cover`,
      await dataUrlFromResponse(await fetchMedia(cover, page), "cover")
    );
  }
  return media;
}

async function resolveAttachments(blocks) {
  const files = new Map();
  const attachments = [];
  const zips = [];
  for (const block of blocks.values()) {
    const isVideo = block.type === "video";
    if (!isVideo && block.type !== "file" && block.type !== "pdf") continue;
    const filename = fileNameOf(block) || (isVideo ? "영상.mp4" : "첨부 파일");
    const url = sourceOf(block);
    if (!url) throw new Error(`첨부 URL이 없습니다. ${block.id}`);
    if (url.startsWith("data:")) {
      if (!hasNoExpiredUrl(url)) {
        throw new Error(`만료 URL 첨부를 저장할 수 없습니다. ${filename}`);
      }
      files.set(block.id, `[${filename}](${url})`);
      attachments.push({
        filename,
        kind: attachmentKind(filename, isVideo),
        bytes: 0,
      });
      if (isVideo) block.type = "file";
      continue;
    }
    const response = isVideo
      ? await fetchSignedFile(url, block)
      : await fetchMedia(url, block);
    if (!response.ok) throw new Error(`첨부 HTTP ${response.status}. ${filename}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!isVideo && isZipBytes(bytes, filename)) {
      if (!ZIP_FILENAMES.includes(filename)) {
        throw new Error(`ZIP 첨부. ${filename} ${bytes.byteLength}바이트`);
      }
      files.set(block.id, `[${filename}](${zipHref(filename)})`);
      const item = { filename, kind: "zip", bytes: bytes.byteLength, data: bytes };
      attachments.push({ filename, kind: "zip", bytes: bytes.byteLength });
      zips.push(item);
      continue;
    }
    const header = isVideo ? "video/mp4" : response.headers.get("content-type");
    files.set(block.id, assertDownloadableAttachment(filename, bytes, header));
    attachments.push({
      filename,
      kind: attachmentKind(filename, isVideo),
      bytes: bytes.byteLength,
    });
    if (isVideo) block.type = "file";
  }
  return { files, attachments, zips };
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

function findLocalPage(db, titles, hex) {
  const columns = pageColumns(db);
  const fields = ["id", "title"];
  if (columns.includes("source_url")) fields.push("source_url");
  const select = fields.join(", ");
  for (const title of titles) {
    if (!title) continue;
    const row = db
      .prepare(
        `SELECT ${select} FROM custom_pages WHERE user_id = ? AND title = ? LIMIT 1`
      )
      .get(LOCAL_USER, title);
    if (isDuplicateRow(row, title, hex)) return row;
  }
  if (columns.includes("source_url") && hex) {
    const row = db
      .prepare(
        `SELECT ${select} FROM custom_pages
         WHERE user_id = ? AND source_url IS NOT NULL AND instr(source_url, ?) > 0
         LIMIT 1`
      )
      .get(LOCAL_USER, hex);
    if (isDuplicateRow(row, row?.title, hex)) return row;
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

function importLocal(page, titles, hex, libs) {
  const db = new Database(resolve(root, "data/mymark.db"));
  db.pragma("busy_timeout = 5000");
  try {
    const existing = findLocalPage(db, titles, hex);
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

async function findProductionPage(supabase, titles, hex) {
  for (const title of titles) {
    if (!title) continue;
    const { data, error } = await supabase
      .from("custom_pages")
      .select("id, title, source_url")
      .eq("user_id", PROD_USER)
      .eq("title", title)
      .limit(1);
    if (error) throw error;
    if (isDuplicateRow(data?.[0], title, hex)) return data[0];
  }
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

async function importProduction(page, titles, hex, libs, supabase) {
  const existing = await findProductionPage(supabase, titles, hex);
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

async function uploadZips(supabase, libs, zips) {
  if (!zips.length) return 0;
  const sourceId = libs.attachment.PAGE_ATTACHMENT_YEONGIU_GIFT_BOX_SOURCE_ID;
  const allowed = libs.attachment.PAGE_ATTACHMENT_YEONGIU_GIFT_BOX_FILENAMES ?? [];
  const bucket = libs.attachment.PAGE_ATTACHMENT_STORAGE_BUCKET;
  let count = 0;
  for (const file of zips) {
    if (sourceId !== ZIP_SOURCE_ID || !allowed.includes(file.filename)) {
      throw new Error(`ZIP 첨부. ${file.filename} ${file.bytes}바이트`);
    }
    for (const userId of [LOCAL_USER, PROD_USER]) {
      const path = libs.attachment.createPageAttachmentObjectPath(
        userId,
        sourceId,
        file.filename
      );
      if (!path) throw new Error(`ZIP 첨부. ${file.filename} ${file.bytes}바이트`);
      const { error } = await supabase.storage.from(bucket).upload(path, Buffer.from(file.data), {
        contentType: libs.attachment.PAGE_ATTACHMENT_STORAGE_MIME,
        upsert: true,
      });
      if (error) throw error;
      count += 1;
    }
  }
  return count;
}

function loadTargets() {
  const raw = JSON.parse(readFileSync(LIST_PATH, "utf8"));
  return targetsFromItems(raw.items);
}

async function buildPage(spec, libs) {
  const blocks = await collectBlocks(spec.id);
  const page = blocks.get(spec.id);
  if (!page) throw new Error("Notion 페이지를 찾지 못했습니다.");
  const missing = missingChildCount(blocks, spec.id);
  if (missing !== 0) throw new Error(`빠진 자식 블록이 있습니다. ${missing}`);
  const title = storedTitleOf(plainText(page.properties?.title)) || spec.title;
  const sourceUrl = sourceUrlOf(spec.hex);
  const media = await resolveMedia(blocks, spec.id);
  const resolved = await resolveAttachments(blocks);
  preprocessBlocks(blocks);
  const built = buildMarkdown(blocks, spec.id, sourceUrl, media, resolved.files);
  let markdown = autolinkBareUrls(built.markdown);
  if (markdown.startsWith("# ")) {
    const newline = markdown.indexOf("\n");
    markdown = `# ${title}${newline === -1 ? "" : markdown.slice(newline)}`;
  }
  if (storedTitleOf(built.pageTitle) !== title && !markdown.startsWith(`# ${title}`)) {
    throw new Error("마크다운 제목이 Notion 제목과 다릅니다.");
  }
  if (!markdown.includes(sourceUrl) || !markdown.includes(spec.hex)) {
    throw new Error("원문 주소가 없습니다.");
  }
  const content = JSON.stringify(libs.markdownToTiptapDoc(markdown));
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(content)) {
    throw new Error("만료 URL이 본문에 남아 있습니다.");
  }
  const stats = documentStats(content);
  return {
    title,
    sourceUrl,
    content,
    images: stats.images,
    attachments: resolved.attachments,
    zips: resolved.zips,
    attachmentCount: stats.attachments,
  };
}

async function importTarget(spec, libs, supabase) {
  const titles = [spec.title];
  const localExisting = openFindLocal(titles, spec.hex);
  const productionExisting = await findProductionPage(supabase, titles, spec.hex);
  if (localExisting && productionExisting) {
    return {
      title: spec.title,
      hex: spec.hex,
      status: "skip",
      images: null,
      attachments: [],
      local: "skip",
      production: "skip",
      pageId: localExisting.id,
    };
  }
  const built = await buildPage(spec, libs);
  const titlesForSave = [...new Set([built.title, spec.title])];
  const now = new Date().toISOString();
  const record = {
    id: localExisting?.id || productionExisting?.id || randomUUID(),
    title: built.title,
    content: built.content,
    sourceUrl: built.sourceUrl,
    created_at: now,
    updated_at: now,
  };
  if (built.zips.length) await uploadZips(supabase, libs, built.zips);
  let local = { action: "skip", pageId: localExisting?.id };
  let production = { action: "skip", pageId: productionExisting?.id };
  if (!localExisting) local = importLocal(record, titlesForSave, spec.hex, libs);
  record.id = local.pageId || record.id;
  if (!productionExisting) {
    try {
      production = await importProduction(
        record,
        titlesForSave,
        spec.hex,
        libs,
        supabase
      );
    } catch (error) {
      return {
        title: built.title,
        hex: spec.hex,
        status: "fail",
        error: String(error?.message ?? error).slice(0, 300),
        images: built.images,
        attachments: built.attachments,
        local: local.action,
        production: "fail",
        pageId: local.pageId,
      };
    }
  }
  return {
    title: built.title,
    listTitle: spec.title === built.title ? undefined : spec.title,
    hex: spec.hex,
    status: "saved",
    images: built.images,
    attachments: built.attachments,
    local: local.action,
    production: production.action,
    pageId: production.pageId || local.pageId,
  };
}

function openFindLocal(titles, hex) {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  db.pragma("busy_timeout = 5000");
  try {
    return findLocalPage(db, titles, hex);
  } finally {
    db.close();
  }
}

function summarize(results) {
  const summary = {
    targets: results.length,
    local: { insert: 0, skip: 0 },
    production: { insert: 0, skip: 0 },
    fail: 0,
    failures: [],
    images: [],
    attachments: [],
    savedIds: [],
  };
  for (const item of results) {
    if (item.status === "fail") {
      summary.fail += 1;
      summary.failures.push({ title: item.title, error: item.error });
      if (item.local === "insert") summary.local.insert += 1;
      if (item.local === "skip") summary.local.skip += 1;
      if (item.production === "insert") summary.production.insert += 1;
      if (item.production === "skip") summary.production.skip += 1;
      continue;
    }
    summary.local[item.local] += 1;
    summary.production[item.production] += 1;
    if (item.local === "insert" || item.production === "insert") {
      summary.savedIds.push({ title: item.title, pageId: item.pageId });
    }
    if (item.images) summary.images.push({ title: item.title, count: item.images });
    if (item.attachments?.length) {
      summary.attachments.push({
        title: item.title,
        files: item.attachments.map((file) => ({
          filename: file.filename,
          kind: file.kind,
          bytes: file.bytes,
        })),
      });
    }
  }
  return summary;
}

async function main() {
  const libs = loadLibs();
  const supabase = createSupabase();
  const targets = loadTargets();
  const results = [];
  for (let index = 0; index < targets.length; index += 1) {
    const spec = targets[index];
    try {
      const result = await importTarget(spec, libs, supabase);
      results.push(result);
      writeSync(
        1,
        `${JSON.stringify({
          index: index + 1,
          total: targets.length,
          title: result.title,
          local: result.local,
          production: result.production,
          images: result.images,
          attachments: (result.attachments ?? []).map((file) => file.kind),
          pageId: result.pageId,
        })}\n`
      );
    } catch (error) {
      const message = String(error?.message ?? error).slice(0, 300);
      const failed = { title: spec.title, hex: spec.hex, status: "fail", error: message };
      results.push(failed);
      writeSync(
        1,
        `${JSON.stringify({
          index: index + 1,
          total: targets.length,
          title: spec.title,
          status: "fail",
          error: message,
        })}\n`
      );
    }
  }
  const summary = summarize(results);
  writeFileSync(RESULT_PATH, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
