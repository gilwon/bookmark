// newvibot 디자인 시스템 글을 Pages에만 저장한다.
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import Database from "better-sqlite3";
import TurndownService from "turndown";
import { documentStats, imageMime } from "./import-claude-eli5-page.mjs";
import {
  canonicalPostUrl,
  decideSkip,
  imageDataUrl,
  isDuplicateRow,
  sourceMarkers,
  stripTracking,
} from "./import-every-ai-index-20261013.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const SITE_NAME = "VacayBuddy";
const TRACKING_KEY = ["fb", "clid"].join("");

export const SOURCE_URL =
  "https://newvibot.com/ko/blog/ai-frontend-design-system";
export const PAGE_TITLE =
  "AI로 만든 프론트, AI처럼 안 보이게 — 디자인 시스템을 먼저 만든 이유";
export const MEDIUM_URL =
  "https://medium.com/@letnaturebe2/%EB%B0%B1%EC%97%94%EB%93%9C-%EA%B0%9C%EB%B0%9C%EC%9E%90%EA%B0%80-htmx%EB%A1%9C-%ED%94%84%EB%A1%A0%ED%8A%B8%EB%A5%BC-%EA%B1%B7%EC%96%B4%EB%82%B8-%EC%9D%B4%EC%95%BC%EA%B8%B0-82f985c08896";
export const RELATED_URL =
  "https://newvibot.com/ko/blog/leave-calendar-redesign-2026";
export const EXPECTED_IMAGES = 10;
export const EXPECTED_ATTACHMENTS = 0;
export const EXPECTED_TABLES = 3;
export const EXPECTED_CODES = 0;
export const IMAGE_FILES = [
  "hong.jpg",
  "team-calendar-before.png",
  "team-calendar.png",
  "team-pto-before.png",
  "design-system-reference.png",
  "design-system-components.png",
  "compare-request-detail.png",
  "compare-calendar-mobile.png",
  "pto-manage-before.png",
  "pto-manage.png",
];
export const REQUIRED_HREFS = [SOURCE_URL, MEDIUM_URL, RELATED_URL];
export const REQUIRED_HEADINGS = [
  "1. AI가 짠 화면은 왜 AI처럼 보일까",
  "2. 기준 페이지를 먼저 만들고, 모든 화면이 거기서 가져다 쓴다",
  "2-1. 기준 페이지 — 색·버튼·표·모달을 한 곳에",
  "2-2. 없는 컴포넌트는 디자인 시스템에 먼저, 화면은 조합으로",
  "2-3. 기준 밖의 값은 아예 안 나오게 막는다",
  "3. 전환 — 페이지 하나씩 차례로",
  "4. 검증 — 잴 수 있는 건 자동으로, 화면은 사람이 본다",
  "5. 디자인 시스템만 다듬으면 화면이 따라온다",
  "6. 숫자로 정리",
  "마치며",
];
const FORBIDDEN_SNIPPETS = [
  "googletagmanager",
  "gclid",
  "utm_source",
  "slack_icon",
  "Privacy Policy",
  TRACKING_KEY,
];
const EXPIRED_URL_PARTS = [
  "prod-files-secure",
  "file.notion.so",
  "expirationTimestamp",
  "X-Amz",
  "blob:",
];
const DROPPED_IMAGE_NAMES = new Set([
  "logo.png",
  "title-logo.png",
  "slack_icon.png",
]);

const envPath = resolve(root, [".", "env", ".local"].join(""));
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

function visibleText(text) {
  return String(text ?? "").replace(
    /data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi,
    "data:"
  );
}

function emit(payload) {
  const text = JSON.stringify(payload);
  if (text.includes("data:")) throw new Error("출력에 data URL이 있습니다.");
  console.log(text);
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

// 링크 주소만 https로 올린다. 코드 펜스 안 주소는 여기서 바꾸지 않는다.
function upgradeHttp(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (
      parsed.protocol === "http:" &&
      host !== "localhost" &&
      host !== "127.0.0.1"
    ) {
      parsed.protocol = "https:";
    }
    return parsed.href;
  } catch {
    return url;
  }
}

function toAbsoluteUrl(url, base) {
  if (
    !url ||
    url.startsWith("data:") ||
    url.startsWith("mailto:") ||
    url.startsWith("#")
  ) {
    return url;
  }
  return upgradeHttp(stripTracking(url, base));
}

function imageSrcOf(image, $) {
  return (
    $(image).attr("src") ||
    $(image).attr("data-src") ||
    $(image).attr("data-lazy-src") ||
    ""
  );
}

function filenameFromUrl(url) {
  try {
    const parsed = new URL(url, SOURCE_URL);
    const name = decodeURIComponent(
      parsed.pathname.split("/").filter(Boolean).at(-1) || ""
    );
    return name || "";
  } catch {
    return "";
  }
}

