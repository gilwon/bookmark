// Slashpage ChatGPT 이미지 프롬프트 99개를 Pages에만 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import {
  assertDownloadableAttachment,
  documentStats,
  imageMime,
  isZipBytes,
} from "./import-claude-eli5-page.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
export const PAGE_TITLE = "ChatGPT 이미지 프롬프트 99개";
export const SOURCE_URL =
  "https://slashpage.com/biggie-ai/1q3vdn2pdpnk82xy49pr";
export const PAGE_HASH = "1q3vdn2pdpnk82xy49pr";
export const EXPECTED_IMAGES = 1;
export const EXPECTED_ATTACHMENTS = 0;
export const EXPECTED_TABLES = 10;
const EXPECTED_IMAGE_BYTES = 117783;
const PAGE_API = `https://slashpage.com/api/page/${PAGE_HASH}`;
const CONTENT_API = `https://slashpage.com/api/page/${PAGE_HASH}/content`;
const REQUIRED_PHRASES = [
  "쓰는 법",
  "/cinematicportrait",
  "/windowlight",
  "01. 인물",
  "09. 재질",
  "잘 안 나올 때",
];
const EXPIRED_URL_PARTS = [
  "prod-files-secure",
  "file.notion.so",
  "expirationTimestamp",
  "X-Amz",
  "blob:",
  "fbclid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
];
const TRANSFORM_URL_PARTS = ["s=1920x1", "t=outside"];
const FILE_BLOCK_TYPES = new Set(["file", "pdf", "zip", "attachment"]);

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

function getBlock(blockMap, id) {
  if (!blockMap || id == null) return null;
  if (typeof blockMap.get === "function") return blockMap.get(id) ?? null;
  return blockMap[id] ?? null;
}

function mediaOf(media, id) {
  if (!media || id == null) return "";
  if (typeof media.get === "function") return media.get(id) ?? "";
  return media[id] ?? "";
}

