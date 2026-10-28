// 낭만빌더 김스듴 MCP와 API 문서 가이드를 Pages에만 저장한다.
import { createHash, randomUUID } from "node:crypto";
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
const SITE_NAME = "낭만빌더 김스듴";

export const SOURCE_URL =
  "https://sdk-kim-builds.com/guides/mcp-vs-api-docs-claude-code";
export const PAGE_TITLE =
  "MCP는 이제 구닥다리: 코드 짜는 AI에는 API 문서를 주세요";
export const OG_IMAGE_URL =
  "https://sdk-kim-builds.com/og/guides/mcp-vs-api-docs-claude-code.png";
export const OG_IMAGE_BYTES = 30405;
export const OG_IMAGE_SHA256 =
  "d915e73269cf773c30983a4fab2bd5c5c814ef56a1763319b80acaee561fb0fa";
export const EXPECTED_IMAGES = 1;
export const EXPECTED_ATTACHMENTS = 0;
export const EXPECTED_TABLES = 2;
export const EXPECTED_CODES = 3;
export const EXPECTED_LINKS = 2;
export const ANTHROPIC_URL =
  "https://www.anthropic.com/research/code-execution-with-mcp";

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
const FORBIDDEN_SNIPPETS = [
  "30일",
  "이메일 알림",
  "개인정보 수집",
  "지금 다 못 읽겠다면",
  "android-tv-ads-cleanup",
  "오픈카톡",
  "FOR TEAMS",
  "도입 상담",
  "/privacy",
  "kakao",
  "fbclid",
  "utm_source",
  "utm_medium",
];
const REQUIRED_PHRASES = [
  SOURCE_URL,
  "직접 재본 결과",
  "2026. 10. 27.",
  "2026-10-21",
  ANTHROPIC_URL,
  "약 11.2만",
  "claude mcp list",
  "SKILL.md",
  "7.4배",
  "개발",
];
const CHROME_SELECTOR = [
  "header.home-header",
  "footer.home-footer",
  "aside.guide-detail__cta",
  "aside.guide-mid-cta",
  "a.guide-detail__back",
  "section.guide-inquiry-block",
  "aside.guide-subscribe",
  "nav.guide-next",
  "details.guide-toc",
  "details.guide-mail",
  ".guide-waitlist",
].join(", ");

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

/** 저장용 원문 주소는 끝 슬래시 없이 맞춘다. */
export function storedSourceUrl(url = SOURCE_URL) {
  const cleaned = stripTracking(url || SOURCE_URL).replace(/\/+$/, "");
  return cleaned || SOURCE_URL;
}

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

/** 제목 또는 원문 주소가 같으면 중복이다. 본문 언급은 중복이 아니다. */
export function isDuplicateRow(row, title, markers) {
  if (!row) return false;
  if (row.title === title) return true;
  const raw = String(row.source_url || "").trim();
  if (!raw) return false;
  const source = storedSourceUrl(raw);
  return markers.some((marker) => source === storedSourceUrl(marker));
}

/** SVG를 포함해 이미지 MIME을 판별한다. */
export function mediaMime(bytes, header) {
  const head = Buffer.from(bytes.subarray(0, 200)).toString("utf8");
  if (head.includes("<svg") || head.includes("<?xml")) return "image/svg+xml";
  try {
    return imageMime(bytes, header);
  } catch {
    if (header?.startsWith("image/")) return header.split(";")[0];
    throw new Error("이미지 MIME을 판별하지 못했습니다.");
  }
}

function loadLibs() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(resolve(root, "src/lib/markdown-to-tiptap.ts"));
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
              $table(cell).text().replace(/\s+/g, " ").replace(/\|/g, "\\|").trim()
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

/** 연도. 월. 일. 줄은 순서 목록으로 잘리지 않게 앞에 폭 없는 문자를 둔다. */
function protectDateLines(markdown) {
  return String(markdown).replace(/^(?=20\d{2}\.\s+\d{1,2}\.\s+\d{1,2}\.)/gm, "\u200b");
}

function cleanWebMarkdown(markdown, base) {
  return protectDateLines(
    String(markdown ?? "")
      .replace(/\\([\[\]\.])/g, "$1")
      .replace(/\]\((\/[^)]+)\)/g, (_, path) => `](${stripTracking(path, base)})`)
      .replace(/https?:\/\/[^\s)]+/g, (url) => stripTracking(url, base))
      .replace(/\n{3,}/g, "\n\n")
  ).trim();
}

