// 티스토리 Jev 글과 Notion Jev 사례 15개를 Pages에만 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import Database from "better-sqlite3";
import TurndownService from "turndown";
import {
  assertDownloadableAttachment,
  buildMarkdown,
  documentStats,
  fileNameOf,
  imageMime,
  plainText,
} from "./import-claude-eli5-page.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const SPACE_ID = "b97fd99f-0e5f-81d6-b46e-0003ed3b57b7";
const COOKIE_RELATIVE = "tmp/notion-jev-15/cookies.txt";
const COOKIE_PATH = resolve(root, COOKIE_RELATIVE);
const NOTION_ENDPOINT = "https://www.notion.so/api/v3/loadPageChunk";
const SIGNED_FILE_ENDPOINT = "https://www.notion.so/api/v3/getSignedFileUrls";
const PARENT_PAGE_ID = "d60fd99f-0e5f-8295-a947-81c6fd0e9948";
const retryDelays = [15000, 30000, 60000];
let lastRequestAt = 0;
let cachedCookie;
const EXPIRED_URL_PARTS = [
  "prod-files-secure",
  "file.notion.so",
  "expirationTimestamp",
  "X-Amz",
  "blob:",
  "fbclid",
  "utm_source",
  "credential=",
  "expires=",
  "signature=",
];
const TISTORY_RELATED_PATHS = new Set(["/17", "/18", "/19", "/21", "/22"]);

export const TARGETS = [
  {
    key: "tistory",
    kind: "tistory",
    title:
      "글도 못 쓰는 AI가 왜 난리? Jev로 논문 1,018편 분류하고, 게임까지 돌린 사람들",
    sourceUrl: "https://seo2-heimish.tistory.com/20",
    images: 5,
    attachments: 0,
    root: 0,
    tables: 2,
    codes: 4,
    phrases: [
      "글을 못 쓰는 AI",
      "논문 1,018편",
      "이메일 500개",
      "0.035달러",
    ],
    requiredHrefs: [
      "https://typesafe.ai/",
      "https://console.typesafe.ai/",
      "https://docs.typesafe.ai/introduction/quickstart",
      "https://x.com/VaibhavSisinty/status/2100619666049929400",
      "https://x.com/gregpr07/status/2100411066966749359",
      "https://www.threads.com/@choi.openai/post/DdV86hfD8wZ",
      "https://every.to/also-true-for-humans/mini-vibe-check-typesafe-s-jev-judged-everything-i-ve-written-in-0-7-seconds",
      "https://github.com/browser-use/jev-ultrafast",
      "https://git-scm.com/install/",
      "https://docs.astral.sh/uv/getting-started/installation/",
      "https://maily.so/choi.gpt.ai",
    ],
    forbidden: [
      "반응형",
      "카테고리의 다른 글",
      "seo2-heimish.tistory.com/22",
      "seo2-heimish.tistory.com/21",
      "seo2-heimish.tistory.com/19",
      "seo2-heimish.tistory.com/18",
      "seo2-heimish.tistory.com/17",
      "/category/AI",
    ],
  },
  {
    key: "notion",
    kind: "notion",
    title: "Jev 활용 사례 15개 정리본",
    hex: "3e1fd99f0e5f81df86b7feae226dca6e",
    pageId: "3e1fd99f-0e5f-81df-86b7-feae226dca6e",
    sourceUrl: "https://app.notion.com/p/Jev-15-3e1fd99f0e5f81df86b7feae226dca6e",
    images: 3,
    attachments: 7,
    root: 87,
    tables: 2,
    codes: 0,
    phrases: [
      "30초 팩트",
      "사례 15개 한눈에",
      "광고 724개",
      "논문 1,018개",
    ],
    requiredHrefs: [
      "https://typesafe.ai/",
      "https://docs.typesafe.ai/",
      "https://github.com/browser-use/jev-ultrafast",
      "https://madewithjev.com/",
      "https://www.instagram.com/prompt_what",
      "https://x.com/TheMattBerman/status/2100654891756589230",
    ],
    videos: [
      { name: "jev-01-announce.mp4", bytes: 598651 },
      { name: "jev-02-193x.mp4", bytes: 964714 },
      { name: "jev-03-ads724.mp4", bytes: 691973 },
      { name: "jev-04-flight.mp4", bytes: 200696 },
      { name: "jev-05-mario.mp4", bytes: 337038 },
      { name: "jev-06-doom.mp4", bytes: 357145 },
      { name: "jev-07-fraud.mp4", bytes: 496920 },
    ],
    imageNames: [
      "jev-08-primitives.png",
      "jev-09-models.png",
      "jev-10-cta.png",
    ],
  },
];

