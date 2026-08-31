// 웹 3건과 Notion 1건을 Pages에만 저장한다
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
  imageMime,
  plainText,
} from "./import-claude-eli5-page.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const NOTION_ENDPOINT = "https://www.notion.so/api/v3/loadPageChunk";
const SIGNED_FILE_ENDPOINT = "https://www.notion.so/api/v3/getSignedFileUrls";
const retryDelays = [15000, 30000, 60000];
let lastRequestAt = 0;
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

export const TARGETS = [
  {
    key: "reborn-rules",
    title: "클로드가 안 해도 될 일을 멈춥니다 — 별 20만 개 CLAUDE.md",
    sourceUrl: "https://rebornlabs.kr/rules",
    kind: "web",
    label: "REBORN LABS",
    images: 2,
    attachments: 0,
    imageNames: ["star.png", "star_badge.png"],
    installCommands: [
      "reborn-skills 설치해줘",
      "!npx reborn-skills",
      "npx reborn-skills",
    ],
    phrases: [
      "Think Before Coding",
      "npx reborn-skills",
      "multica-ai/andrej-karpathy-skills",
    ],
  },
  {
    key: "jarvis-freebuff",
    title: "평생 무료 AI 코딩 에이전트, 진짜인지 클로드 코드와 붙여봤습니다",
    sourceUrl: "https://jarvisstudio-blog.web.app/blog/freebuff-claude-test/",
    kind: "web",
    label: "자비스스튜디오",
    images: 6,
    attachments: 0,
    imageNames: [
      "ev-ad-price.webp",
      "ev-ad-youtube.webp",
      "ev-login.webp",
      "ev-session.webp",
      "ev-claimed.webp",
      "ev-mixed.webp",
    ],
    phrases: ["npm install -g freebuff", "14 / 15", "MiMo 2.5"],
  },
  {
    key: "naver-blog-tool",
    title: "네이버 블로그 자동 작성 툴 제작 프롬프트 (범용)",
    sourceUrl: "https://app.notion.com/p/3c9bc8af735e8176970bf2d6070130eb",
    pageId: "3c9bc8af-735e-8176-970b-f2d6070130eb",
    hex: "3c9bc8af735e8176970bf2d6070130eb",
    kind: "notion",
    label: "Notion",
    root: 78,
    images: 0,
    attachments: 0,
    codes: 2,
    phrases: [
      "[STEP 1. 아래 프롬프트 복사]",
      "npm install -g @anthropic-ai/claude-code",
      "너는 15년차 네이버 파워블로거",
    ],
  },
  {
    key: "uppinote-session-cleanup",
    title:
      "Claude Code .claude 디렉토리 1.3GB 정리하기 — 세션 로그 자동 정리 스크립트",
    sourceUrl: "https://uppinote.dev/blog/claude-code-session-cleanup/",
    kind: "web",
    label: "유피노트",
    images: 1,
    attachments: 0,
    imageNames: ["claude-code-session-cleanup-01.png"],
    phrases: ["cleanup-sessions.sh", "memory/MEMORY.md", "1.5GB"],
  },
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

const pause = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

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

/** 빈 제목이면 지정한 제목을 쓴다. */
export function resolvedTitle(pageTitle, fallback) {
  const title = String(pageTitle ?? "").trim();
  return title || String(fallback ?? "").trim();
}

/** SVG를 포함해 이미지 MIME을 판별한다. */
export function mediaMime(bytes, header) {
  const head = Buffer.from(bytes.subarray(0, 200)).toString("utf8");
  if (head.includes("<svg") || head.includes("<?xml")) {
    return "image/svg+xml";
  }
  try {
    return imageMime(bytes, header);
  } catch {
    if (header?.startsWith("image/")) return header.split(";")[0];
    throw new Error("이미지 MIME을 판별하지 못했습니다.");
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

function getBlock(blocks, id) {
  if (!blocks || id == null) return null;
  if (typeof blocks.get === "function") return blocks.get(id) ?? null;
  return blocks[id] ?? null;
}

function sourceOf(block) {
  return (
    plainText(block?.properties?.source) ||
    plainText(block?.properties?.link) ||
    block?.format?.display_source ||
    block?.format?.original_url ||
    ""
  );
}

function fileNameOf(block) {
  const titled = plainText(block?.properties?.title).trim();
  if (titled) return titled;
  const source = sourceOf(block);
  if (source.startsWith("attachment:")) {
    const name = source.split(":").at(-1)?.trim();
    if (name) return name;
  }
  return "";
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
  return countType(blocks, "file") + countType(blocks, "pdf");
}

function applyPageTitle(markdown, title) {
  if (!String(markdown).startsWith("# ")) {
    return `# ${title}\n\n${markdown}`;
  }
  return String(markdown).replace(/^# [^\n]*/, `# ${title}`);
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

function toAbsoluteUrl(url, base) {
  if (!url) return url;
  if (/^(https?:|data:|mailto:)/i.test(url)) return stripTracking(url, base);
  try {
    return stripTracking(new URL(url, base).href, base);
  } catch {
    return stripTracking(url, base);
  }
}

function preferFeatureSrc(url) {
  return String(url).replace(/\/size\/w2000\//, "/size/w1200/");
}

function imageSrcOf(image, $) {
  return (
    $(image).attr("src") ||
    $(image).attr("data-src") ||
    $(image).attr("data-lazy-src") ||
    ""
  );
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

function fenceInstallCommands($, rootEl, commands = []) {
  if (!commands.length) return;
  rootEl.find("code").each((_, el) => {
    const node = $(el);
    if (node.closest("pre").length) return;
    const text = node.text().trim();
    if (!commands.includes(text)) return;
    node.replaceWith($("<pre>").append($("<code>").text(text)));
  });
}

function cleanWebMarkdown(markdown, base) {
  return String(markdown ?? "")
    .replace(/\\([\[\]])/g, "$1")
    .replace(/\]\((\/[^)]+)\)/g, (_, path) => `](${stripTracking(path, base)})`)
    .replace(/https?:\/\/[^\s)]+/g, (url) => stripTracking(url, base))
    .replace(/^\s*복사(?:됨!)?\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildPageMarkdown(title, label, sourceUrl, articleMarkdown) {
  return [`# ${title}`, `> 원문. [${label}](${sourceUrl})`, articleMarkdown]
    .filter(Boolean)
    .join("\n\n");
}

function webTitle($, spec) {
  if (spec.key !== "reborn-rules") return spec.title;
  const raw = ($("title").first().text() || "").trim();
  const stripped = raw.replace(/\s*·\s*REBORN LABS\s*$/i, "").trim();
  return resolvedTitle(stripped, spec.title);
}

function selectWebContent($, spec) {
  if (spec.key === "reborn-rules") {
    const content = $("body").first();
    if (!content.length) throw new Error("본문 영역을 찾지 못했습니다.");
    content.find("script, style, button").remove();
    return content;
  }
  if (spec.key === "jarvis-freebuff") {
    const content = $("main article").first();
    if (!content.length) throw new Error("본문 영역을 찾지 못했습니다.");
    content.find("script, style, button").remove();
    return content;
  }
  if (spec.key === "uppinote-session-cleanup") {
    const article = $("article.post-full").first();
    if (!article.length) throw new Error("본문 영역을 찾지 못했습니다.");
    const feature = article
      .find("figure.post-feature-image, .post-feature-image")
      .first();
    const body = article.find("section.post-content, .post-content").first();
    if (!body.length) throw new Error("본문 영역을 찾지 못했습니다.");
    const pieces = [];
    if (feature.length) pieces.push($.html(feature));
    pieces.push($.html(body));
    article.empty();
    article.append(pieces.join(""));
    article
      .find(
        "aside, .read-next, .related-posts, .author-box, footer, script, style, button"
      )
      .remove();
    article.find("img").each((_, img) => {
      const src = preferFeatureSrc(imageSrcOf(img, $));
      if (src) $(img).attr("src", src);
      $(img).removeAttr("srcset");
    });
    return article;
  }
  throw new Error(`웹 대상이 아닙니다. ${spec.key}`);
}

function assertNamedImages($, content, spec) {
  const srcs = content
    .find("img")
    .toArray()
    .map((img) => imageSrcOf(img, $));
  if (srcs.length !== spec.images) {
    throw new Error(`원문 이미지 수가 다릅니다. ${srcs.length}`);
  }
  for (const name of spec.imageNames ?? []) {
    if (!srcs.some((src) => src.includes(name))) {
      throw new Error(`이미지가 없습니다. ${name}`);
    }
  }
}

function rewriteLinks($, content, sourceUrl) {
  content.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href) return;
    $(link).attr("href", toAbsoluteUrl(href, sourceUrl));
  });
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
      },
      body: JSON.stringify(body),
    });
    lastRequestAt = Date.now();
    if (response.ok) return response.json();
    const message = await response.text();
    if (![429, 503].includes(response.status) || attempt === retryDelays.length) {
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

async function dataUrlFromResponse(response) {
  if (!response.ok) throw new Error(`이미지 HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const dataUrl = `data:${mediaMime(bytes, response.headers.get("content-type"))};base64,${Buffer.from(bytes).toString("base64")}`;
  if (!hasNoExpiredUrl(dataUrl)) {
    throw new Error("만료 URL이 이미지 데이터에 남아 있습니다.");
  }
  if (!dataUrl.startsWith("data:image")) {
    throw new Error("이미지가 data URL이 아닙니다.");
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
          spaceId: block.space_id,
        },
        url,
      },
    ],
  });
  const signedUrl = signed.signedUrls?.[0];
  if (!signedUrl) throw new Error(`서명 URL을 받지 못했습니다. ${block.id}`);
  return signedUrl;
}

async function fetchMedia(url, block) {
  if (url.startsWith("attachment:")) {
    return fetch(await signedUrlFor(block, url));
  }
  const absolute = url.startsWith("/") ? `https://www.notion.so${url}` : url;
  return fetch(absolute, {
    headers: {
      referer: "https://www.notion.so/",
      "user-agent": "Mozilla/5.0",
    },
  });
}

async function resolveMedia(blocks) {
  const media = new Map();
  for (const block of blocks.values()) {
    if (block.type !== "image") continue;
    const url = sourceOf(block);
    if (!url) throw new Error(`이미지 URL이 없습니다. ${block.id}`);
    media.set(block.id, await dataUrlFromResponse(await fetchMedia(url, block)));
  }
  return media;
}

async function resolveAttachments(blocks) {
  const files = new Map();
  for (const block of blocks.values()) {
    if (block.type !== "file" && block.type !== "pdf") continue;
    const filename = fileNameOf(block) || "첨부 파일";
    if (/\.zip$/i.test(filename)) {
      throw new Error("ZIP 첨부는 page-attachment-storage 화이트리스트가 필요합니다.");
    }
    const url = sourceOf(block);
    if (!url) throw new Error(`첨부 URL이 없습니다. ${block.id}`);
    if (url.startsWith("data:")) {
      if (!hasNoExpiredUrl(url)) {
        throw new Error(`만료 URL 첨부를 저장할 수 없습니다. ${filename}`);
      }
      files.set(block.id, `[${filename}](${url})`);
      continue;
    }
    const response = await fetchMedia(url, block);
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
  }
  return files;
}

async function downloadImage(url, referer) {
  let lastError = new Error(`이미지를 받지 못했습니다. ${url}`);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0",
          referer: referer || url,
        },
      });
      if (response.ok) return dataUrlFromResponse(response);
      lastError = new Error(`이미지 HTTP ${response.status}: ${url}`);
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
    if (!imageUrl) throw new Error("이미지 URL이 없습니다.");
    imageUrl = preferFeatureSrc(new URL(imageUrl, sourceUrl).href);
    const dataUrl = await downloadImage(imageUrl, sourceUrl);
    $(image).attr("src", dataUrl);
    $(image).removeAttr("srcset");
    $(image).removeAttr("data-src");
    $(image).removeAttr("data-lazy-src");
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0",
      referer: url,
    },
  });
  if (!response.ok) throw new Error(`원문 HTTP ${response.status}`);
  return response.text();
}