function rewriteLinks($, content, sourceUrl) {
  content.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href || href.startsWith("data:")) return;
    $(link).attr("href", toAbsoluteUrl(href, sourceUrl));
  });
}

function pageTitleOf($) {
  const h1 = $("article.guide-detail h1").first();
  if (!h1.length) return PAGE_TITLE;
  const clone = h1.clone();
  clone.find("br").replaceWith(" ");
  const text = clone
    .text()
    .replace(/\s+/g, " ")
    .replace(/\s*[|\-–—]\s*낭만빌더.*$/, "")
    .trim();
  return text || PAGE_TITLE;
}

/** 헤더·메일 받기·대기자 카드·도입 문의·다음 글·목차를 뺀다. */
function stripChrome(root) {
  root.find(CHROME_SELECTOR).remove();
  root.find("script, style, noscript").remove();
}

function selectContent($) {
  const article = $("article.guide-detail").first();
  if (!article.length) throw new Error("본문 영역 article.guide-detail 을 찾지 못했습니다.");
  const content = article.clone();
  stripChrome(content);
  return content;
}

/** 가이드 HTML을 저장용 마크다운으로 바꾼다. */
export function parseSdkKimHtml(html, sourceUrl = SOURCE_URL, cover = "") {
  const storedUrl = storedSourceUrl(sourceUrl);
  const base = linkBaseOf(storedUrl);
  const $ = cheerio.load(html);
  const content = selectContent($);
  const title = pageTitleOf($);
  content.find("h1").first().remove();
  rewriteLinks($, content, base);
  const articleMarkdown = createTurndown().turndown(content.html() || "").trim();
  const cleaned = cleanWebMarkdown(articleMarkdown, base);
  const markdown = [`# ${title}`, `> 원문. [${SITE_NAME}](${storedUrl})`, cover, cleaned]
    .filter(Boolean)
    .join("\n\n")
    .replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, "\n\n![$1]($2)\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  for (const snippet of FORBIDDEN_SNIPPETS) {
    if (markdown.includes(snippet)) throw new Error(`제거 대상이 본문에 남아 있습니다. ${snippet}`);
  }
  return { title, markdown };
}

async function dataUrlFromResponse(response) {
  if (!response.ok) throw new Error(`이미지 HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const dataUrl = `data:${mediaMime(bytes, response.headers.get("content-type"))};base64,${Buffer.from(bytes).toString("base64")}`;
  if (!hasNoExpiredUrl(dataUrl)) throw new Error("만료 URL이 이미지 데이터에 남아 있습니다.");
  if (!dataUrl.startsWith("data:image")) throw new Error("이미지가 data URL이 아닙니다.");
  return { dataUrl, bytes };
}

async function downloadImage(url, referer) {
  let lastError = new Error("이미지를 받지 못했습니다.");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0", referer: referer || url },
      });
      if (response.ok) return dataUrlFromResponse(response);
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
    if (!imageUrl) throw new Error("이미지 URL이 없습니다.");
    if (String(imageUrl).includes("favicon")) {
      $(image).remove();
      continue;
    }
    if (imageUrl.startsWith("data:")) {
      if (!imageUrl.startsWith("data:image")) throw new Error("이미지가 data URL이 아닙니다.");
      $(image).attr("src", imageUrl);
      continue;
    }
    imageUrl = new URL(imageUrl, sourceUrl).href;
    const { dataUrl } = await downloadImage(imageUrl, sourceUrl);
    $(image).attr("src", dataUrl);
    $(image).removeAttr("srcset");
  }
}

function filenameFromUrl(url) {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).at(-1) || "");
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
    const filename = filenameFromUrl(abs) || $(link).text().replace(/\s+/g, " ").trim() || "첨부 파일";
    if (/\.zip$/i.test(filename) || /\.zip(?:$|[?#])/i.test(abs)) {
      throw new Error("ZIP 첨부는 page-attachment-storage 화이트리스트가 필요합니다.");
    }
    const response = await fetch(abs, {
      headers: { "user-agent": "Mozilla/5.0", referer: sourceUrl },
    });
    if (!response.ok) throw new Error(`첨부 HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (isZipBytes(bytes, filename)) {
      throw new Error("ZIP 첨부는 page-attachment-storage 화이트리스트가 필요합니다.");
    }
    const markdown = assertDownloadableAttachment(filename, bytes, response.headers.get("content-type"));
    const dataUrl = markdown.slice(markdown.indexOf("(") + 1, markdown.lastIndexOf(")"));
    $(link).attr("href", dataUrl);
    if (!$(link).text().trim()) $(link).text(filename);
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0", referer: url },
  });
  if (!response.ok) throw new Error(`원문 HTTP ${response.status}`);
  return response.text();
}