function withoutDataUrls(text) {
  return String(text ?? "").replace(/data:[^\s"'<>)]+/gi, "");
}

/** 유입 추적 쿼리를 빼고 절대 주소로 바꾼다. */
export function stripTracking(url, base) {
  if (!url) return url;
  try {
    const parsed = new URL(url, base);
    for (const key of [...parsed.searchParams.keys()]) {
      const value = parsed.searchParams.get(key);
      if (
        key.startsWith("utm_") ||
        key === "fbclid" ||
        key === "mcp_token" ||
        (key === "source" && value === "copy_link")
      ) {
        parsed.searchParams.delete(key);
      }
    }
    if ([...parsed.searchParams.keys()].length === 0) parsed.search = "";
    return parsed.href;
  } catch {
    return url
      .replace(/[?&](?:utm_[^=&#]*|fbclid|mcp_token)=[^&\s)#]*/g, "")
      .replace(/[?&]source=copy_link/g, "")
      .replace(/[?&]$/, "")
      .replace(/\?&/, "?");
  }
}

/** 만료 URL 문자열이 본문에 없으면 true다. */
export function hasNoExpiredUrl(text) {
  const value = String(text ?? "");
  return EXPIRED_URL_PARTS.every((part) => !value.includes(part));
}

/** 제목 또는 원문 식별자가 있으면 중복이다. */
export function isDuplicateRow(row, title, markers) {
  if (!row) return false;
  if (row.title === title) return true;
  const hay = `${row.source_url ?? ""}\n${row.content ?? ""}`;
  return markers.some((marker) => marker && hay.includes(marker));
}

function tokenLink(token) {
  if (!token || typeof token !== "object") return "";
  const candidates = [token.link, token.url, token.href, token.styles?.link];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return stripTracking(candidate.trim());
    }
    if (candidate && typeof candidate === "object") {
      const href = candidate.url || candidate.href || candidate.link;
      if (typeof href === "string" && href.trim()) return stripTracking(href.trim());
    }
  }
  return "";
}

/** Slashpage 토큰 배열을 인라인 마크다운으로 바꾼다. */
export function tokensToMarkdown(tokens) {
  if (typeof tokens === "string") return tokens;
  if (!Array.isArray(tokens)) return "";
  return tokens
    .map((token) => {
      if (typeof token === "string") return token;
      if (!token || typeof token !== "object") return "";
      let result = String(token.text ?? "");
      const styles = token.styles && typeof token.styles === "object" ? token.styles : {};
      if (styles.code) result = `\`${result}\``;
      if (styles.s) result = `~~${result}~~`;
      if (styles.i) result = `*${result}*`;
      if (styles.b) result = `**${result}**`;
      const href = tokenLink(token);
      if (href) result = `[${result}](${href})`;
      return result;
    })
    .join("");
}

function isListMarkdown(value) {
  const line = String(value).split("\n")[0] ?? "";
  return /^(-\s|\d+\.\s)/.test(line);
}

function joinRendered(parts) {
  const joined = [];
  for (const part of parts) {
    const previous = joined.at(-1);
    if (
      previous &&
      isListMarkdown(previous.split("\n").at(-1)) &&
      isListMarkdown(part)
    ) {
      joined[joined.length - 1] = `${previous}\n${part}`;
    } else {
      joined.push(part);
    }
  }
  return joined.join("\n\n");
}

function treeId(node) {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node[0];
  return "";
}

function treeChildren(node) {
  if (!Array.isArray(node) || node.length < 2) return [];
  const rest = node.slice(1);
  if (
    rest.length === 1 &&
    Array.isArray(rest[0]) &&
    rest[0].length &&
    Array.isArray(rest[0][0])
  ) {
    return rest[0];
  }
  return rest;
}

function sortKeyOf(block) {
  return String(block?.sortKey ?? "");
}

function childrenByParent(blockMap, parentId) {
  return allBlocks(blockMap)
    .filter((block) => block.parentBlockId === parentId)
    .sort((a, b) => sortKeyOf(a).localeCompare(sortKeyOf(b)));
}

function escapeCell(text) {
  return String(text ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ")
    .trim();
}

function tableMarkdown(block, blockMap) {
  const colCount = Number(block.value?.colCount) || 0;
  const rowCount = Number(block.value?.rowCount) || 0;
  const cells = childrenByParent(blockMap, block.id).filter(
    (child) => child.type === "tableCell"
  );
  if (!colCount || !rowCount) {
    throw new Error(`표 크기를 읽지 못했습니다. ${block.id}`);
  }
  if (cells.length !== colCount * rowCount) {
    throw new Error(`표 셀 수가 다릅니다. ${cells.length}`);
  }
  const rows = [];
  for (let row = 0; row < rowCount; row += 1) {
    const line = [];
    for (let col = 0; col < colCount; col += 1) {
      const cell = cells[row * colCount + col];
      const texts = childrenByParent(blockMap, cell.id)
        .map((child) => tokensToMarkdown(child.value?.tokens))
        .filter(Boolean);
      line.push(escapeCell(texts.join(" ")));
    }
    rows.push(line);
  }
  if (!rows.length) return "";
  const divider = rows[0].map(() => "---");
  return [rows[0], divider, ...rows.slice(1)]
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");
}

function codeFence(block) {
  const body = String(block.value?.code ?? "");
  const raw = String(block.value?.language ?? "");
  const language = /^plain\s*text$/i.test(raw) ? "" : raw;
  return `\`\`\`${language}\n${body}\n\`\`\``;
}

function isChromeImage(image) {
  const key = `${image?.imageKey ?? ""}\n${image?.path ?? ""}`;
  return (
    key.includes("slashpageUser/") || key.includes("slashDomainFavicon/")
  );
}

function originalImageUrl(imageKey) {
  if (!imageKey) throw new Error("이미지 키가 없습니다.");
  const url = `https://upload.cafenono.com/${imageKey}`;
  if (/[?&][qstf]=/.test(url)) {
    throw new Error("원본 이미지 URL에 리사이즈 쿼리가 있습니다.");
  }
  return url;
}

function imageAlt(block) {
  const image = block.value?.image || {};
  return image.filename || "Slashpage 이미지";
}

function fileRecord(block) {
  const value = block.value && typeof block.value === "object" ? block.value : {};
  const file = value.file || value.attachment || {};
  const filename =
    file.filename ||
    file.name ||
    value.filename ||
    value.name ||
    tokensToMarkdown(value.tokens).trim() ||
    "첨부 파일";
  const key = file.fileKey || file.imageKey || file.key || value.fileKey || "";
  const path = file.path || value.path || value.url || "";
  return { filename, key, path };
}

function countType(blockMap, type) {
  return allBlocks(blockMap).filter((block) => block.type === type).length;
}

function attachmentBlocks(blockMap) {
  return allBlocks(blockMap).filter((block) => FILE_BLOCK_TYPES.has(block.type));
}

function renderBlock(block, blockMap, media, files, orderedIndex = 0) {
  if (!block) return "";
  const type = block.type;
  if (type === "codeSource" || type === "tableCell") return "";
  if (type === "heading") {
    const level = Number(block.value?.level) || 1;
    const prefix = "#".repeat(Math.min(Math.max(level, 1), 6));
    return `${prefix} ${tokensToMarkdown(block.value?.tokens)}`.trim();
  }
  if (type === "text") return tokensToMarkdown(block.value?.tokens).trim();
  if (type === "divider") return "---";
  if (type === "code") return codeFence(block);
  if (type === "orderedList") {
    const index = orderedIndex > 0 ? orderedIndex : 1;
    return `${index}. ${tokensToMarkdown(block.value?.tokens)}`.trim();
  }
  if (type === "list") {
    return `- ${tokensToMarkdown(block.value?.tokens)}`.trim();
  }
  if (type === "table") return tableMarkdown(block, blockMap);
  if (type === "image") {
    const image = block.value?.image || {};
    if (isChromeImage(image)) return "";
    const src = mediaOf(media, block.id);
    if (!src) throw new Error(`이미지를 변환하지 못했습니다. ${block.id}`);
    return `![${imageAlt(block)}](${src})`;
  }
  if (FILE_BLOCK_TYPES.has(type)) {
    const markdown = mediaOf(files, block.id);
    if (!markdown) throw new Error(`첨부 파일을 찾지 못했습니다. ${block.id}`);
    return markdown;
  }
  const titled = tokensToMarkdown(block.value?.tokens).trim();
  return titled;
}

/** blockTree 순서대로 본문 마크다운을 만든다. */
export function blocksToMarkdown(blockTree, blockMap, media = new Map(), files = new Map()) {
  const parts = [];
  let orderedIndex = 0;
  for (const node of blockTree ?? []) {
    const id = treeId(node);
    const block = getBlock(blockMap, id);
    if (!block) continue;
    if (block.type === "orderedList") {
      orderedIndex += 1;
      const rendered = renderBlock(block, blockMap, media, files, orderedIndex);
      if (rendered) parts.push(rendered);
      continue;
    }
    orderedIndex = 0;
    const rendered = renderBlock(block, blockMap, media, files);
    if (rendered) parts.push(rendered);
  }
  return joinRendered(parts);
}

function buildPageMarkdown(bodyMarkdown) {
  return [
    `# ${PAGE_TITLE}`,
    `> 원문. [Slashpage](${SOURCE_URL})`,
    bodyMarkdown,
  ]
    .filter(Boolean)
    .join("\n\n")
    .replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, "\n\n![$1]($2)\n\n")
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
  if (!markdown.includes(SOURCE_URL)) throw new Error("원문 주소가 없습니다.");
  if (!markdown.includes(`> 원문. [Slashpage](${SOURCE_URL})`)) {
    throw new Error("원문 인용이 없습니다.");
  }
  for (const phrase of REQUIRED_PHRASES) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  if (!markdown.includes("/portrait")) throw new Error("문구가 없습니다. /portrait");
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
  for (const src of sources) {
    if (!src.startsWith("data:image")) {
      throw new Error("이미지가 data URL이 아닙니다.");
    }
    if (!hasNoExpiredUrl(src)) {
      throw new Error("이미지에 만료 URL이 남아 있습니다.");
    }
  }
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(content)) {
    throw new Error("만료 URL이 본문에 남아 있습니다.");
  }
  const plain = `${withoutDataUrls(markdown)}\n${withoutDataUrls(content)}`;
  for (const part of TRANSFORM_URL_PARTS) {
    if (plain.includes(part)) {
      throw new Error(`변환 URL이 본문에 남아 있습니다. ${part}`);
    }
  }
  if (plain.includes("upload.cafenono.com")) {
    throw new Error("카페노노 이미지 URL이 본문에 남아 있습니다.");
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

async function downloadOriginalImage(image) {
  const url = originalImageUrl(image.imageKey);
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
      referer: "https://slashpage.com/",
    },
  });
  if (!response.ok) throw new Error(`이미지 HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const expected = Number(image.originalContentLength) || EXPECTED_IMAGE_BYTES;
  if (bytes.length !== expected) {
    throw new Error(`이미지 바이트 수가 다릅니다. ${bytes.length}`);
  }
  if (
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    throw new Error("PNG 시그니처가 아닙니다.");
  }
  const mime = imageMime(bytes, response.headers.get("content-type"));
  const dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  if (!dataUrl.startsWith("data:image/png;base64,")) {
    throw new Error("이미지가 PNG data URL이 아닙니다.");
  }
  if (!hasNoExpiredUrl(dataUrl)) {
    throw new Error("만료 URL이 이미지 데이터에 남아 있습니다.");
  }
  return dataUrl;
}

async function resolveMedia(blockMap) {
  const media = new Map();
  for (const block of allBlocks(blockMap)) {
    if (block.type !== "image") continue;
    const image = block.value?.image || {};
    if (isChromeImage(image)) continue;
    media.set(block.id, await downloadOriginalImage(image));
  }
  if (media.size !== EXPECTED_IMAGES) {
    throw new Error(`변환한 이미지 수가 다릅니다. ${media.size}`);
  }
  return media;
}

async function resolveAttachments(blockMap) {
  const files = new Map();
  for (const block of attachmentBlocks(blockMap)) {
    const { filename, key, path } = fileRecord(block);
    if (block.type === "zip" || /\.zip$/i.test(filename)) {
      throw new Error("ZIP 첨부는 page-attachment-storage 화이트리스트가 필요합니다.");
    }
    const url = key ? originalImageUrl(key) : path;
    if (!url) throw new Error(`첨부 URL이 없습니다. ${block.id}`);
    if (url.startsWith("data:")) {
      if (!hasNoExpiredUrl(url)) {
        throw new Error(`만료 URL 첨부를 저장할 수 없습니다. ${filename}`);
      }
      files.set(block.id, `[${filename}](${url})`);
      continue;
    }
    const response = await fetch(stripTracking(url), {
      headers: {
        "user-agent": "Mozilla/5.0",
        referer: "https://slashpage.com/",
      },
    });
    if (!response.ok) throw new Error(`첨부 HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (isZipBytes(bytes, filename)) {
      throw new Error("ZIP 첨부는 page-attachment-storage 화이트리스트가 필요합니다.");
    }
    files.set(
      block.id,
      assertDownloadableAttachment(
        filename,
        bytes,
        response.headers.get("content-type")
      )
    );
  }
  return files;
}

function snapshotOf(payload) {
  const data = payload?.data ?? payload;
  const snapshot = data?.snapshot;
  if (!snapshot?.blockMap || !snapshot?.blockTree) {
    throw new Error("Slashpage snapshot이 없습니다.");
  }
  return snapshot;
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
  const media = await resolveMedia(blockMap);
  const files = await resolveAttachments(blockMap);
  const body = blocksToMarkdown(blockTree, blockMap, media, files);
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
