// tuemarz 공개 Notion LLM 카운슬 설치 가이드를 Pages에만 저장한다.
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import {
  buildMarkdown,
  documentStats,
  imageMime,
  inlineMarkdown,
  plainText,
} from "./import-claude-eli5-page.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
export const SPACE_ID = "44b9d169-a795-4d3d-a9a9-bf9ab8070759";
export const COOKIE_RELATIVE = "tmp/notion-kst-20260920/cookies.txt";
const COOKIE_PATH = resolve(root, COOKIE_RELATIVE);
const NOTION_ENDPOINT = "https://www.notion.so/api/v3/loadPageChunk";
const SIGNED_FILE_ENDPOINT = "https://www.notion.so/api/v3/getSignedFileUrls";
const retryDelays = [15000, 30000, 60000];
let lastRequestAt = 0;
let cachedCookie;
const TRACKING_KEY = ["fb", "clid"].join("");
const EXPIRED_URL_PARTS = [
  "prod-files-secure",
  "file.notion.so",
  "expirationTimestamp",
  "X-Amz",
  "blob:",
  TRACKING_KEY,
  "utm_source",
];

export const TARGET = {
  key: "tuemarz-llm-council",
  title: "카파시의 자문단(LLM 카운슬) 설치 가이드",
  hex: "400137c926d581cfb48dfa836bf7a8dd",
  pageId: "400137c9-26d5-81cf-b48d-fa836bf7a8dd",
  sourceUrl:
    "https://tuemarz.notion.site/LLM-400137c926d581cfb48dfa836bf7a8dd",
  images: 6,
  attachments: 0,
  root: 59,
  tables: 2,
  codes: 3,
  dividers: 7,
  imageFiles: [
    "01_karpathy.jpg",
    "02_llm_council.jpg",
    "03_skill_repo.jpg",
    "04_five_advisors.jpg",
    "06_skill_upload.jpg",
    "05_result.jpg",
  ],
  imageBytes: [127233, 123834, 103567, 247942, 63791, 170464],
  phrases: [
    "다들 클로드를 잘못 쓰고 있었다",
    "한눈에 보기",
    "다섯 명의 자문",
    "1. 설치하기",
    "클로드 앱 (웹·데스크톱)",
    "council this",
    "항목",
    "자문",
  ],
  requiredHrefs: [
    "https://www.youtube.com/@builderjoshkim?sub_confirmation=1",
    "https://maily.so/josh",
    "https://joshua.site/contact",
    "https://www.solopreneur.co.kr/",
    "https://skill.md",
    "https://github.com/aiwithremy/claude-skills-llm-council/blob/main/SKILL.md",
    "https://claude.ai/new#customize/skills",
    "https://github.com/aiwithremy/claude-skills-llm-council",
    "https://github.com/karpathy/llm-council",
    "https://youtube.com/shorts/wS9rrwRImTg",
    "https://www.instagram.com/reel/Dewga9usbsU/",
  ],
};

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

const pause = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function redact(value) {
  return String(value ?? "").replace(/https?:\/\/\S+/g, "[url]");
}

function dropsXShareQuery(hostname) {
  const host = String(hostname ?? "").toLowerCase();
  return (
    host === "x.com" ||
    host === "twitter.com" ||
    host.endsWith(".x.com") ||
    host.endsWith(".twitter.com")
  );
}

