// AI TREND 한국인 전용 AI 스킬 사용 안내를 Pages에만 저장한다
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
const SITE_NAME = "AI TREND";
const JPEG_PREFIX = "data:image/jpeg;base64,";

export const SOURCE_URL =
  "https://agentc.live/shared/g-709b8e755c010fa7/view";
export const PAGE_TITLE = "한국인 전용 AI 스킬, 바로 쓰는 법";
export const IMAGE_ALT =
  "클로드 설정 화면. ① 기능 ② 외부 네트워크 접속 허용 켜기 ③ 도메인 허용 목록 모든 도메인";
export const EXPECTED_IMAGES = 1;
export const EXPECTED_ATTACHMENTS = 0;
export const EXPECTED_TABLES = 5;
export const EXPECTED_CODES = 7;
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
  "mcp_token",
  "eyJwaWQi",
];
const FORBIDDEN_SNIPPETS = ["mcp_token", "fbclid", "eyJwaWQi", "utm_source"];
const REQUIRED_PHRASES = [
  SOURCE_URL,
  "https://claude.ai/settings/capabilities",
  "https://nodejs.org",
  "https://github.com/NomaDamas/k-skill",
  "https://www.instagram.com/ai.trend.kr",
  "오늘의 5개",
  "전체 125개",
  "배송비까지 더한 최저가",
  "/plugin marketplace add NomaDamas/k-skill",
  "/plugin install k-skill@k-skill",
  "외부 네트워크 접속 허용",
  "철도 통합 시간표 조회",
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

/** 제목 또는 원문 식별자가 있으면 중복이다. 다른 설치 가이드 제목만으로는 중복이 아니다. */
export function isDuplicateRow(row, title, markers) {
  if (!row) return false;
  if (row.title === title) return true;
  const hay = `${row.source_url ?? ""}\n${row.content ?? ""}`;
  return markers.some((marker) => marker && hay.includes(marker));
}

/** JPEG data URL의 앞 바이트가 ffd8ff가 아니면 예외를 던진다. */
export function assertJpegDataUrl(url) {
  const value = String(url ?? "");
  if (!value.startsWith(JPEG_PREFIX)) {
    throw new Error("본문 이미지가 JPEG data URL이 아닙니다.");
  }
  const bytes = Buffer.from(value.slice(JPEG_PREFIX.length), "base64");
  const signature = Buffer.from(bytes.subarray(0, 3)).toString("hex");
  if (bytes.length < 3 || signature !== "ffd8ff") {
    throw new Error("JPEG 시그니처가 아닙니다.");
  }
  return value;
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

function imageAltsOf(tiptapJsonString) {
  const alts = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "image") alts.push(String(node.attrs?.alt ?? ""));
    for (const child of node.content ?? []) visit(child);
  }
  visit(JSON.parse(tiptapJsonString));
  return alts;
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
  return turndown;
}

/** 연도. 월. 일. 줄은 순서 목록으로 잘리지 않게 앞에 폭 없는 문자를 둔다. */
function protectDateLines(markdown) {
  return String(markdown).replace(
    /^(?=20\d{2}\.\s+\d{1,2}\.\s+\d{1,2}\.)/gm,
    "\u200b"
  );
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

function rewriteLinks($, root, sourceUrl) {
  root.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href || href.startsWith("data:") || href.startsWith("#")) return;
    $(link).attr("href", toAbsoluteUrl(href, sourceUrl));
  });
}