export const EXPECTED_IMAGES = Object.fromEntries(
  TARGETS.map((item) => [item.key, item.images])
);

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

function isTrackingParam(key, value) {
  return (
    key.startsWith("utm_") ||
    key === "fbclid" ||
    key === "pvs" ||
    key === "igsh" ||
    key === "mcp_token" ||
    (key === "source" && value === "copy_link") ||
    (key === "m" && value === "1")
  );
}

/** 유입 추적 쿼리를 빼고 http는 https로 바꾼다. 티스토리 /m/은 데스크톱 경로로 돌린다. */
export function stripTracking(url, base) {
  if (!url) return url;
  if (String(url).startsWith("data:") || String(url).startsWith("mailto:")) {
    return url;
  }
  try {
    const parsed = new URL(url, base);
    if (parsed.protocol === "http:") parsed.protocol = "https:";
    if (
      /\.tistory\.com$/i.test(parsed.hostname) &&
      (parsed.pathname === "/m" || parsed.pathname.startsWith("/m/"))
    ) {
      parsed.pathname = parsed.pathname.replace(/^\/m(?=\/|$)/, "") || "/";
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
      if (isTrackingParam(key, value)) parsed.searchParams.delete(key);
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
      .replace(/([./])m\//, "$1")
      .replace(/[?&](?:utm_[^=&#]*|fbclid|pvs|igsh|mcp_token)=[^&\s)#]*/g, "")
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

/** 제목 또는 원문 주소가 같으면 중복이다. content는 보지 않는다. */
export function isDuplicateRow(row, title, markers) {
  if (!row) return false;
  if (row.title === title) return true;
  const source = stripTracking(row.source_url || "");
  return markers.some((marker) => {
    if (!marker) return false;
    const cleaned = stripTracking(marker);
    return row.source_url === marker || source === marker || source === cleaned;
  });
}

/** 이미 링크가 아닌 맨 http(s) URL을 마크다운 링크로 바꾼다. */
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
            const trimmed = bare
              .replace(/[가-힣]+$/u, "")
              .replace(/[.,;:!?]+$/u, "");
            const cleaned = stripTracking(trimmed);
            return `[${cleaned}](${cleaned})`;
          }
          if (href && /^(https?:|mailto:)/i.test(href)) {
            return `${prefix}${stripTracking(href)}${suffix}`;
          }
          return match;
        }
      );
    })
    .join("");
}

function getBlock(blocks, id) {
  if (!blocks || id == null) return null;
  if (typeof blocks.get === "function") return blocks.get(id) ?? null;
  return blocks[id] ?? null;
}

function blockFromRecord(record) {
  const nested = record?.value?.value;
  if (nested && typeof nested === "object" && nested.type) return nested;
  const value = record?.value;
  if (value && typeof value === "object" && value.type) return value;
  return null;
}

function countType(blocks, type) {
  let count = 0;
  for (const block of blocks.values()) {
    if (block.type === type) count += 1;
  }
  return count;
}

function attachmentCount(blocks) {
  let count = 0;
  for (const block of blocks.values()) {
    if (block.type === "file" || block.type === "pdf") count += 1;
  }
  return count;
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

function storedTitleOf(title) {
  return String(title ?? "").trim();
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

function looksLikeSvg(bytes, hint = "") {
  if (/\.svg(?:$|[?#])/i.test(String(hint))) return true;
  const head = Buffer.from(bytes.subarray(0, 512)).toString("utf8");
  return /<svg[\s>/]/i.test(head);
}

/** SVG는 image MIME이 아니어도 data URL로 넣는다. */
function imageMimeOf(bytes, header, hint = "") {
  if (looksLikeSvg(bytes, hint) || /svg/i.test(String(header ?? ""))) {
    return "image/svg+xml";
  }
  return imageMime(bytes, header);
}

/** 북마크와 할 일을 마크다운이 알아먹는 형태로 바꾼다. */
function preprocessBlocks(blocks) {
  for (const block of blocks.values()) {
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

function finalizeMarkdown(markdown, spec) {
  let text = String(markdown);
  if (text.startsWith("# ")) {
    const newline = text.indexOf("\n");
    text = `# ${spec.title}${newline === -1 ? "" : text.slice(newline)}`;
  }
  return autolinkBareUrls(text);
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

function loadLibs() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(
    resolve(root, "src/lib/markdown-to-tiptap.ts")
  );
  const { extractPageMediaReferences } = require(
    resolve(root, "src/lib/page-attachment-storage.ts")
  );
  const { preparePageFindability, isMissingPageFindabilityColumn } = require(
    resolve(root, "src/lib/page-findability.ts")
  );
  return {
    markdownToTiptapDoc,
    extractPageMediaReferences,
    preparePageFindability,
    isMissingPageFindabilityColumn,
  };
}

/** 로그인 쿠키는 요청 시에만 읽고 값은 출력하지 않는다. */
function notionCookie() {
  if (cachedCookie != null) return cachedCookie;
  if (!existsSync(COOKIE_PATH)) {
    throw new Error(`Notion 쿠키가 없습니다. ${COOKIE_RELATIVE}`);
  }
  const raw = readFileSync(COOKIE_PATH, "utf8").trim();
  if (!raw) {
    throw new Error(`Notion 쿠키가 없습니다. ${COOKIE_RELATIVE}`);
  }
  cachedCookie = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .join("; ");
  return cachedCookie;
}

function mediaHeaders() {
  return {
    referer: "https://www.notion.so/",
    "user-agent": "Mozilla/5.0",
    cookie: notionCookie(),
  };
}

async function requestJson(endpoint, body) {
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < 1200) await pause(1200 - elapsed);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0",
        cookie: notionCookie(),
      },
      body: JSON.stringify(body),
    });
    lastRequestAt = Date.now();
    if (response.ok) return response.json();
    const message = await response.text();
    if (
      ![429, 500, 502, 503].includes(response.status) ||
      attempt === retryDelays.length
    ) {
      throw new Error(`Notion HTTP ${response.status}. ${message.slice(0, 300)}`);
    }
    await pause(retryDelays[attempt]);
  }
  throw new Error("Notion 요청 실패.");
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
    if (block?.type) blocks.set(id, block);
  }
}

function parentsWithMissingChildren(blocks, fetched, pageId) {
  const ids = [];
  for (const block of blocks.values()) {
    if (!block.id || fetched.has(block.id)) continue;
    if (block.type === "page" && block.id !== pageId) continue;
    if ((block.content ?? []).some((childId) => !blocks.has(childId))) {
      ids.push(block.id);
    }
  }
  return ids;
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
  } while (cursor.stack?.length);

  const fetched = new Set([pageId]);
  let queue = parentsWithMissingChildren(blocks, fetched, pageId);
  while (queue.length) {
    const id = queue.shift();
    if (fetched.has(id)) continue;
    fetched.add(id);
    const chunk = await requestChunk(id);
    absorbChunk(blocks, chunk);
    queue = parentsWithMissingChildren(blocks, fetched, pageId);
  }
  return blocks;
}

async function dataUrlFromResponse(response, hint = "") {
  if (!response.ok) throw new Error(`이미지 HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const dataUrl = `data:${imageMimeOf(bytes, response.headers.get("content-type"), hint)};base64,${Buffer.from(bytes).toString("base64")}`;
  if (!hasNoExpiredUrl(dataUrl)) {
    throw new Error("만료 URL이 이미지 데이터에 남아 있습니다.");
  }
  if (!dataUrl.startsWith("data:image/")) {
    throw new Error("이미지 src가 data URL이 아닙니다.");
  }
  return dataUrl;
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
  const signedUrl = signed.signedUrls?.[0];
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

async function fetchWithRetry(url, headers) {
  let lastError = new Error(`HTTP 실패. ${url.slice(0, 80)}`);
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      const response = await fetch(url, { headers });
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
      if (
        ![429, 500, 502, 503].includes(response.status) ||
        attempt === retryDelays.length
      ) {
        return response;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === retryDelays.length) throw lastError;
    }
    await pause(retryDelays[attempt]);
  }
  throw lastError;
}

/** 이미지는 /image/ 래퍼를 먼저 쓰고, 실패하면 서명 URL을 받는다. */
async function fetchMedia(url, block) {
  const headers = mediaHeaders();
  if (url.startsWith("attachment:")) {
    const wrapped = await fetchWithRetry(notionImageUrl(url, block), headers);
    if (wrapped.ok) return wrapped;
    return fetchWithRetry(await signedUrlFor(block, url), headers);
  }
  const absolute = url.startsWith("/") ? `https://www.notion.so${url}` : url;
  return fetchWithRetry(absolute, headers);
}

/** MP4는 /image/ 래퍼가 422라 서명 URL만 받는다. */
async function fetchSignedFile(url, block) {
  const headers = mediaHeaders();
  if (url.startsWith("attachment:")) {
    return fetchWithRetry(await signedUrlFor(block, url), headers);
  }
  const absolute = url.startsWith("/") ? `https://www.notion.so${url}` : url;
  return fetchWithRetry(absolute, headers);
}

async function resolveMedia(blocks) {
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
  return media;
}

/** 영상은 data URL 첨부로 넣고 type을 file로 바꿔 eli5 renderBlock이 처리하게 한다. */
async function resolveAttachments(blocks) {
  const files = new Map();
  const videos = [];
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
      if (isVideo) block.type = "file";
      continue;
    }
    const response = isVideo
      ? await fetchSignedFile(url, block)
      : await fetchMedia(url, block);
    if (!response.ok) throw new Error(`첨부 HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    files.set(
      block.id,
      assertDownloadableAttachment(
        filename,
        bytes,
        response.headers.get("content-type")
      )
    );
    if (isVideo) {
      videos.push({ name: filename, bytes: bytes.length });
      block.type = "file";
    }
  }
  return { files, videos };
}

function extraOf(spec, stats, page, content) {
  return {
    key: spec.key,
    pageTitle: spec.title,
    root: spec.kind === "notion" ? (page?.content || []).length : spec.root,
    images: stats.images,
    attachments: stats.attachments,
    tables: stats.tables,
    codes: stats.codes,
    hrefs: (stats.hrefs ?? [])
      .map((href) => stripTracking(href))
      .filter((href) => href && !href.startsWith("data:")),
    contentBytes: Buffer.byteLength(content, "utf8"),
  };
}

function assertCommonIntegrity(spec, markdown, content, stats) {
  if (!markdown.startsWith(`# ${spec.title}`)) {
    throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
  }
  if (!markdown.includes(spec.sourceUrl) || !content.includes(spec.sourceUrl)) {
    throw new Error("원문 주소가 없습니다.");
  }
  if (stats.images !== spec.images) {
    throw new Error(`TipTap 이미지 수가 다릅니다. ${stats.images}`);
  }
  if (stats.attachments !== spec.attachments) {
    throw new Error(`TipTap 첨부 수가 다릅니다. ${stats.attachments}`);
  }
  const imageSrcs = imageSourcesOf(content);
  if (imageSrcs.length !== spec.images) {
    throw new Error(`본문 이미지 수가 다릅니다. ${imageSrcs.length}`);
  }
  for (const src of imageSrcs) {
    if (!src.startsWith("data:image/")) {
      throw new Error(`이미지 src가 data URL이 아닙니다. ${src.slice(0, 40)}`);
    }
  }
  if (spec.codes != null && stats.codes !== spec.codes) {
    throw new Error(`TipTap 코드 수가 다릅니다. ${stats.codes}`);
  }
  if (spec.tables != null && stats.tables !== spec.tables) {
    throw new Error(`TipTap 표 수가 다릅니다. ${stats.tables}`);
  }
  for (const phrase of spec.phrases ?? []) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  const hrefs = (stats.hrefs ?? []).map((href) => stripTracking(href));
  for (const href of [spec.sourceUrl, ...(spec.requiredHrefs ?? [])]) {
    const want = stripTracking(href);
    if (!hrefs.includes(want)) throw new Error(`링크가 없습니다. ${href}`);
  }
  for (const forbidden of spec.forbidden ?? []) {
    if (markdown.includes(forbidden) || content.includes(forbidden)) {
      throw new Error(`금지 문구가 남아 있습니다. ${forbidden}`);
    }
  }
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(content)) {
    throw new Error("만료 URL이 본문에 남아 있습니다.");
  }
}