function keepsHttp(hostname) {
  const host = String(hostname ?? "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1";
}

/** 유입 추적 쿼리를 빼고 localhost가 아닌 http는 https로 바꾼다. */
export function stripTracking(url, base) {
  if (!url) return url;
  if (String(url).startsWith("data:")) return url;
  if (String(url).startsWith("/api/page-attachments/")) return url;
  try {
    const parsed = new URL(url, base);
    if (parsed.hostname === "l.threads.com") {
      const target = parsed.searchParams.get("u");
      if (target) return stripTracking(target, base);
    }
    if (parsed.protocol === "http:" && !keepsHttp(parsed.hostname)) {
      parsed.protocol = "https:";
    }
    if (
      parsed.hostname === "instagram.com" ||
      parsed.hostname === "www.instagram.com"
    ) {
      parsed.hostname = "www.instagram.com";
      if (parsed.pathname.length > 1) {
        parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
      }
    }
    for (const key of [...parsed.searchParams.keys()]) {
      const value = parsed.searchParams.get(key);
      if (
        key.startsWith("utm_") ||
        key === TRACKING_KEY ||
        key === "pvs" ||
        key === "igsh" ||
        key === "gclid" ||
        key === "mcp_token" ||
        (key === "m" && value === "1") ||
        (key === "from" && ["dm", "littly", "guide"].includes(value)) ||
        (key === "source" && value === "copy_link") ||
        (key === "s" && dropsXShareQuery(parsed.hostname))
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
      .replace(/^http:\/\/(?!(?:localhost|127\.0\.0\.1)(?:[:/]|$))/i, "https://")
      .replace(
        new RegExp(
          `[?&](?:utm_[^=&#]*|${TRACKING_KEY}|pvs|igsh|gclid|mcp_token)=[^&\\s)#]*`,
          "g"
        ),
        ""
      )
      .replace(/[?&]m=1(?=&|$)/g, "")
      .replace(/[?&]from=(?:dm|littly|guide)(?=&|$)/g, "")
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

/** 제목 또는 source_url이 정확히 같으면 중복이다. */
export function isDuplicateRow(row, title, sourceUrl) {
  if (!row) return false;
  if (row.title === title) return true;
  return Boolean(sourceUrl) && row.source_url === sourceUrl;
}

/** 이미지 alt에 대괄호와 줄바꿈이 들어가면 그림 줄이 깨진다. */
export function plainImageAlt(value) {
  return plainText(value).replace(/[\]\r\n]/g, " ").replace(/\s+/g, " ").trim();
}

/** 링크가 들어 있던 캡션을 이미지 다음 문단으로 되돌린다. */
export function restoreCaptionLinks(markdown, items) {
  let text = String(markdown);
  for (const item of items) {
    const needle = `![${item.alt}](`;
    const index = text.indexOf(needle);
    if (index < 0) throw new Error("캡션을 붙일 이미지를 찾지 못했습니다.");
    const lineEnd = text.indexOf("\n", index);
    const at = lineEnd === -1 ? text.length : lineEnd;
    const line = text.slice(index, at).replace(needle, `![${item.alt}\u200b](`);
    text = `${text.slice(0, index)}${line}\n\n${item.caption}${text.slice(at)}`;
  }
  return text.replace(/\u200b/g, "");
}

/** 코드 펜스 밖의 맨 URL을 링크로 바꾸고, 기존 링크의 추적 쿼리를 뺀다. */
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

function notionCookie() {
  if (cachedCookie != null) return cachedCookie;
  if (!existsSync(COOKIE_PATH)) {
    throw new Error(`Notion 쿠키가 없습니다. ${COOKIE_RELATIVE}`);
  }
  const raw = readFileSync(COOKIE_PATH, "utf8").trim();
  if (!raw) throw new Error(`Notion 쿠키가 없습니다. ${COOKIE_RELATIVE}`);
  cachedCookie = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .join("; ");
  return cachedCookie;
}

function publicHeaders() {
  return { referer: "https://www.notion.so/", "user-agent": "Mozilla/5.0" };
}

function mediaHeaders() {
  return { ...publicHeaders(), cookie: notionCookie() };
}

async function pace() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < 1200) await pause(1200 - elapsed);
  lastRequestAt = Date.now();
}

async function requestJson(endpoint, body, withCookie) {
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    await pace();
    const headers = {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0",
    };
    if (withCookie) headers.cookie = notionCookie();
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (response.ok) return response.json();
    const message = await response.text();
    if (![429, 503].includes(response.status) || attempt === retryDelays.length) {
      throw new Error(
        `Notion HTTP ${response.status}. ${redact(message).slice(0, 180)}`
      );
    }
    await pause(retryDelays[attempt]);
  }
  throw new Error("Notion 요청 실패.");
}

async function requestChunk(id, cursor = { stack: [] }, chunkNumber = 0) {
  return requestJson(NOTION_ENDPOINT, {
    page: { id },
    limit: 100,
    cursor,
    chunkNumber,
    verticalColumns: false,
  });
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

async function collectBlocks(pageId) {
  const blocks = new Map();
  let cursor = { stack: [] };
  let chunkNumber = 0;
  do {
    const chunk = await requestChunk(pageId, cursor, chunkNumber);
    absorbChunk(blocks, chunk);
    cursor = chunk.cursor ?? { stack: [] };
    chunkNumber += 1;
    if (chunkNumber > 20) throw new Error("페이지 청크가 너무 많습니다.");
  } while (cursor.stack?.length);
  return blocks;
}

function sourceOf(block) {
  return (
    plainText(block?.properties?.source) ||
    block?.format?.display_source ||
    block?.format?.original_url ||
    ""
  );
}

function imageNameOf(block) {
  const source = sourceOf(block);
  if (source.startsWith("attachment:")) {
    const raw = source.split(":").at(-1) ?? "";
    try {
      return decodeURIComponent(raw).trim().normalize("NFC");
    } catch {
      return raw.trim().normalize("NFC");
    }
  }
  const path = source.split("?")[0].split("/").pop() ?? "";
  try {
    return decodeURIComponent(path).normalize("NFC");
  } catch {
    return path.normalize("NFC");
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
  const owned = subtreeIds(blocks, pageId);
  let missing = 0;
  for (const [id, block] of blocks) {
    if (!owned.has(id)) continue;
    if (block.type === "page" && id !== pageId) continue;
    for (const childId of block.content ?? []) {
      if (!blocks.has(childId)) missing += 1;
    }
  }
  return missing;
}

function countType(blocks, type) {
  let count = 0;
  for (const block of blocks.values()) {
    if (block.type === type) count += 1;
  }
  return count;
}

function imageBlocksInOrder(blocks, pageId) {
  const found = [];
  function visit(id) {
    const block = blocks.get(id);
    if (!block) return;
    if (block.type === "page" && id !== pageId) return;
    if (block.type === "image") found.push(block);
    for (const childId of block.content ?? []) visit(childId);
  }
  visit(pageId);
  return found;
}

function dataUrlFromBytes(bytes, header, hint = "") {
  const dataUrl = `data:${imageMime(bytes, header)};base64,${Buffer.from(bytes).toString("base64")}`;
  if (!hasNoExpiredUrl(dataUrl)) {
    throw new Error("만료 URL이 이미지 데이터에 남아 있습니다.");
  }
  if (!dataUrl.startsWith("data:image/jpeg")) {
    throw new Error("이미지 src가 jpeg data URL이 아닙니다.");
  }
  return dataUrl;
}

function notionImageUrl(url, block, withIds) {
  const params = new URLSearchParams();
  params.set("table", "block");
  params.set("id", withIds ? block.id : "");
  params.set("spaceId", withIds ? block.space_id || SPACE_ID : "");
  params.set("width", "2000");
  params.set("cache", "v2");
  return `https://www.notion.so/image/${encodeURIComponent(url)}?${params}`;
}

async function fetchOk(url, headers) {
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    await pace();
    const response = await fetch(url, { headers });
    if (response.ok) return response;
    await response.arrayBuffer().catch(() => {});
    if (![429, 503].includes(response.status) || attempt === retryDelays.length) {
      return response;
    }
    await pause(retryDelays[attempt]);
  }
  throw new Error("이미지 요청 실패.");
}

function signedUrlValue(value) {
  if (typeof value === "string") return value;
  if (value && typeof value.url === "string") return value.url;
  return "";
}

async function signedImageDataUrl(block, url) {
  const signed = await requestJson(
    SIGNED_FILE_ENDPOINT,
    {
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
    },
    true
  );
  const signedUrl = signedUrlValue(signed.signedUrls?.[0]);
  if (!signedUrl) throw new Error(`서명 URL을 받지 못했습니다. ${block.id}`);
  let response;
  try {
    await pace();
    response = await fetch(signedUrl);
  } catch {
    throw new Error(`이미지 다운로드에 실패했습니다. ${block.id}`);
  }
  if (!response.ok) {
    await response.arrayBuffer().catch(() => {});
    throw new Error(`이미지 HTTP ${response.status}. ${block.id}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    dataUrl: dataUrlFromBytes(
      bytes,
      response.headers.get("content-type"),
      imageNameOf(block)
    ),
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

async function imageDataUrl(url, block) {
  const hint = imageNameOf(block);
  let lastStatus = 0;
  const response = await fetchOk(notionImageUrl(url, block, true), publicHeaders());
  lastStatus = response.status;
  if (response.ok) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      dataUrl: dataUrlFromBytes(bytes, response.headers.get("content-type"), hint),
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  }
  await response.arrayBuffer().catch(() => {});
  if (response.status === 422 || response.status === 403 || response.status === 400) {
    return signedImageDataUrl(block, url);
  }
  throw new Error(`이미지 HTTP ${lastStatus || 0}. ${block.id}`);
}

async function resolveMedia(blocks, pageId) {
  const media = new Map();
  const names = [];
  const sizes = [];
  const hashes = [];
  for (const block of imageBlocksInOrder(blocks, pageId)) {
    const url = sourceOf(block);
    if (!url) throw new Error(`이미지 URL이 없습니다. ${block.id}`);
    const downloaded = await imageDataUrl(url, block);
    media.set(block.id, downloaded.dataUrl);
    names.push(imageNameOf(block));
    sizes.push(downloaded.bytes);
    hashes.push(downloaded.sha256);
  }
  return { media, names, sizes, hashes };
}

function liftImageCaptions(blocks, pageId) {
  const items = [];
  for (const block of imageBlocksInOrder(blocks, pageId)) {
    const caption = block.properties?.caption;
    const rendered = inlineMarkdown(caption).trim();
    if (!rendered.includes("]")) continue;
    const alt = plainImageAlt(caption) || imageNameOf(block) || "Notion 이미지";
    block.properties = {
      ...(block.properties || {}),
      caption: [[alt]],
    };
    if (rendered.includes("](")) items.push({ alt, caption: rendered });
  }
  return items;
}

function finalizeMarkdown(markdown, captions) {
  return autolinkBareUrls(restoreCaptionLinks(markdown, captions));
}

function imageSourcesOf(content) {
  const sources = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "image") sources.push(String(node.attrs?.src ?? ""));
    for (const child of node.content ?? []) visit(child);
  }
  visit(JSON.parse(content));
  return sources;
}

function countNodes(content, type) {
  let count = 0;
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === type) count += 1;
    for (const child of node.content ?? []) visit(child);
  }
  visit(JSON.parse(content));
  return count;
}

function assertIntegrity({ spec, page, blocks, pageTitle, markdown, stats, content, images }) {
  if (pageTitle !== spec.title) throw new Error(`페이지 제목이 다릅니다. ${pageTitle}`);
  if (!markdown.startsWith(`# ${spec.title}`)) {
    throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
  }
  if (!markdown.includes(spec.sourceUrl)) throw new Error("원문 주소가 없습니다.");
  if (!markdown.includes(spec.hex)) throw new Error("페이지 hex가 없습니다.");
  if ((page.content || []).length !== spec.root) {
    throw new Error(`루트 자식 수가 다릅니다. ${(page.content || []).length}`);
  }
  if (missingChildCount(blocks, spec.pageId) !== 0) {
    throw new Error("빠진 자식 블록이 있습니다.");
  }
  if (countType(blocks, "image") !== spec.images) {
    throw new Error(`이미지 블록 수가 다릅니다. ${countType(blocks, "image")}`);
  }
  if (countType(blocks, "file") !== 0 || countType(blocks, "pdf") !== 0) {
    throw new Error("첨부 블록이 있습니다.");
  }
  if (countType(blocks, "divider") !== spec.dividers) {
    throw new Error(`구분선 수가 다릅니다. ${countType(blocks, "divider")}`);
  }
  if (images.names.join("\n") !== spec.imageFiles.join("\n")) {
    throw new Error(`이미지 파일명이 다릅니다. ${images.names.join(", ")}`);
  }
  if (images.sizes.join(",") !== spec.imageBytes.join(",")) {
    throw new Error(`이미지 바이트가 다릅니다. ${images.sizes.join(", ")}`);
  }
  if (stats.images !== spec.images) {
    throw new Error(`TipTap 이미지 수가 다릅니다. ${stats.images}`);
  }
  if (stats.tables !== spec.tables) {
    throw new Error(`TipTap 표 수가 다릅니다. ${stats.tables}`);
  }
  if (stats.codes !== spec.codes) {
    throw new Error(`TipTap 코드 수가 다릅니다. ${stats.codes}`);
  }
  if (stats.attachments !== spec.attachments) {
    throw new Error(`TipTap 첨부 수가 다릅니다. ${stats.attachments}`);
  }
  if (countNodes(content, "horizontalRule") !== spec.dividers) {
    throw new Error(
      `구분선 노드 수가 다릅니다. ${countNodes(content, "horizontalRule")}`
    );
  }
  for (const src of imageSourcesOf(content)) {
    if (!src.startsWith("data:image/jpeg")) {
      throw new Error("이미지 src가 jpeg data URL이 아닙니다.");
    }
  }
  for (const phrase of spec.phrases) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(content)) {
    throw new Error("만료 URL이 본문에 남아 있습니다.");
  }
  const hrefs = stats.hrefs.map((href) => stripTracking(href));
  for (const href of [spec.sourceUrl, ...spec.requiredHrefs]) {
    if (!hrefs.includes(stripTracking(href))) {
      const visible = hrefs
        .filter((item) => !item.startsWith("data:") && hasNoExpiredUrl(item))
        .join(" ");
      throw new Error(`링크가 없습니다. ${href}. have=${visible}`);
    }
  }
  if (markdown.includes("source=copy_link") || content.includes(TRACKING_KEY)) {
    throw new Error("추적 쿼리가 본문에 남아 있습니다.");
  }
}

function sqliteHasFindability(db) {
  const cols = db
    .prepare("PRAGMA table_info(custom_pages)")
    .all()
    .map((column) => column.name);
  return ["tags", "source_url", "search_text", "is_favorite"].every((name) =>
    cols.includes(name)
  );
}

function pageColumns(db) {
  return db
    .prepare("PRAGMA table_info(custom_pages)")
    .all()
    .map((column) => column.name);
}

function findLocalPage(db, title, sourceUrl) {
  const cols = pageColumns(db);
  const fields = ["id", "title"];
  if (cols.includes("source_url")) fields.push("source_url");
  const select = fields.join(", ");
  const byTitle = db
    .prepare(`SELECT ${select} FROM custom_pages WHERE user_id = ? AND title = ?`)
    .get(LOCAL_USER, title);
  if (isDuplicateRow(byTitle, title, sourceUrl)) return byTitle;
  if (!cols.includes("source_url") || !sourceUrl) return null;
  const bySource = db
    .prepare(
      `SELECT ${select} FROM custom_pages WHERE user_id = ? AND source_url = ? LIMIT 1`
    )
    .get(LOCAL_USER, sourceUrl);
  if (isDuplicateRow(bySource, title, sourceUrl)) return bySource;
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

function importLocal(page, sourceUrl, libs) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  const existing = findLocalPage(db, page.title, sourceUrl);
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
  const byTitle = await supabase
    .from("custom_pages")
    .select("id, title")
    .eq("user_id", PROD_USER)
    .eq("title", title)
    .limit(1);
  if (byTitle.error) throw byTitle.error;
  if (byTitle.data?.[0]) return byTitle.data[0];
  if (!sourceUrl) return null;
  const bySource = await supabase
    .from("custom_pages")
    .select("id, title")
    .eq("user_id", PROD_USER)
    .eq("source_url", sourceUrl)
    .limit(1);
  if (bySource.error) throw bySource.error;
  return bySource.data?.[0] ?? null;
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
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  const existing = await findProductionPage(supabase, page.title, page.sourceUrl);
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

function pageAction(result) {
  if (result.pages) return "insert";
  return "skip";
}

async function persist(content, extra, libs) {
  const now = new Date().toISOString();
  const sourceUrl = stripTracking(TARGET.sourceUrl);
  const record = {
    id: randomUUID(),
    title: TARGET.title,
    content,
    sourceUrl,
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record, sourceUrl, libs);
  record.id = local.pageId;
  let production;
  try {
    production = await importProduction(record, libs);
  } catch (error) {
    if (local.pages === 1) {
      const db = new Database(resolve(root, "data/mymark.db"));
      db.prepare("DELETE FROM custom_pages WHERE id = ? AND user_id = ?").run(
        record.id,
        LOCAL_USER
      );
      db.close();
    }
    throw error;
  }
  const pageId = production.pageId || local.pageId;
  return {
    ...extra,
    pageId,
    path: `/pages/${pageId}`,
    createdAt: now,
    local: { action: pageAction(local), pages: local.pages, pageSkips: local.pageSkips },
    production: {
      action: pageAction(production),
      pages: production.pages,
      pageSkips: production.pageSkips,
    },
  };
}

async function savedOnBothSides() {
  const sourceUrl = stripTracking(TARGET.sourceUrl);
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  let local = null;
  try {
    local = findLocalPage(db, TARGET.title, sourceUrl);
  } finally {
    db.close();
  }
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const production = await findProductionPage(supabase, TARGET.title, sourceUrl);
  if (!local && !production) return null;
  if (!local || !production) {
    throw new Error(`로컬과 운영 중 한쪽에만 글이 있습니다. ${sourceUrl}`);
  }
  if (local.id !== production.id) {
    throw new Error(`로컬과 운영의 페이지 id가 다릅니다. ${sourceUrl}`);
  }
  return {
    key: TARGET.key,
    pageTitle: TARGET.title,
    pageId: local.id,
    path: `/pages/${local.id}`,
    local: { action: "skip", pages: 0, pageSkips: 1 },
    production: { action: "skip", pages: 0, pageSkips: 1 },
  };
}

async function importTarget(checkOnly, libs) {
  const loaded = await collectBlocks(TARGET.pageId);
  if (missingChildCount(loaded, TARGET.pageId) !== 0) {
    throw new Error("빠진 자식 블록이 있습니다.");
  }
  const blocks = keepSubtree(loaded, TARGET.pageId);
  const page = blocks.get(TARGET.pageId);
  if (!page) throw new Error("Notion 페이지를 찾지 못했습니다.");
  const images = await resolveMedia(blocks, TARGET.pageId);
  const captions = liftImageCaptions(blocks, TARGET.pageId);
  const built = buildMarkdown(
    blocks,
    TARGET.pageId,
    TARGET.sourceUrl,
    images.media,
    new Map()
  );
  const markdown = finalizeMarkdown(built.markdown, captions);
  const pageTitle = plainText(page.properties?.title).trim();
  const document = libs.markdownToTiptapDoc(markdown);
  const content = JSON.stringify(document);
  const stats = documentStats(content);
  assertIntegrity({
    spec: TARGET,
    page,
    blocks,
    pageTitle,
    markdown,
    stats,
    content,
    images,
  });
  const extra = {
    key: TARGET.key,
    pageTitle: TARGET.title,
    codes: stats.codes,
    tables: stats.tables,
    images: stats.images,
    attachments: stats.attachments,
    links: stats.links,
    dividers: countNodes(content, "horizontalRule"),
    root: (page.content || []).length,
    length: content.length,
    hash: createHash("sha256").update(content).digest("hex"),
    imageBytes: images.sizes,
    imageSha256: images.hashes,
  };
  if (checkOnly) return extra;
  return persist(content, extra, libs);
}

function emit(value) {
  const output = JSON.stringify(value, null, 2);
  if (output.includes("data:")) throw new Error("로그에 data URL이 있습니다.");
  if (!hasNoExpiredUrl(output)) throw new Error("로그에 만료 URL이 있습니다.");
  console.log(output);
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const libs = loadLibs();
  if (!checkOnly) {
    const saved = await savedOnBothSides();
    if (saved) {
      emit(saved);
      return;
    }
  }
  emit(await importTarget(checkOnly, libs));
}

const isDirect =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) await main();