function isDroppedImage(src) {
  if (!src || src.startsWith("data:")) return false;
  const name = filenameFromUrl(src).toLowerCase();
  if (DROPPED_IMAGE_NAMES.has(name)) return true;
  return src.includes("slack_icon") || src.includes("googletagmanager");
}

function bytesFromImageDataUrl(dataUrl) {
  const match =
    /^data:image\/(?:png|jpeg|gif|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      String(dataUrl)
    );
  if (!match) throw new Error("이미지 data URL이 아닙니다.");
  return Buffer.from(match[1], "base64");
}

async function fetchWithRetry(url, referer) {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0",
        referer: referer || `${SOURCE_URL}`,
      },
    });
    if (response.ok) return response;
    lastStatus = response.status;
    if (response.status !== 429 && response.status !== 503) break;
    await pause(1000 * (attempt + 1));
  }
  throw new Error(`HTTP ${lastStatus}. ${new URL(url).pathname}`);
}

// 로고는 빼고 본문 사진은 data URL로 남긴다.
async function inlineBodyImages($, content) {
  const names = [];
  for (const image of [...content.find("img").toArray()]) {
    let imageUrl = imageSrcOf(image, $);
    if (!imageUrl || isDroppedImage(imageUrl)) {
      $(image).remove();
      continue;
    }
    if (imageUrl.startsWith("data:image/")) {
      imageMime(bytesFromImageDataUrl(imageUrl));
      $(image).removeAttr("srcset");
      continue;
    }
    imageUrl = toAbsoluteUrl(imageUrl, SOURCE_URL);
    const name = filenameFromUrl(imageUrl);
    if (name) names.push(name);
    const response = await fetchWithRetry(imageUrl, SOURCE_URL);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const dataUrl = imageDataUrl(bytes, response.headers.get("content-type"));
    $(image).attr("src", dataUrl);
    $(image).removeAttr("srcset");
  }
  return names;
}

function cellText($, cell) {
  const clone = $(cell).clone();
  clone.find("a[href]").each((_, anchor) => {
    const href = $(anchor).attr("href") || "";
    const label =
      $(anchor).text().replace(/\s+/g, " ").replace(/[\[\]]/g, "").trim() ||
      href;
    $(anchor).replaceWith(`[${label}](${href})`);
  });
  return clone
    .text()
    .replace(/\s+/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function createTurndown() {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  turndown.addRule("figcaption", {
    filter: "figcaption",
    replacement(content) {
      const text = String(content).replace(/\s+/g, " ").trim();
      return text ? `\n\n${text}\n\n` : "";
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
            cells.push(cellText($table, cell));
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

function mapFencedLines(markdown, outside, inside) {
  const lines = String(markdown ?? "").split("\n");
  let inFence = false;
  return lines
    .map((line) => {
      if (/^(```+|~~~+)/.test(line.trim())) {
        inFence = !inFence;
        return line;
      }
      return inFence ? inside(line) : outside(line);
    })
    .join("\n");
}

function rewriteUrlOutside(url, base) {
  return upgradeHttp(stripTracking(url, base));
}

// 펜스 밖 날짜 줄은 순서 목록으로 먹히지 않게 폭 없는 문자를 붙인다.
function protectDateLines(markdown) {
  const lines = String(markdown ?? "").split("\n");
  let inFence = false;
  return lines
    .map((line) => {
      if (/^(```+|~~~+)/.test(line.trim())) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      if (/^\u200B/.test(line)) return line;
      if (/^\d{4}\.\s+\d{1,2}\./.test(line)) return `\u200B${line}`;
      return line;
    })
    .join("\n");
}

function cleanWebMarkdown(markdown, base) {
  const rewritten = mapFencedLines(
    markdown,
    (line) =>
      line
        .replace(/\\([\[\]\.])/g, "$1")
        .replace(
          /\]\((\/[^)]+)\)/g,
          (_, path) => `](${rewriteUrlOutside(path, base)})`
        )
        .replace(/https?:\/\/[^\s)]+/g, (url) => rewriteUrlOutside(url, base)),
    (line) => line.replace(/https?:\/\/[^\s)]+/g, (url) => stripTracking(url))
  );
  return protectDateLines(rewritten).replace(/\n{3,}/g, "\n\n").trim();
}

function rewriteLinks($, content) {
  content.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href || href.startsWith("data:") || href.startsWith("mailto:")) return;
    $(link).attr("href", toAbsoluteUrl(href, SOURCE_URL));
  });
}

