// every._ai 클로드 코드 앱 프롬프트 8가지를 Pages에만 저장한다
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
  isZipBytes,
} from "./import-claude-eli5-page.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const SITE_NAME = "every._ai";

export const SOURCE_URL =
  "https://every-ai-guides.vercel.app/posts/claude-code-app-prompts-8";
export const PAGE_TITLE = "클로드 코드로 앱 만드는 프롬프트 8가지";
export const BODY_IMAGE_URL =
  "https://every-ai-guides.vercel.app/img/p07-todayset-390.png";
export const BODY_IMAGE_BYTES = 32448;
export const BODY_IMAGE_WIDTH = 780;
export const BODY_IMAGE_HEIGHT = 1688;
export const BODY_IMAGE_ALT =
  "오늘셋 실제 실행 화면 · 390px · 목록과 완료 표시";
export const CODE_DOCS_URL = "https://code.claude.com/docs/en/overview";
export const PROMPT_DOCS_URL =
  "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview";
export const EXPECTED_IMAGES = 1;
export const EXPECTED_ATTACHMENTS = 0;
export const EXPECTED_TABLES = 2;
export const EXPECTED_CODES = 8;
const ALLOWED_LINKS = [SOURCE_URL, CODE_DOCS_URL, PROMPT_DOCS_URL];
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
  "from=dm",
];
const FORBIDDEN_SNIPPETS = [
  "fbclid",
  "utm_source",
  "from=dm",
  "추석 AI 부트캠프",
  "모집 소식",
  "youtube.com",
  "instagram.com/every",
  "claude-icon.png",
];
const REQUIRED_PHRASES = [
  "Quick Start",
  "STEP 1",
  "오늘셋",
  "공식 참고 자료",
  "2026-10-04",
  "Scope Planner",
  "GUIDE · Claude Code",
  "읽는 데 8분",
  "2026-10-04 공개",
  SOURCE_URL,
  CODE_DOCS_URL,
  PROMPT_DOCS_URL,
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

function isTrackingParam(key, value) {
  return (
    key.startsWith("utm_") ||
    key === "fbclid" ||
    key === "pvs" ||
    key === "igsh" ||
    key === "mcp_token" ||
    (key === "source" && value === "copy_link") ||
    (key === "m" && value === "1") ||
    (key === "from" && value === "dm")
  );
}

/** 저장용 원문 주소는 끝 슬래시 없이 맞춘다. */
function storedSourceUrl(url = SOURCE_URL) {
  const cleaned = stripTracking(url || SOURCE_URL).replace(/\/+$/, "");
  return cleaned || SOURCE_URL;
}

/** 상대 링크를 절대 주소로 바꿀 때만 끝 슬래시를 붙인다. */
function linkBaseOf(url = SOURCE_URL) {
  return `${storedSourceUrl(url)}/`;
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
      .replace(
        /[?&](?:utm_[^=&#]*|fbclid|pvs|igsh|mcp_token)=[^&\s)#]*/g,
        ""
      )
      .replace(/[?&]source=copy_link/g, "")
      .replace(/[?&]m=1(?=[&#]|$)/g, "")
      .replace(/[?&]from=dm(?=[&#]|$)/g, "")
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

/** PNG 앞 4바이트가 89504e47이 아니면 예외를 던진다. */
export function assertPngSignature(bytes) {
  const sig = Buffer.from(bytes.subarray(0, 4)).toString("hex");
  if (sig !== "89504e47") {
    throw new Error("PNG 시그니처가 아닙니다.");
  }
}

function bytesFromPngDataUrl(dataUrl) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    String(dataUrl)
  );
  if (!match) throw new Error("PNG data URL이 아닙니다.");
  return Buffer.from(match[1], "base64");
}

function pngPixelSize(bytes) {
  const raw = Buffer.from(bytes);
  if (raw.length < 24 || raw.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error("PNG IHDR이 없습니다.");
  }
  return {
    width: raw.readUInt32BE(16),
    height: raw.readUInt32BE(20),
  };
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
  // del은 취소선이다. 태그만 지우면 앞뒤 글자가 붙는다.
  turndown.addRule("strikethrough", {
    filter: ["del", "s", "strike"],
    replacement(content) {
      const text = String(content).replace(/\s+/g, " ").trim();
      if (!text) return "";
      return `~~${text}~~`;
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
  // turndown은 pre 안에 code가 없으면 코드 블록으로 보지 않는다.
  turndown.addRule("barePre", {
    filter: "pre",
    replacement(_content, node) {
      const code = String(node.textContent || "").replace(/\n$/, "");
      const fence = code.includes("```") ? "````" : "```";
      return `\n\n${fence}\n${code}\n${fence}\n\n`;
    },
  });
  return turndown;
}

function cleanWebMarkdown(markdown, base) {
  return String(markdown ?? "")
    .replace(/\\([\[\]\.])/g, "$1")
    .replace(/\]\((\/[^)]+)\)/g, (_, path) => `](${stripTracking(path, base)})`)
    .replace(/https?:\/\/[^\s)]+/g, (url) => stripTracking(url, base))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function rewriteLinks($, root, sourceUrl) {
  root.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href || href.startsWith("data:")) return;
    $(link).attr("href", toAbsoluteUrl(href, sourceUrl));
  });
}

function pageTitleOf($) {
  const h1 = $("article.post h1").first();
  const raw = h1.length ? h1.text() : $("title").first().text();
  const text = String(raw)
    .replace(/\s+/g, " ")
    .replace(/\s*[—–-]\s*every\._ai\s*$/i, "")
    .trim();
  return text || PAGE_TITLE;
}

/** article 안의 배너, 복사 버튼, 스크립트만 뺀다. pre는 남긴다. */
function stripChrome(root) {
  root
    .find(
      "a.bootcamp-post-banner, nav, footer, section.challenge-banner, button, script, style, noscript, img[src*='claude-icon']"
    )
    .remove();
}

/** 읽는 시간과 공개일이 한 단어로 붙지 않게 공백을 둔다. */
function separateMetaSpans($, root) {
  root.find("div.sub span + span").each((_, span) => {
    $(span).before(" ");
  });
}

function selectContent($) {
  const article = $("article.post").first();
  if (!article.length) {
    throw new Error("본문 영역 article.post 를 찾지 못했습니다.");
  }
  const content = article.clone();
  stripChrome(content);
  separateMetaSpans($, content);
  return content;
}

function imageSlotToken(index) {
  return `EVIMG${index}TOKEN`;
}

/** 긴 base64는 마크다운 변환에 넣지 않는다. 자리표시로 바꾼 뒤 다시 끼운다. */
function stashBodyImages($, content) {
  const slots = [];
  for (const image of [...content.find("img").toArray()]) {
    const src = imageSrcOf(image, $);
    if (!src || src.includes("claude-icon") || src.includes("favicon")) {
      $(image).remove();
      continue;
    }
    if (!src.startsWith("data:image/png;base64,")) {
      throw new Error("본문 이미지가 PNG data URL이 아닙니다.");
    }
    assertPngSignature(bytesFromPngDataUrl(src));
    const alt = $(image).attr("alt") || "";
    slots.push({ alt, dataUrl: src });
    $(image).replaceWith(`<p>${imageSlotToken(slots.length - 1)}</p>`);
  }
  return slots;
}

function restoreBodyImages(markdown, slots) {
  let result = String(markdown);
  slots.forEach((slot, index) => {
    const token = imageSlotToken(index);
    if (!result.includes(token)) {
      throw new Error("이미지 자리표시가 없습니다.");
    }
    result = result.split(token).join(`![${slot.alt}](${slot.dataUrl})`);
  });
  if (/EVIMG\d+TOKEN/.test(result)) {
    throw new Error("이미지 자리표시가 남아 있습니다.");
  }
  return result;
}

/** 가이드 HTML을 저장용 마크다운으로 바꾼다. */
export function parseEveryAiHtml(html, sourceUrl = SOURCE_URL) {
  const storedUrl = storedSourceUrl(sourceUrl);
  const base = linkBaseOf(storedUrl);
  const $ = cheerio.load(html);
  const content = selectContent($);
  const title = pageTitleOf($);
  content.find("h1").first().remove();
  rewriteLinks($, content, base);
  const slots = stashBodyImages($, content);
  const htmlForMarkdown = content.html() || "";
  if (htmlForMarkdown.includes("data:image")) {
    throw new Error("이미지 data URL이 마크다운 변환 입력에 남아 있습니다.");
  }
  const articleMarkdown = createTurndown().turndown(htmlForMarkdown).trim();
  const cleaned = cleanWebMarkdown(articleMarkdown, base);
  const withImages = restoreBodyImages(cleaned, slots);
  const markdown = [
    `# ${title}`,
    `> 원문. [${SITE_NAME}](${storedUrl})`,
    withImages,
  ]
    .filter(Boolean)
    .join("\n\n")
    .replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, "\n\n![$1]($2)\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  for (const snippet of FORBIDDEN_SNIPPETS) {
    if (markdown.includes(snippet)) {
      throw new Error(`제거 대상이 본문에 남아 있습니다. ${snippet}`);
    }
  }
  if (/EVIMG\d+TOKEN/.test(markdown)) {
    throw new Error("이미지 자리표시가 남아 있습니다.");
  }
  return { title, markdown };
}

async function dataUrlFromResponse(response, url) {
  if (!response.ok) throw new Error(`이미지 HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assertPngSignature(bytes);
  const dataUrl = `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
  if (!hasNoExpiredUrl(dataUrl)) {
    throw new Error("만료 URL이 이미지 데이터에 남아 있습니다.");
  }
  if (!dataUrl.startsWith("data:image/png;base64,")) {
    throw new Error("이미지가 PNG data URL이 아닙니다.");
  }
  if (stripTracking(url).split("#")[0] === BODY_IMAGE_URL) {
    if (bytes.length !== BODY_IMAGE_BYTES) {
      throw new Error(`본문 이미지 바이트 수가 다릅니다. ${bytes.length}`);
    }
    const size = pngPixelSize(bytes);
    if (size.width !== BODY_IMAGE_WIDTH || size.height !== BODY_IMAGE_HEIGHT) {
      throw new Error(
        `본문 이미지 픽셀 크기가 다릅니다. ${size.width}x${size.height}`
      );
    }
  }
  return { dataUrl, bytes: bytes.length };
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
      if (response.ok) return dataUrlFromResponse(response, url);
      lastError = new Error(`이미지 HTTP ${response.status}. ${url}`);
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
    if (imageUrl.includes("claude-icon") || imageUrl.includes("favicon")) {
      $(image).remove();
      continue;
    }
    if (imageUrl.startsWith("data:")) {
      assertPngSignature(bytesFromPngDataUrl(imageUrl));
      $(image).attr("src", imageUrl);
      $(image).removeAttr("srcset");
      continue;
    }
    imageUrl = new URL(imageUrl, sourceUrl).href;
    if (stripTracking(imageUrl).split("#")[0] !== BODY_IMAGE_URL) {
      throw new Error("본문 이미지 주소가 다릅니다.");
    }
    if (($(image).attr("alt") || "") !== BODY_IMAGE_ALT) {
      throw new Error("본문 이미지 alt가 다릅니다.");
    }
    const { dataUrl } = await downloadImage(imageUrl, sourceUrl);
    $(image).attr("src", dataUrl);
    $(image).removeAttr("srcset");
  }
}

function filenameFromUrl(url) {
  try {
    const parsed = new URL(url);
    const name = decodeURIComponent(
      parsed.pathname.split("/").filter(Boolean).at(-1) || ""
    );
    return name || "";
  } catch {
    return "";
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

function httpLinksOf(markdown) {
  return [...String(markdown).matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(
    (match) => match[1]
  );
}

function assertIntegrity({ title, markdown, stats, content }) {
  if (title !== PAGE_TITLE) {
    throw new Error(`페이지 제목이 다릅니다. ${title}`);
  }
  if (title.includes("every._ai") || title.includes("—")) {
    throw new Error("페이지 제목에 사이트 접미가 남아 있습니다.");
  }
  if (!markdown.startsWith(`# ${PAGE_TITLE}`)) {
    throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
  }
  if (!markdown.includes(`> 원문. [${SITE_NAME}](${SOURCE_URL})`)) {
    throw new Error("원문 인용이 없습니다.");
  }
  for (const phrase of REQUIRED_PHRASES) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
    if (!content.includes(phrase)) {
      throw new Error(`저장 본문에 문구가 없습니다. ${phrase}`);
    }
  }
  const links = [
    ...httpLinksOf(markdown),
    ...stats.hrefs.filter((href) => /^https?:\/\//.test(href)),
  ];
  for (const link of links) {
    if (!ALLOWED_LINKS.includes(link)) {
      throw new Error(`허용되지 않은 링크입니다. ${link}`);
    }
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
  if (stats.codes !== EXPECTED_CODES) {
    throw new Error(`TipTap 코드 블록 수가 다릅니다. ${stats.codes}`);
  }
  const sources = imageSourcesOf(content);
  if (sources.length !== EXPECTED_IMAGES) {
    throw new Error(`본문 이미지 수가 다릅니다. ${sources.length}`);
  }
  for (const src of sources) {
    if (!src.startsWith("data:image/png;base64,")) {
      throw new Error("이미지가 PNG data URL이 아닙니다.");
    }
    const bytes = bytesFromPngDataUrl(src);
    assertPngSignature(bytes);
    if (bytes.length !== BODY_IMAGE_BYTES) {
      throw new Error(`본문 이미지 바이트 수가 다릅니다. ${bytes.length}`);
    }
    const size = pngPixelSize(bytes);
    if (size.width !== BODY_IMAGE_WIDTH || size.height !== BODY_IMAGE_HEIGHT) {
      throw new Error(
        `본문 이미지 픽셀 크기가 다릅니다. ${size.width}x${size.height}`
      );
    }
    if (!hasNoExpiredUrl(src)) {
      throw new Error("이미지에 만료 URL이 남아 있습니다.");
    }
  }
  if (!markdown.includes(`![${BODY_IMAGE_ALT}](data:image/png;base64,`)) {
    throw new Error("본문 이미지 alt가 다릅니다.");
  }
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(content)) {
    throw new Error("만료 URL이 본문에 남아 있습니다.");
  }
  for (const snippet of FORBIDDEN_SNIPPETS) {
    if (markdown.includes(snippet) || content.includes(snippet)) {
      throw new Error(`제거 대상이 저장 본문에 남아 있습니다. ${snippet}`);
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
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  const existing = findLocalPage(db, page.title, markers);
  // 기존 행은 고치지 않고 건너뛴다.
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
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  const existing = await findProductionPage(
    supabase,
    page.title,
    page.sourceUrl
  );
  // 기존 행은 고치지 않고 건너뛴다.
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

async function buildImportedPage() {
  const html = await fetchText(SOURCE_URL);
  const $ = cheerio.load(html);
  const article = $("article.post").first();
  if (!article.length) {
    throw new Error("본문 영역 article.post 를 찾지 못했습니다.");
  }
  stripChrome(article);
  await inlineBodyImages($, article, linkBaseOf(SOURCE_URL));
  await inlineAttachments($, article, linkBaseOf(SOURCE_URL));
  return parseEveryAiHtml($.html(), SOURCE_URL);
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const parsed = await buildImportedPage();
  const libs = loadLibs();
  const doc = libs.markdownToTiptapDoc(parsed.markdown);
  const content = JSON.stringify(doc);
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