function assertNotionIntegrity({
  spec,
  page,
  blocks,
  pageTitle,
  markdown,
  stats,
  content,
  videos,
}) {
  if (spec.pageId === PARENT_PAGE_ID) {
    throw new Error("부모 페이지는 임포트하지 않습니다.");
  }
  if (pageTitle !== spec.title) {
    throw new Error(`페이지 제목이 다릅니다. ${pageTitle}`);
  }
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
  if (countType(blocks, "video") !== 0) {
    throw new Error("video 블록을 file로 바꾸지 못했습니다.");
  }
  if (attachmentCount(blocks) !== spec.attachments) {
    throw new Error(`첨부 블록 수가 다릅니다. ${attachmentCount(blocks)}`);
  }
  if (spec.tables != null && countType(blocks, "table") !== spec.tables) {
    throw new Error(`표 수가 다릅니다. ${countType(blocks, "table")}`);
  }
  const expectedVideos = spec.videos ?? [];
  if (videos.length !== expectedVideos.length) {
    throw new Error(`영상 수가 다릅니다. ${videos.length}`);
  }
  for (const expected of expectedVideos) {
    const got = videos.find((item) => item.name === expected.name);
    if (!got) throw new Error(`영상이 없습니다. ${expected.name}`);
    if (got.bytes !== expected.bytes) {
      throw new Error(
        `영상 바이트가 다릅니다. ${expected.name} ${got.bytes}`
      );
    }
    if (!markdown.includes(expected.name)) {
      throw new Error(`영상 파일명이 본문에 없습니다. ${expected.name}`);
    }
  }
  assertCommonIntegrity(spec, markdown, content, stats);
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

function markersOf(spec) {
  return [spec.sourceUrl, spec.pageId, spec.hex].filter(Boolean);
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

function pageAction(result) {
  if (result.pages) return "insert";
  return "skip";
}

async function persist(spec, content, extra, libs) {
  const now = new Date().toISOString();
  const sourceUrl = stripTracking(spec.sourceUrl);
  const record = {
    id: randomUUID(),
    title: spec.title,
    content,
    sourceUrl,
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record, markersOf(spec), libs);
  record.id = local.pageId;
  const production = await importProduction(record, libs);
  const pageId = production.pageId || local.pageId;
  return {
    ...extra,
    pageId,
    path: `/pages/${pageId}`,
    local: {
      action: pageAction(local),
      pages: local.pages,
      pageSkips: local.pageSkips,
    },
    production: {
      action: pageAction(production),
      pages: production.pages,
      pageSkips: production.pageSkips,
    },
  };
}

function toAbsoluteUrl(url, base) {
  if (!url) return url;
  if (/^(https?:|data:|mailto:)/i.test(url)) return stripTracking(url);
  try {
    return stripTracking(new URL(url, base).href);
  } catch {
    return stripTracking(url);
  }
}

function imageSrcOf(image, $) {
  return (
    $(image).attr("src") ||
    $(image).attr("data-src") ||
    $(image).attr("data-lazy-src") ||
    ""
  );
}

function isTistoryRelatedHref(href, sourceUrl) {
  let parsed;
  try {
    parsed = new URL(href, sourceUrl);
  } catch {
    return false;
  }
  if (!/\.tistory\.com$/i.test(parsed.hostname)) return false;
  let path = parsed.pathname;
  if (path === "/m" || path.startsWith("/m/")) {
    path = path.replace(/^\/m(?=\/|$)/, "") || "/";
  }
  const normalized = path.replace(/\/+$/, "") || "/";
  if (TISTORY_RELATED_PATHS.has(normalized)) return true;
  if (normalized.startsWith("/category/")) return true;
  return false;
}

function tweetUrlFromIframe(src) {
  try {
    const parsed = new URL(src, "https://platform.twitter.com");
    const id =
      parsed.searchParams.get("id") ||
      parsed.searchParams.get("tweet_id") ||
      (parsed.pathname.match(/status(?:es)?\/(\d+)/) || [])[1];
    if (id) return `https://x.com/i/status/${id}`;
  } catch {
    // iframe 주소 파싱 실패 시 빈 값으로 제거한다.
  }
  return "";
}

/** 트위터 iframe 임베드를 원문 링크로 바꾼다. */
function convertTwitterEmbeds($, content) {
  content.find("iframe").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || "";
    const tweet = tweetUrlFromIframe(src);
    if (tweet) {
      $(el).replaceWith(`<p><a href="${tweet}">${tweet}</a></p>`);
    } else {
      $(el).remove();
    }
  });
}