// 네트워크 없이 저장용 제목과 마크다운을 만든다.
export function pageFromHtml(html) {
  const $ = cheerio.load(html);
  const article = $("article").first();
  if (!article.length) throw new Error("본문 영역 article 을 찾지 못했습니다.");
  const heading = article.find("h1").first().text().replace(/\s+/g, " ").trim();
  article.find("script, style, noscript, svg, nav, footer, header").remove();
  article.find("img").each((_, image) => {
    if (isDroppedImage(imageSrcOf(image, $))) $(image).remove();
  });
  article.find("h1").remove();
  rewriteLinks($, article);
  const body = createTurndown().turndown(article.html() || "").trim();
  const title = heading || PAGE_TITLE;
  const markdown = cleanWebMarkdown(
    `# ${title}\n\n> 원문. [${SITE_NAME}](${SOURCE_URL})\n\n${body}`,
    SOURCE_URL
  );
  return { title, markdown };
}

async function downloadedPage(html) {
  const $ = cheerio.load(html);
  const article = $("article").first();
  if (!article.length) throw new Error("본문 영역 article 을 찾지 못했습니다.");
  article.find("script, style, noscript, svg, nav, footer, header").remove();
  const imageNames = await inlineBodyImages($, article);
  const built = pageFromHtml($.html());
  return { ...built, imageNames };
}

function publicHrefs(hrefs) {
  return [
    ...new Set(
      (hrefs ?? []).filter((href) => !String(href).startsWith("data:"))
    ),
  ].sort();
}