function assertIntegrity({ title, markdown, stats, content }) {
  if (title !== PAGE_TITLE) throw new Error(`페이지 제목이 다릅니다. ${title}`);
  if (!markdown.startsWith(`# ${PAGE_TITLE}`)) {
    throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
  }
  if (!markdown.includes(`> 원문. [${SITE_NAME}](${SOURCE_URL})`)) {
    throw new Error("원문 인용이 없습니다.");
  }
  if (!markdown.includes("\u200b2026. 10. 27.")) {
    throw new Error("날짜 줄 보호 문자가 없습니다.");
  }
  for (const phrase of REQUIRED_PHRASES) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
    if (!content.includes(phrase)) throw new Error(`저장 본문에 문구가 없습니다. ${phrase}`);
  }
  if (stats.images !== EXPECTED_IMAGES) throw new Error(`TipTap 이미지 수가 다릅니다. ${stats.images}`);
  if (stats.attachments !== EXPECTED_ATTACHMENTS) {
    throw new Error(`TipTap 첨부 수가 다릅니다. ${stats.attachments}`);
  }
  if (stats.tables !== EXPECTED_TABLES) throw new Error(`TipTap 표 수가 다릅니다. ${stats.tables}`);
  if (stats.codes !== EXPECTED_CODES) throw new Error(`TipTap 코드 블록 수가 다릅니다. ${stats.codes}`);
  if (stats.links !== EXPECTED_LINKS) throw new Error(`TipTap 링크 수가 다릅니다. ${stats.links}`);
  const hrefs = new Set(stats.hrefs);
  for (const href of [SOURCE_URL, ANTHROPIC_URL]) {
    if (!hrefs.has(href)) throw new Error(`TipTap 링크가 없습니다. ${href}`);
  }
  const sources = imageSourcesOf(content);
  if (sources.length !== EXPECTED_IMAGES) throw new Error(`본문 이미지 수가 다릅니다. ${sources.length}`);
  for (const src of sources) {
    if (!src.startsWith("data:image")) throw new Error("이미지가 data URL이 아닙니다.");
    if (!hasNoExpiredUrl(src)) throw new Error("이미지에 만료 URL이 남아 있습니다.");
  }
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(content)) {
    throw new Error("만료 URL이 본문에 남아 있습니다.");
  }
  for (const snippet of FORBIDDEN_SNIPPETS) {
    if (markdown.includes(snippet) || content.includes(snippet)) {
      throw new Error(`제거 대상이 저장 본문에 남아 있습니다. ${snippet}`);
    }
  }
  if (content.length > 1_500_000) throw new Error(`본문이 저장 한도를 넘습니다. ${content.length}`);
}

function sqliteHasFindability(db) {
  const cols = db.prepare("PRAGMA table_info(custom_pages)").all().map((column) => column.name);
  return ["tags", "source_url", "search_text", "is_favorite"].every((name) => cols.includes(name));
}

function pageColumns(db) {
  return db.prepare("PRAGMA table_info(custom_pages)").all().map((column) => column.name);
}

function markersOf() {
  return [SOURCE_URL, `${SOURCE_URL}/`];
}