/** h1의 br은 공백으로 바꿔 저장 제목과 본문 첫머리를 맞춘다. */
function titleFrom(root) {
  const h1 = root.find("h1").first();
  if (!h1.length) return PAGE_TITLE;
  const text = String(h1.html() || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || PAGE_TITLE;
}

function selectContent($) {
  const page = $("div.page").first();
  if (!page.length) {
    throw new Error("본문 영역 div.page 를 찾지 못했습니다.");
  }
  return page.clone();
}

/** nav 안의 해시 앵커만 지운다. */
function removeHashNav($, root) {
  root.find("nav a[href]").each((_, link) => {
    const href = String($(link).attr("href") || "");
    if (href.startsWith("#")) $(link).remove();
  });
}

/** summary를 제목으로 두고 본문을 펼친다. 접히면 설정 화면 이미지가 빠진다. */
function unfoldDetails($, root) {
  const nodes = root.find("details").toArray().reverse();
  for (const details of nodes) {
    const node = $(details);
    const summaryText = node
      .children("summary")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim();
    const body = node.children("div.body").first();
    const block = $("<div></div>");
    if (summaryText) block.append($("<h3></h3>").text(summaryText));
    if (body.length) block.append(body.contents());
    else {
      node.children("summary").remove();
      block.append(node.contents());
    }
    node.replaceWith(block);
  }
}

/** 화면에 없는 data-copy-app 전체 프롬프트만 카드의 pre로 옮긴다. */
function liftAppPrompts($, root) {
  for (const button of root.find("button[data-copy-app]").toArray()) {
    const node = $(button);
    const value = String(node.attr("data-copy-app") ?? "");
    if (value.trim()) {
      const pre = $("<pre></pre>");
      pre.append($("<code></code>").text(value));
      const card = node.closest("article.card");
      if (card.length) card.append(pre);
      else node.before(pre);
    }
    node.remove();
  }
}

/** 설치 명령은 이미 code에 있다. pre로 한 번만 보이게 하고 버튼 문장은 넣지 않는다. */
function promoteInstallCode($, root) {
  for (const cmd of root.find("div.cmd").toArray()) {
    const node = $(cmd);
    const code = node.find("code").first();
    if (!code.length) continue;
    const pre = $("<pre></pre>");
    pre.append($("<code></code>").text(code.text()));
    node.replaceWith(pre);
  }
}

/** 복사 버튼이 아닌 버튼은 글만 남긴다. */
function keepButtonText($, root) {
  for (const button of root.find("button").toArray()) {
    const node = $(button);
    const text = node.text().replace(/\s+/g, " ").trim();
    if (!text || text === "복사" || text === "‹" || text === "›") {
      node.remove();
      continue;
    }
    const block = $("<div></div>");
    block.append(node.contents());
    node.replaceWith(block);
  }
}

function transformRoot($, root) {
  root.find("script, style, noscript").remove();
  removeHashNav($, root);
  unfoldDetails($, root);
  liftAppPrompts($, root);
  promoteInstallCode($, root);
  root.find("button[data-copy]").remove();
  keepButtonText($, root);
}

/**
 * 긴 JPEG data URL은 turndown에 넣지 않는다.
 * 목록 안의 이미지는 목록 뒤로 빼 TipTap이 한 줄 이미지로 읽게 한다.
 */
export function parkBodyImages($, root) {
  const parked = [];
  root.find("img").toArray().forEach((image, index) => {
    const node = $(image);
    const src = assertJpegDataUrl(node.attr("src") || "");
    const alt = String(node.attr("alt") || "")
      .replace(/\s+/g, " ")
      .trim();
    const token = `XAGENTCKSKILLIMG${index}X`;
    parked.push({ token, alt, src });
    const holder = $("<p></p>").text(token);
    const list = node.closest("ol, ul");
    if (list.length) list.after(holder);
    else node.before(holder);
    node.remove();
  });
  return parked;
}

/** 자리표시를 마크다운 이미지로 되돌린다. */
export function restoreParkedImages(markdown, parked) {
  let next = String(markdown ?? "");
  for (const item of parked ?? []) {
    if (!item?.token || !next.includes(item.token)) {
      throw new Error("이미지 자리표시가 마크다운에 없습니다.");
    }
    next = next.replaceAll(item.token, `![${item.alt}](${item.src})`);
  }
  next = next.replace(
    /^[ \t]+(!\[[^\]]*\]\(data:image\/[^)]+\))$/gm,
    "$1"
  );
  return next.replace(/\n{3,}/g, "\n\n").trim();
}

/** 저장 전에 추적 쿼리와 접힌 영역을 정리한 HTML이다. data URL은 자리표시로 빠져 있다. */
export function prepareAgentcFragment(html, sourceUrl = SOURCE_URL) {
  const storedUrl = storedSourceUrl(sourceUrl);
  const base = linkBaseOf(storedUrl);
  const $ = cheerio.load(html);
  const root = selectContent($);
  const title = titleFrom(root);
  root.find("h1").first().remove();
  transformRoot($, root);
  const parked = parkBodyImages($, root);
  rewriteLinks($, root, base);
  return {
    title,
    fragment: root.html() || "",
    parked,
    base,
    storedUrl,
  };
}

/** 안내 HTML을 저장용 마크다운으로 바꾼다. */
export function parseAgentcHtml(html, sourceUrl = SOURCE_URL) {
  const prepared = prepareAgentcFragment(html, sourceUrl);
  const articleMarkdown = createTurndown().turndown(prepared.fragment).trim();
  const cleaned = cleanWebMarkdown(articleMarkdown, prepared.base);
  const restored = restoreParkedImages(cleaned, prepared.parked);
  const markdown = [
    `# ${prepared.title}`,
    `> 원문. [${SITE_NAME}](${prepared.storedUrl})`,
    restored,
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
  return { title: prepared.title, markdown };
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

/** 토큰 쿼리 없이 원문 HTML만 받는다. */
async function fetchText(url) {
  const target = storedSourceUrl(url);
  const response = await fetch(target, {
    headers: {
      "user-agent": "Mozilla/5.0",
      referer: target,
    },
  });
  if (!response.ok) throw new Error(`원문 HTTP ${response.status}`);
  return response.text();
}

function assertIntegrity({ title, markdown, stats, content }) {
  if (title !== PAGE_TITLE) {
    throw new Error(`페이지 제목이 다릅니다. ${title}`);
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
  if (!markdown.includes(`![${IMAGE_ALT}](${JPEG_PREFIX}`)) {
    throw new Error("설정 화면 이미지 마크다운이 없습니다.");
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
  const alts = imageAltsOf(content);
  if (alts.length !== 1 || alts[0] !== IMAGE_ALT) {
    throw new Error("설정 화면 이미지 설명이 다릅니다.");
  }
  for (const src of sources) {
    assertJpegDataUrl(src);
    if (!hasNoExpiredUrl(src)) {
      throw new Error("이미지에 만료 URL이 남아 있습니다.");
    }
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

/** 같은 제목이나 원문 주소가 있으면 넣지 않는다. 기존 행은 고치지 않는다. */
function importLocal(page, markers, libs) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
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

/** 운영 DB도 없을 때만 넣고, 이미 있으면 건너뛴다. */
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
  const page = $("div.page").first();
  if (!page.length) {
    throw new Error("본문 영역 div.page 를 찾지 못했습니다.");
  }
  await inlineAttachments($, page, linkBaseOf(SOURCE_URL));
  return parseAgentcHtml($.html(), SOURCE_URL);
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