// 라이브 변환 결과가 기대와 다르면 저장하지 않는다.
function assertLive({ title, markdown, stats, content, imageNames }) {
  if (title !== PAGE_TITLE) throw new Error("제목이 다릅니다.");
  const quote = `> 원문. [${SITE_NAME}](${SOURCE_URL})`;
  if (!markdown.includes(quote)) throw new Error("원문 인용이 없습니다.");
  if (stats.images !== EXPECTED_IMAGES) {
    throw new Error(`이미지 수가 다릅니다. ${stats.images}`);
  }
  if (stats.attachments !== EXPECTED_ATTACHMENTS) {
    throw new Error(`첨부 수가 다릅니다. ${stats.attachments}`);
  }
  if (stats.tables !== EXPECTED_TABLES) {
    throw new Error(`표 수가 다릅니다. ${stats.tables}`);
  }
  if (stats.codes !== EXPECTED_CODES) {
    throw new Error(`코드 수가 다릅니다. ${stats.codes}`);
  }
  for (const heading of REQUIRED_HEADINGS) {
    if (!markdown.includes(heading)) {
      throw new Error(`헤딩이 없습니다. ${heading}`);
    }
  }
  if (!markdown.includes("홍길동") || !markdown.includes("2026년 10월 14일")) {
    throw new Error("작성자 또는 날짜가 없습니다.");
  }
  if (!markdown.includes("개편 후. 같은 가상 조직 데이터로 찍었습니다.")) {
    throw new Error("캡션이 없습니다.");
  }
  if (!markdown.includes("`ADMIN`") && !markdown.includes("ADMIN")) {
    throw new Error("인라인 코드가 없습니다.");
  }
  const actual = publicHrefs(stats.hrefs);
  const expected = [...REQUIRED_HREFS].sort();
  if (
    actual.length !== expected.length ||
    actual.some((href, index) => href !== expected[index])
  ) {
    throw new Error(`링크가 다릅니다. ${actual.join(" ")}`);
  }
  const names = [...(imageNames ?? [])].sort();
  const files = [...IMAGE_FILES].sort();
  if (names.length !== files.length || names.some((name, index) => name !== files[index])) {
    throw new Error(`이미지 파일이 다릅니다. ${names.join(" ")}`);
  }
  const plainMarkdown = visibleText(markdown);
  const plainContent = visibleText(content);
  for (const snippet of FORBIDDEN_SNIPPETS) {
    if (plainMarkdown.includes(snippet) || plainContent.includes(snippet)) {
      throw new Error(`제거 대상이 본문에 남아 있습니다. ${snippet}`);
    }
  }
  for (const part of EXPIRED_URL_PARTS) {
    if (plainMarkdown.includes(part) || plainContent.includes(part)) {
      throw new Error(`만료 URL이 본문에 남아 있습니다. ${part}`);
    }
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

function loadLocalRows(db) {
  const cols = db
    .prepare("PRAGMA table_info(custom_pages)")
    .all()
    .map((column) => column.name);
  const fields = ["id", "title"];
  if (cols.includes("source_url")) fields.push("source_url");
  return db
    .prepare(
      `SELECT ${fields.join(", ")} FROM custom_pages WHERE user_id = ?`
    )
    .all(LOCAL_USER);
}

function findRow(rows, title, markers) {
  for (const row of rows ?? []) {
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
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  try {
    const existing = findRow(loadLocalRows(db), page.title, markers);
    if (existing) {
      result.pageSkips += 1;
      result.pageId = existing.id;
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
    return result;
  } finally {
    db.close();
  }
}

async function loadProductionRows(supabase) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("custom_pages")
      .select("id, title, source_url")
      .eq("user_id", PROD_USER)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function findProductionPage(supabase, title, markers) {
  if (title) {
    const { data, error } = await supabase
      .from("custom_pages")
      .select("id, title, source_url")
      .eq("user_id", PROD_USER)
      .eq("title", title)
      .limit(1);
    if (error) throw error;
    if (isDuplicateRow(data?.[0], title, markers)) return data[0];
  }
  for (const marker of markers) {
    if (!marker) continue;
    const bySource = await supabase
      .from("custom_pages")
      .select("id, title, source_url")
      .eq("user_id", PROD_USER)
      .eq("source_url", marker)
      .limit(1);
    if (bySource.error) {
      if (/source_url/i.test(bySource.error.message)) return null;
      throw bySource.error;
    }
    if (isDuplicateRow(bySource.data?.[0], title, markers)) {
      return bySource.data[0];
    }
  }
  return null;
}

async function importProduction(supabase, page, markers, libs) {
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  const existing = await findProductionPage(supabase, page.title, markers);
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

async function persist(supabase, page, libs, preferredId) {
  const now = new Date().toISOString();
  const record = {
    id: preferredId || randomUUID(),
    title: page.title,
    content: page.content,
    sourceUrl: page.sourceUrl,
    created_at: now,
    updated_at: now,
  };
  const markers = sourceMarkers(page.sourceUrl);
  const local = importLocal(record, markers, libs);
  record.id = local.pageId;
  let production;
  try {
    production = await importProduction(supabase, record, markers, libs);
  } catch (error) {
    // 이번 실행에서 넣은 로컬 행만 지운다. 원래 있던 행은 남긴다.
    if (local.pages === 1) {
      const db = new Database(resolve(root, "data/mymark.db"));
      try {
        db.prepare(
          "DELETE FROM custom_pages WHERE id = ? AND user_id = ?"
        ).run(record.id, LOCAL_USER);
      } finally {
        db.close();
      }
    }
    throw error;
  }
  const pageId = production.pageSkips ? production.pageId : local.pageId;
  return {
    pageId: pageId || local.pageId,
    localPages: local.pages,
    localSkips: local.pageSkips,
    prodPages: production.pages,
    prodSkips: production.pageSkips,
  };
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  const libs = loadLibs();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const localDb = new Database(resolve(root, "data/mymark.db"), {
    readonly: true,
  });
  let localRows;
  try {
    localRows = loadLocalRows(localDb);
  } finally {
    localDb.close();
  }
  const prodRows = await loadProductionRows(supabase);
  const markers = sourceMarkers(SOURCE_URL);
  const decision = decideSkip(localRows, prodRows, PAGE_TITLE, markers);
  if (decision.skip) {
    emit({
      action: "skip",
      title: decision.title,
      pageId: decision.pageId,
      sourceUrl: SOURCE_URL,
    });
    return;
  }
  const html = await (
    await fetchWithRetry(SOURCE_URL, "https://newvibot.com/")
  ).text();
  const built = await downloadedPage(html);
  const content = JSON.stringify(libs.markdownToTiptapDoc(built.markdown));
  const stats = documentStats(content);
  assertLive({
    title: built.title,
    markdown: built.markdown,
    stats,
    content,
    imageNames: built.imageNames,
  });
  const again = decideSkip(localRows, prodRows, built.title, markers);
  if (again.skip) {
    emit({
      action: "skip",
      title: again.title,
      pageId: again.pageId,
      sourceUrl: SOURCE_URL,
    });
    return;
  }
  if (checkOnly) {
    emit({
      action: "check",
      title: built.title,
      sourceUrl: SOURCE_URL,
      images: stats.images,
      attachments: stats.attachments,
      tables: stats.tables,
      codes: stats.codes,
      hrefs: publicHrefs(stats.hrefs),
    });
    return;
  }
  const saved = await persist(
    supabase,
    {
      title: built.title,
      content,
      sourceUrl: canonicalPostUrl(SOURCE_URL),
    },
    libs,
    again.preferredId
  );
  const action = saved.localPages + saved.prodPages > 0 ? "insert" : "skip";
  emit({
    action,
    title: built.title,
    pageId: saved.pageId,
    sourceUrl: SOURCE_URL,
    images: stats.images,
    attachments: stats.attachments,
    tables: stats.tables,
    codes: stats.codes,
  });
}

const isDirect =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