function findLocalPage(db, title, markers) {
  const cols = pageColumns(db);
  const fields = ["id", "title"];
  if (cols.includes("source_url")) fields.push("source_url");
  const select = fields.join(", ");
  const byTitle = db
    .prepare(`SELECT ${select} FROM custom_pages WHERE user_id = ? AND title = ?`)
    .get(LOCAL_USER, title);
  if (isDuplicateRow(byTitle, title, markers)) return byTitle;
  if (!cols.includes("source_url")) return null;
  for (const marker of markers) {
    const row = db
      .prepare(`SELECT ${select} FROM custom_pages WHERE user_id = ? AND source_url = ? LIMIT 1`)
      .get(LOCAL_USER, marker);
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

function importLocal(page, libs) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  const existing = findLocalPage(db, page.title, markersOf());
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

async function findProductionPage(supabase, title) {
  const byTitle = await supabase
    .from("custom_pages")
    .select("id, title")
    .eq("user_id", PROD_USER)
    .eq("title", title)
    .limit(1);
  if (byTitle.error) throw byTitle.error;
  if (byTitle.data?.[0]) return byTitle.data[0];
  for (const marker of markersOf()) {
    const bySource = await supabase
      .from("custom_pages")
      .select("id, title")
      .eq("user_id", PROD_USER)
      .eq("source_url", marker)
      .limit(1);
    if (bySource.error) throw bySource.error;
    if (bySource.data?.[0]) return bySource.data[0];
  }
  return null;
}

async function importProduction(page, libs) {
  const supabase = createSupabase();
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  const existing = await findProductionPage(supabase, page.title);
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

async function savedOnBothSides() {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  let local = null;
  try {
    local = findLocalPage(db, PAGE_TITLE, markersOf());
  } finally {
    db.close();
  }
  const production = await findProductionPage(createSupabase(), PAGE_TITLE);
  if (!local && !production) return null;
  if (!local || !production) {
    throw new Error(`로컬과 운영 중 한쪽에만 글이 있습니다. ${SOURCE_URL}`);
  }
  if (local.id !== production.id) {
    throw new Error(`로컬과 운영의 페이지 id가 다릅니다. ${SOURCE_URL}`);
  }
  return {
    pageTitle: PAGE_TITLE,
    pageId: local.id,
    path: `/pages/${local.id}`,
    local: { action: "skip", pages: 0, pageSkips: 1 },
    production: { action: "skip", pages: 0, pageSkips: 1 },
  };
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

function pngSize(bytes) {
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return { width: 0, height: 0 };
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function buildImportedPage() {
  const html = await fetchText(SOURCE_URL);
  const $ = cheerio.load(html);
  const article = $("article.guide-detail").first();
  if (!article.length) throw new Error("본문 영역 article.guide-detail 을 찾지 못했습니다.");
  stripChrome(article);
  await inlineBodyImages($, article, linkBaseOf(SOURCE_URL));
  await inlineAttachments($, article, linkBaseOf(SOURCE_URL));
  const cover = await downloadImage(OG_IMAGE_URL, SOURCE_URL);
  if (cover.bytes.length !== OG_IMAGE_BYTES) {
    throw new Error(`OG 이미지 크기가 다릅니다. ${cover.bytes.length}`);
  }
  const sha256 = createHash("sha256").update(cover.bytes).digest("hex");
  if (sha256 !== OG_IMAGE_SHA256) throw new Error("OG 이미지 해시가 다릅니다.");
  const parsed = parseSdkKimHtml($.html(), SOURCE_URL, `![표지](${cover.dataUrl})`);
  return { ...parsed, coverBytes: cover.bytes.length, coverSha256: sha256, ...pngSize(Buffer.from(cover.bytes)) };
}

function summaryOf(parsed, content, stats) {
  return {
    pageTitle: parsed.title,
    sourceUrl: SOURCE_URL,
    images: stats.images,
    tables: stats.tables,
    codes: stats.codes,
    links: stats.links,
    attachments: stats.attachments,
    length: content.length,
    hash: createHash("sha256").update(content).digest("hex"),
    coverBytes: parsed.coverBytes,
    coverSha256: parsed.coverSha256,
    coverWidth: parsed.width,
    coverHeight: parsed.height,
  };
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
  const parsed = await buildImportedPage();
  const content = JSON.stringify(libs.markdownToTiptapDoc(parsed.markdown));
  const stats = documentStats(content);
  assertIntegrity({ title: parsed.title, markdown: parsed.markdown, stats, content });
  const extra = summaryOf(parsed, content, stats);
  if (checkOnly) {
    emit(extra);
    return;
  }
  emit(await persist(content, extra, libs));
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) await main();