function createTurndown() {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  turndown.addRule("preToFence", {
    filter: "pre",
    replacement(_inner, node) {
      const text = String(node.textContent || "").replace(/\n$/, "");
      return `\n\n\`\`\`\n${text}\n\`\`\`\n\n`;
    },
  });
  turndown.addRule("tables", {
    filter: "table",
    replacement(_content, table) {
      const html = table.outerHTML || "";
      const $table = cheerio.load(html || "<table></table>");
      const rows = [];
      $table("tr").each((_, tr) => {
        const cells = [];
        $table(tr)
          .find("th, td")
          .each((__, cell) => {
            cells.push(
              $table(cell)
                .text()
                .replace(/\s+/g, " ")
                .replace(/\|/g, "\\|")
                .trim()
            );
          });
        if (cells.length) rows.push(cells);
      });
      if (!rows.length) return "";
      const divider = rows[0].map(() => "---");
      return `\n\n${[rows[0], divider, ...rows.slice(1)]
        .map((row) => `| ${row.join(" | ")} |`)
        .join("\n")}\n\n`;
    },
  });
  return turndown;
}

async function downloadImage(url, referer) {
  let lastError = new Error(`이미지를 받지 못했습니다. ${url}`);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0", referer: referer || url },
      });
      if (response.ok) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        const dataUrl = `data:${imageMime(bytes, response.headers.get("content-type"))};base64,${Buffer.from(bytes).toString("base64")}`;
        if (!dataUrl.startsWith("data:image/")) {
          throw new Error("이미지 src가 data URL이 아닙니다.");
        }
        return dataUrl;
      }
      lastError = new Error(`이미지 HTTP ${response.status}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
    await pause(400 * (attempt + 1));
  }
  throw lastError;
}

async function inlineBodyImages($, content, sourceUrl) {
  const images = [...content.find("img").toArray()];
  for (const image of images) {
    let imageUrl = imageSrcOf(image, $);
    if (!imageUrl) {
      throw new Error("본문 이미지 URL이 없습니다.");
    }
    imageUrl = new URL(imageUrl, sourceUrl).href.replace(/^http:\/\//, "https://");
    const dataUrl = await downloadImage(imageUrl, sourceUrl);
    $(image).attr("src", dataUrl);
    $(image).removeAttr("srcset");
    $(image).removeAttr("data-src");
    $(image).removeAttr("data-lazy-src");
    $(image).removeAttr("onerror");
  }
}

function cleanTistoryContent($, content, sourceUrl) {
  content
    .find(
      "script, style, noscript, form, ins, .adsbygoogle, .revenue_unit_wrap, .container_postbtn, .another_category, .related-articles"
    )
    .remove();
  convertTwitterEmbeds($, content);
  content.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href) return;
    if (isTistoryRelatedHref(href, sourceUrl)) {
      $(link).replaceWith($(link).text());
      return;
    }
    $(link).attr("href", toAbsoluteUrl(href, sourceUrl));
  });
}

async function importTistory(spec, checkOnly, libs) {
  const response = await fetch(spec.sourceUrl, {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  if (!response.ok) throw new Error(`원문 HTTP ${response.status}`);
  const html = await response.text();
  const $ = cheerio.load(html);
  const content = $(".tt_article_useless_p_margin.contents_style").first().length
    ? $(".tt_article_useless_p_margin.contents_style").first()
    : $(".contents_style").first();
  if (!content.length) throw new Error("본문 영역을 찾지 못했습니다.");
  cleanTistoryContent($, content, spec.sourceUrl);
  await inlineBodyImages($, content, spec.sourceUrl);
  const articleMarkdown = createTurndown()
    .turndown(content.html() || "")
    .trim();
  const markdown = finalizeMarkdown(
    [
      `# ${spec.title}`,
      `> 원문. [티스토리](${spec.sourceUrl})`,
      articleMarkdown,
    ]
      .join("\n\n")
      .replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, "\n\n![$1]($2)\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    spec
  );
  const pageContent = JSON.stringify(libs.markdownToTiptapDoc(markdown));
  const stats = documentStats(pageContent);
  assertCommonIntegrity(spec, markdown, pageContent, stats);
  const extra = extraOf(spec, stats, null, pageContent);
  if (checkOnly) return extra;
  return persist(spec, pageContent, extra, libs);
}

