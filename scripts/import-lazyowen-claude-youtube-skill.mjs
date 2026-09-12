// 게으른 빌더 유튜브 스킬 가이드를 Pages에만 저장한다
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
  documentStats,
  imageMime,
  isZipBytes,
} from "./import-claude-eli5-page.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const HTML_DUMP = resolve(root, "tmp/lazyowen/article.html");
const IMAGE_DIR = resolve(root, "tmp/lazyowen");

export const SOURCE_URL = "https://lazyowen.com/guides/claude-youtube-skill";
export const PAGE_TITLE =
  "유튜브 튜토리얼을 클로드가 실행하는 스킬로 바꾸는 세 가지 세팅";
export const EXPECTED_IMAGES = 4;
export const EXPECTED_ATTACHMENTS = 0;
export const EXPECTED_TABLES = 2;
export const IMAGE_NAMES = [
  "g1-flow.webp",
  "g2-settings.webp",
  "g3-labels.webp",
  "g4-example.webp",
];
export const REQUIRED_HREFS = [
  "https://aistudio.google.com/apikey",
  "https://github.com/bradautomates/claude-video",
  "https://github.com/bradautomates/claude-video/releases/latest",
  "https://www.python.org/downloads/",
  "https://ai.google.dev/gemini-api/docs/video-understanding",
  "https://github.com/anthropics/skills",
  "https://code.claude.com/docs/en/skills",
  "https://github.com/yt-dlp/yt-dlp",
  "https://ffmpeg.org/",
  "https://www.instagram.com/lazy_owen/",
];
export const REQUIRED_PHRASES = [
  SOURCE_URL,
  "/plugin marketplace add bradautomates/claude-video",
  "/watch",
  "skill-creator",
  "ffmpeg",
  "yt-dlp",
  "Google AI Studio",
];
const IMAGE_BYTES = {
  "g1-flow.webp": 68330,
  "g2-settings.webp": 69446,
  "g3-labels.webp": 60126,
  "g4-example.webp": 66264,
};
const FILE_HREF_RE = /\.(pdf|zip|docx?|xlsx?|pptx?|csv|txt)(?:$|[?#])/i;
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
const CHALLENGE_PHRASES = ["30일 AI 챌린지", "사전 등록 오픈"];

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

/** 유입 추적 쿼리를 빼고 절대 주소로 바꾼다. */
export function stripTracking(url, base) {
  if (!url || String(url).startsWith("data:") || String(url).startsWith("mailto:")) {
    return url;
  }
  try {
    const parsed = new URL(url, base);
    for (const key of [...parsed.searchParams.keys()]) {
      const value = parsed.searchParams.get(key);
      if (isTrackingParam(key, value)) parsed.searchParams.delete(key);
    }
    if ([...parsed.searchParams.keys()].length === 0) parsed.search = "";
    return parsed.href;
  } catch {
    return String(url)
      .replace(/[?&](?:utm_[^=&#]*|fbclid|pvs|igsh|mcp_token)=[^&\s)#]*/g, "")
      .replace(/[?&]source=copy_link/g, "")
      .replace(/[?&]m=1(?=[&#]|$)/g, "")
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

function unescapeHtml(value) {
  return String(value ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function escapePreBody(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function unwrapCodeInPre(html) {
  return String(html ?? "").replace(
    /<pre(\b[^>]*)>\s*<code\b([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_match, preAttrs, codeAttrs, body) => {
      const lang = String(codeAttrs).match(/language-([a-z0-9]+)/i)?.[1] || "";
      const langAttr = lang ? ` data-lang="${lang}"` : "";
      return `<pre${preAttrs}${langAttr}>${body}</pre>`;
    }
  );
}

function unwrapSlots(html) {
  return String(html ?? "").replace(
    /<span\b[^>]*class=["'][^"']*\bslot\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi,
    "$1"
  );
}

/** pre 안의 태그 모양 문구가 HTML 파서에 깨지지 않게 이스케이프한다. */
export function protectPreBlocks(html) {
  return String(html ?? "").replace(
    /<pre(\b[^>]*)>([\s\S]*?)<\/pre>/gi,
    (_match, attrs, body) =>
      `<pre${attrs}>${escapePreBody(unescapeHtml(body))}</pre>`
  );
}

function prepareHtml(html) {
  return protectPreBlocks(unwrapSlots(unwrapCodeInPre(html)));
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
  if (!url || url.startsWith("data:") || url.startsWith("mailto:")) return url;
  return stripTracking(url, base);
}

function imageSrcOf(image, $) {
  return (
    $(image).attr("src") ||
    $(image).attr("data-src") ||
    $(image).attr("data-lazy-src") ||
    ""
  );
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

function createTurndown() {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  turndown.addRule("preToFence", {
    filter: "pre",
    replacement(_inner, node) {
      const text = String(node.textContent || "")
        .replace(/^\n+/, "")
        .replace(/\n+$/, "");
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

function cleanWebMarkdown(markdown, base) {
  return String(markdown ?? "")
    .replace(/\\([\\`*_{}[\]()#+\-.!])/g, "$1")
    .replace(/\]\((\/[^)]+)\)/g, (_, path) => `](${stripTracking(path, base)})`)
    .replace(/https?:\/\/[^\s)]+/g, (url) => stripTracking(url, base))
    .replace(/^\s*복사(?:됨!)?\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pageTitleOf($) {
  const h1 = $("article.article header.article-head h1, article.article h1").first();
  if (h1.length) {
    return h1.text().replace(/\s+/g, " ").trim();
  }
  const og = ($('meta[property="og:title"]').attr("content") || "").trim();
  if (og) return og;
  return ($("title").first().text() || "")
    .replace(/\s*·\s*게으른 빌더\s*$/, "")
    .trim();
}

function flattenDetails($, root) {
  root.find("details").each((_, el) => {
    const node = $(el);
    const summary = node.find("summary").first().text().replace(/\s+/g, " ").trim();
    node.find("summary").remove();
    const wrap = $("<div>");
    if (summary) {
      wrap.append($("<p>").append($("<strong>").text(summary)));
    }
    wrap.append(node.contents());
    node.replaceWith(wrap);
  });
}

function flattenCallouts($, root) {
  root.find("div.callout").each((_, el) => {
    const node = $(el);
    const quote = $("<blockquote>");
    const body = node.find(".body").first();
    quote.append(body.length ? body.contents() : node.contents());
    node.replaceWith(quote);
  });
}

function rewriteLinks($, root, sourceUrl) {
  root.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href || href.startsWith("data:")) return;
    $(link).attr("href", toAbsoluteUrl(href, sourceUrl));
  });
}

function rewriteImages($, root, sourceUrl) {
  root.find("img").each((_, image) => {
    const src = imageSrcOf(image, $);
    if (!src || src.startsWith("data:")) return;
    $(image).attr("src", toAbsoluteUrl(src, sourceUrl));
    $(image).removeAttr("srcset");
  });
}

function fencePrePlaceholders($, root) {
  const fences = [];
  root.find("pre").each((_, el) => {
    const node = $(el);
    const lang = String(node.attr("data-lang") || "").trim();
    const body = node
      .text()
      .replace(/^\n+/, "")
      .replace(/\n+$/, "");
    const token = `@@PRE${fences.length}@@`;
    fences.push({ lang, body });
    node.replaceWith($("<p>").text(token));
  });
  return fences;
}

function restorePreFences(markdown, fences) {
  let out = String(markdown ?? "");
  fences.forEach((item, index) => {
    const token = `@@PRE${index}@@`;
    const lang = item.lang || "";
    const fence = `\`\`\`${lang}\n${item.body}\n\`\`\``;
    if (!out.includes(token)) {
      throw new Error(`코드 자리 표시를 찾지 못했습니다. ${token}`);
    }
    out = out.replace(token, fence);
  });
  return out;
}

function selectContent($) {
  const article = $("article.article").first();
  if (!article.length) throw new Error("본문 영역을 찾지 못했습니다.");
  const head = article.find("header.article-head").first();
  const prose = article.find("div.prose").first();
  if (!prose.length) throw new Error("본문 영역을 찾지 못했습니다.");
  const root = $("<div>");
  if (head.length) root.append(head.clone());
  root.append(prose.clone());
  root.find("nav, aside.chband, footer, .stickybar, section.section").remove();
  root.find("script, style, noscript, button.copy, .copy").remove();
  return root;
}

function parseLoadedHtml($, sourceUrl) {
  const canonical = stripTracking(sourceUrl);
  const root = selectContent($);
  const title = pageTitleOf($) || PAGE_TITLE;
  root.find("h1").first().remove();
  flattenDetails($, root);
  flattenCallouts($, root);
  rewriteLinks($, root, canonical);
  rewriteImages($, root, canonical);
  const fences = fencePrePlaceholders($, root);
  const articleMarkdown = restorePreFences(
    createTurndown().turndown(root.html() || "").trim(),
    fences
  );
  const cleaned = cleanWebMarkdown(articleMarkdown, canonical);
  const markdown = [
    `# ${title}`,
    `> 원문. [게으른 빌더](${canonical})`,
    cleaned,
  ]
    .filter(Boolean)
    .join("\n\n")
    .replace(/\\([\\`*_{}[\]()#+\-.!])/g, "$1")
    .replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, "\n\n![$1]($2)\n\n")
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g, "\n\n![$1]($2)\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { title, markdown };
}

/** 가이드 HTML을 저장용 마크다운으로 바꾼다. */
export function parseLazyowenHtml(html, sourceUrl = SOURCE_URL) {
  const $ = cheerio.load(prepareHtml(html));
  return parseLoadedHtml($, sourceUrl);
}

function filenameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const name = decodeURIComponent(
      parsed.pathname.split("/").filter(Boolean).at(-1) || ""
    );
    return name || "";
  } catch {
    return String(url).split("/").filter(Boolean).at(-1) || "";
  }
}

function assertImageBytes(name, length) {
  const expected = IMAGE_BYTES[name];
  if (expected != null && length !== expected) {
    throw new Error(`이미지 크기가 다릅니다. ${name} ${length}`);
  }
}

function dataUrlFromBytes(bytes, header) {
  const mime = imageMime(bytes, header);
  const dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  if (!hasNoExpiredUrl(dataUrl)) {
    throw new Error("만료 URL이 이미지 데이터에 남아 있습니다.");
  }
  if (!dataUrl.startsWith("data:image")) {
    throw new Error("이미지가 data URL이 아닙니다.");
  }
  return dataUrl;
}

async function dataUrlFromResponse(response, name) {
  if (!response.ok) throw new Error(`이미지 HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (name) assertImageBytes(name, bytes.length);
  return dataUrlFromBytes(bytes, response.headers.get("content-type"));
}

async function downloadImage(url, referer) {
  const name = filenameFromUrl(url);
  let lastError = new Error(`이미지를 받지 못했습니다. ${url}`);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0",
          referer: referer || url,
        },
      });
      if (response.ok) return dataUrlFromResponse(response, name);
      lastError = new Error(`이미지 HTTP ${response.status}: ${url}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
    await pause(400 * (attempt + 1));
  }
  throw lastError;
}

function localImageDataUrl(name) {
  const file = resolve(IMAGE_DIR, name);
  if (!existsSync(file)) return "";
  const bytes = new Uint8Array(readFileSync(file));
  assertImageBytes(name, bytes.length);
  return dataUrlFromBytes(bytes, "image/webp");
}

async function inlineBodyImages($, content, sourceUrl, { allowLocal = false } = {}) {
  const images = [...content.find("img").toArray()];
  for (const image of images) {
    let imageUrl = imageSrcOf(image, $);
    if (!imageUrl) throw new Error("이미지 URL이 없습니다.");
    if (imageUrl.startsWith("data:")) {
      if (!imageUrl.startsWith("data:image")) {
        throw new Error("이미지가 data URL이 아닙니다.");
      }
      $(image).attr("src", imageUrl);
      $(image).removeAttr("srcset");
      continue;
    }
    imageUrl = new URL(imageUrl, sourceUrl).href;
    const name = filenameFromUrl(imageUrl);
    if (allowLocal && IMAGE_NAMES.includes(name)) {
      const local = localImageDataUrl(name);
      if (local) {
        $(image).attr("src", local);
        $(image).removeAttr("srcset");
        continue;
      }
    }
    const dataUrl = await downloadImage(imageUrl, sourceUrl);
    $(image).attr("src", dataUrl);
    $(image).removeAttr("srcset");
  }
}

function isFileHref(href) {
  if (!href || href.startsWith("data:") || href.startsWith("mailto:") || href.startsWith("#")) {
    return false;
  }
  try {
    return FILE_HREF_RE.test(new URL(href).pathname);
  } catch {
    return FILE_HREF_RE.test(href);
  }
}

async function inlineAttachments($, content, sourceUrl) {
  const links = [...content.find("a[href]").toArray()];
  for (const link of links) {
    const href = $(link).attr("href") || "";
    if (!href || href.startsWith("data:")) continue;
    const abs = toAbsoluteUrl(href, sourceUrl);
    if (!isFileHref(abs)) continue;
    const filename =
      filenameFromUrl(abs) ||
      $(link).text().replace(/\s+/g, " ").trim() ||
      "첨부 파일";
    if (/\.zip$/i.test(filename) || /\.zip(?:$|[?#])/i.test(abs)) {
      throw new Error(
        "ZIP 첨부는 page-attachment-storage 화이트리스트가 필요합니다."
      );
    }
    const response = await fetch(abs, {
      headers: {
        "user-agent": "Mozilla/5.0",
        referer: sourceUrl,
      },
    });
    if (!response.ok) throw new Error(`첨부 HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (isZipBytes(bytes, filename)) {
      throw new Error(
        "ZIP 첨부는 page-attachment-storage 화이트리스트가 필요합니다."
      );
    }
    const markdown = assertDownloadableAttachment(
      filename,
      bytes,
      response.headers.get("content-type")
    );
    const dataUrl = markdown.slice(
      markdown.indexOf("(") + 1,
      markdown.lastIndexOf(")")
    );
    $(link).attr("href", dataUrl);
    if (!$(link).text().trim()) $(link).text(filename);
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

async function loadSourceHtml(offline) {
  if (offline && existsSync(HTML_DUMP)) {
    return readFileSync(HTML_DUMP, "utf8");
  }
  return fetchText(SOURCE_URL);
}

function hasChallengePhrase(text) {
  return CHALLENGE_PHRASES.some((phrase) => String(text ?? "").includes(phrase));
}

function assertIntegrity({ title, markdown, stats, content }) {
  if (title !== PAGE_TITLE) {
    throw new Error(`페이지 제목이 다릅니다. ${title}`);
  }
  if (!markdown.startsWith(`# ${PAGE_TITLE}`)) {
    throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
  }
  if (!markdown.includes(`> 원문. [게으른 빌더](${SOURCE_URL})`)) {
    throw new Error("원문 인용이 없습니다.");
  }
  for (const phrase of REQUIRED_PHRASES) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  for (const href of REQUIRED_HREFS) {
    if (!markdown.includes(href)) throw new Error(`링크가 없습니다. ${href}`);
  }
  if (stats.images !== EXPECTED_IMAGES) {
    throw new Error(`TipTap 이미지 수가 다릅니다. ${stats.images}`);
  }
  if (stats.attachments !== EXPECTED_ATTACHMENTS) {
    throw new Error(`TipTap 첨부 수가 다릅니다. ${stats.attachments}`);
  }
  if (stats.tables !== EXPECTED_TABLES) {
    throw new Error(`TipTap 표 수가 다릅니다. ${stats.tables}`);
  }
  if (stats.codes < 21) {
    throw new Error(`TipTap 코드 블록이 부족합니다. ${stats.codes}`);
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
  if (hasChallengePhrase(markdown) || hasChallengePhrase(content)) {
    throw new Error("챌린지 홍보 문구가 본문에 남아 있습니다.");
  }
  if (/^\s*복사(?:됨!)?\s*$/m.test(markdown)) {
    throw new Error("복사 버튼 문구가 남아 있습니다.");
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
  return [SOURCE_URL];
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

async function persist(title, content, extra, libs) {
  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    title,
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

async function buildImportedPage({ offline = false } = {}) {
  const sourceUrl = stripTracking(SOURCE_URL);
  const html = prepareHtml(await loadSourceHtml(offline));
  const $ = cheerio.load(html);
  const article = $("article.article").first();
  if (!article.length) throw new Error("본문 영역을 찾지 못했습니다.");
  const proseImages = article.find("div.prose img").length;
  if (proseImages !== EXPECTED_IMAGES) {
    throw new Error(`본문 이미지가 ${EXPECTED_IMAGES}이어야 합니다. ${proseImages}`);
  }
  await inlineBodyImages($, article, sourceUrl, { allowLocal: offline });
  await inlineAttachments($, article, sourceUrl);
  return parseLoadedHtml($, sourceUrl);
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const parsed = await buildImportedPage({ offline: checkOnly });
  const libs = loadLibs();
  const content = JSON.stringify(libs.markdownToTiptapDoc(parsed.markdown));
  const stats = documentStats(content);
  assertIntegrity({
    title: parsed.title,
    markdown: parsed.markdown,
    stats,
    content,
  });
  const extra = {
    pageTitle: parsed.title,
    images: stats.images,
    attachments: stats.attachments,
    codes: stats.codes,
    tables: stats.tables,
  };
  if (checkOnly) {
    console.log(JSON.stringify(extra, null, 2));
    return;
  }
  const result = await persist(parsed.title, content, extra, libs);
  console.log(JSON.stringify(result, null, 2));
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