function assertSharedIntegrity(spec, { pageTitle, markdown, stats, content }) {
  if (!markdown.startsWith(`# ${pageTitle}`)) {
    throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
  }
  const sourceUrl = stripTracking(spec.sourceUrl);
  if (!markdown.includes(sourceUrl)) throw new Error("원문 주소가 없습니다.");
  if (!markdown.includes(`> 원문. [${spec.label}](${sourceUrl})`)) {
    throw new Error("원문 인용이 없습니다.");
  }
  for (const phrase of spec.phrases ?? []) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(content)) {
    throw new Error("만료 URL이 본문에 남아 있습니다.");
  }
  if (stats.images !== spec.images) {
    throw new Error(`TipTap 이미지 수가 다릅니다. ${stats.images}`);
  }
  if (stats.attachments !== spec.attachments) {
    throw new Error(`TipTap 첨부 수가 다릅니다. ${stats.attachments}`);
  }
  const sources = imageSourcesOf(content);
  if (sources.length !== spec.images) {
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
  if (/^\s*복사(?:됨!)?\s*$/m.test(markdown)) {
    throw new Error("복사 버튼 문구가 남아 있습니다.");
  }
}

function assertNotionIntegrity(spec, ctx) {
  const { page, blocks, pageTitle } = ctx;
  if (pageTitle !== spec.title) {
    throw new Error(`페이지 제목이 다릅니다. ${pageTitle}`);
  }
  if ((page.content || []).length !== spec.root) {
    throw new Error(`루트 자식 수가 다릅니다. ${(page.content || []).length}`);
  }
  if (countType(blocks, "image") !== spec.images) {
    throw new Error(`이미지 블록 수가 다릅니다. ${countType(blocks, "image")}`);
  }
  if (attachmentCount(blocks) !== spec.attachments) {
    throw new Error(`첨부 블록 수가 다릅니다. ${attachmentCount(blocks)}`);
  }
  if (spec.codes != null && countType(blocks, "code") !== spec.codes) {
    throw new Error(`코드 블록 수가 다릅니다. ${countType(blocks, "code")}`);
  }
  if (spec.codes != null && ctx.stats.codes !== spec.codes) {
    throw new Error(`TipTap 코드 수가 다릅니다. ${ctx.stats.codes}`);
  }
  assertSharedIntegrity(spec, ctx);
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

function markersOf(spec, sourceUrl) {
  return [sourceUrl, spec.pageId, spec.hex].filter(Boolean);
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

async function persist(title, content, markers, extra, libs, sourceUrl) {
  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    title,
    content,
    sourceUrl,
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record, markers, libs);
  record.id = local.pageId;
  const production = await importProduction(record, libs);
  return {
    ...extra,
    pageId: production.pageId || local.pageId,
    path: `/pages/${production.pageId || local.pageId}`,
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

async function importNotionTarget(spec, markdownToTiptapDoc, checkOnly, libs) {
  const sourceUrl = stripTracking(spec.sourceUrl);
  const blocks = await collectBlocks(spec.pageId);
  const page = getBlock(blocks, spec.pageId);
  if (!page) throw new Error(`Notion 페이지를 찾지 못했습니다. ${spec.key}`);
  const media = await resolveMedia(blocks);
  const files = await resolveAttachments(blocks);
  const built = buildMarkdown(blocks, spec.pageId, sourceUrl, media, files);
  const pageTitle = resolvedTitle(built.pageTitle, spec.title);
  const markdown = applyPageTitle(built.markdown, pageTitle);
  const content = JSON.stringify(markdownToTiptapDoc(markdown));
  const stats = documentStats(content);
  assertNotionIntegrity(spec, {
    page,
    blocks,
    pageTitle,
    markdown,
    stats,
    content,
  });
  const extra = {
    key: spec.key,
    pageTitle,
    images: stats.images,
    attachments: stats.attachments,
    tables: stats.tables,
    codes: stats.codes,
    root: (page.content || []).length,
  };
  if (checkOnly) return extra;
  return persist(
    pageTitle,
    content,
    markersOf(spec, sourceUrl),
    extra,
    libs,
    sourceUrl
  );
}

async function importWebTarget(spec, markdownToTiptapDoc, checkOnly, libs) {
  const sourceUrl = stripTracking(spec.sourceUrl);
  const html = await fetchText(sourceUrl);
  const $ = cheerio.load(html);
  const pageTitle = webTitle($, spec);
  const contentEl = selectWebContent($, spec);
  fenceInstallCommands($, contentEl, spec.installCommands);
  assertNamedImages($, contentEl, spec);
  await inlineBodyImages($, contentEl, sourceUrl);
  rewriteLinks($, contentEl, sourceUrl);
  const articleMarkdown = cleanWebMarkdown(
    createTurndown().turndown(contentEl.html() || "").trim(),
    sourceUrl
  );
  let markdown = buildPageMarkdown(
    pageTitle,
    spec.label,
    sourceUrl,
    articleMarkdown
  );
  if (
    spec.key === "uppinote-session-cleanup" &&
    !/!\[[^\]]*\]\(data:image/.test(markdown)
  ) {
    throw new Error("대표 이미지가 본문에 없습니다.");
  }
  const content = JSON.stringify(markdownToTiptapDoc(markdown));
  const stats = documentStats(content);
  assertSharedIntegrity(spec, {
    pageTitle,
    markdown,
    stats,
    content,
  });
  const extra = {
    key: spec.key,
    pageTitle,
    images: stats.images,
    attachments: stats.attachments,
  };
  if (checkOnly) return extra;
  return persist(
    pageTitle,
    content,
    markersOf(spec, sourceUrl),
    extra,
    libs,
    sourceUrl
  );
}

async function importTarget(spec, markdownToTiptapDoc, checkOnly, libs) {
  if (spec.kind === "notion") {
    return importNotionTarget(spec, markdownToTiptapDoc, checkOnly, libs);
  }
  return importWebTarget(spec, markdownToTiptapDoc, checkOnly, libs);
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const libs = loadLibs();
  const results = [];
  for (const target of TARGETS) {
    results.push(
      await importTarget(target, libs.markdownToTiptapDoc, checkOnly, libs)
    );
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