async function importNotion(spec, checkOnly, libs) {
  if (spec.pageId === PARENT_PAGE_ID) {
    throw new Error("부모 페이지는 임포트하지 않습니다.");
  }
  const blocks = await collectBlocks(spec.pageId);
  const page = getBlock(blocks, spec.pageId);
  if (!page) throw new Error(`Notion 페이지를 찾지 못했습니다. ${spec.key}`);
  if (missingChildCount(blocks, spec.pageId) !== 0) {
    throw new Error(`빠진 자식 블록이 있습니다. ${spec.key}`);
  }
  const media = await resolveMedia(blocks);
  const { files, videos } = await resolveAttachments(blocks);
  preprocessBlocks(blocks);
  const built = buildMarkdown(
    blocks,
    spec.pageId,
    spec.sourceUrl,
    media,
    files
  );
  const markdown = finalizeMarkdown(built.markdown, spec);
  const pageTitle = storedTitleOf(built.pageTitle);
  const content = JSON.stringify(libs.markdownToTiptapDoc(markdown));
  const stats = documentStats(content);
  assertNotionIntegrity({
    spec,
    page,
    blocks,
    pageTitle,
    markdown,
    stats,
    content,
    videos,
  });
  const extra = extraOf(spec, stats, page, content);
  extra.videos = videos;
  if (checkOnly) return extra;
  return persist(spec, content, extra, libs);
}

async function importTarget(spec, checkOnly, libs) {
  if (spec.kind === "tistory") return importTistory(spec, checkOnly, libs);
  if (spec.kind === "notion") return importNotion(spec, checkOnly, libs);
  throw new Error(`알 수 없는 대상입니다. ${spec.key}`);
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const libs = loadLibs();
  const results = [];
  for (const target of TARGETS) {
    results.push(await importTarget(target, checkOnly, libs));
  }
  if (checkOnly) {
    console.log(JSON.stringify({ results }, null, 2));
    return;
  }
  const summary = {
    local: { pages: 0, pageSkips: 0 },
    production: { pages: 0, pageSkips: 0 },
    results,
  };
  for (const item of results) {
    summary.local.pages += item.local?.pages ?? 0;
    summary.local.pageSkips += item.local?.pageSkips ?? 0;
    summary.production.pages += item.production?.pages ?? 0;
    summary.production.pageSkips += item.production?.pageSkips ?? 0;
  }
  console.log(JSON.stringify(summary, null, 2));
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
