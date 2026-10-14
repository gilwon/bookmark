// every._ai 얼굴 없는 계정 프롬프트 8가지를 Pages에만 저장한다.
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import Database from "better-sqlite3";
import {
  assertDownloadableAttachment,
  documentStats,
  imageMime,
} from "./import-claude-eli5-page.mjs";
import {
  attachmentKind,
  canonicalPostUrl,
  decideSkip,
  imageDataUrl,
  isDuplicateRow,
  parseEveryAiHtml,
  sourceMarkers,
  stripTracking,
} from "./import-every-ai-index-20261013.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const SITE_ORIGIN = "https://every-ai-guides.vercel.app";
const SITE_NAME = "every._ai";
const TRACKING_KEY = ["fb", "clid"].join("");

export const SOURCE_URL =
  "https://every-ai-guides.vercel.app/posts/claude-faceless-account-prompts-8";
export const PAGE_TITLE = "클로드로 얼굴 없는 계정 키우는 프롬프트 8가지";
export const CREATORS_URL = "https://creators.instagram.com/";
export const HELP_URL = "https://help.instagram.com/";
export const PROMPT_ENGINEERING_URL =
  "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview";
export const EXPECTED_IMAGES = 0;
export const EXPECTED_ATTACHMENTS = 0;
export const EXPECTED_TABLES = 3;
export const EXPECTED_CODES = 8;

const REQUIRED_HREFS = [
  SOURCE_URL,
  CREATORS_URL,
  HELP_URL,
  PROMPT_ENGINEERING_URL,
];
const REQUIRED_HEADINGS = [
  "Quick Start",
  "STEP 1 · 5분 팔릴 주제 하나를 고른다",
  "STEP 2 · 5분 이름·프로필·소개를 한 번에 정한다",
  "STEP 3 · 10분 30일 게시물 달력을 만든다",
  "STEP 4 · 5분 첫 줄에서 멈추게 한다",
  "STEP 5 · 10분 얼굴 없이 찍는 릴스 대본을 쓴다",
  "STEP 6 · 10분 저장되는 캐러셀을 만든다",
  "STEP 7 · 5분 댓글·DM 답장 틀을 만든다",
  "STEP 8 · 10분 잘된 게시물을 다시 쓴다",
  "30일 게시물 달력 틀",
  "후킹 첫 줄 공식 5가지",
  "주간 성과 점검표",
  "자주 막히는 곳",
  "FAQ",
  "공식 참고 자료",
];
const FORBIDDEN_SNIPPETS = [
  "AI 수익화 챌린지",
  "youtube.com",
  "instagram.com/every",
  "claude-icon.png",
  "from=dm",
  "from=guide",
  "utm_source",
  TRACKING_KEY,
];
const EXPIRED_URL_PARTS = [
  "prod-files-secure",
  "file.notion.so",
  "expirationTimestamp",
  "X-Amz",
  "blob:",
];
const CHROME_SELECTOR = [
  "a.bootcamp-post-banner",
  ".challenge-post-banner",
  "a.challenge-post-banner",
  "a.kakao-post-cta",
  "section.challenge-banner",
  "nav",
  "footer",
  "button",
  "script",
  "style",
  "noscript",
  "img[src*='claude-icon']",
  "a[href*='youtube.com']",
  "a[href*='instagram.com/every']",
].join(", ");

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

// 네트워크 없이 저장용 제목과 마크다운을 만든다.
export function pageFromHtml(html) {
  return parseEveryAiHtml(html, SOURCE_URL);
}

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

function linkBaseOf(url) {
  return `${canonicalPostUrl(url)}/`;
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

function isContentImageSrc(src) {
  if (!src) return false;
  if (src.includes("claude-icon") || src.includes("favicon")) return false;
  return true;
}

function bytesFromImageDataUrl(dataUrl) {
  const match =
    /^data:image\/(?:png|jpeg|gif|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      String(dataUrl)
    );
  if (!match) throw new Error("이미지 data URL이 아닙니다.");
  return Buffer.from(match[1], "base64");
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

async function fetchWithRetry(url, referer) {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0",
        referer: referer || `${SITE_ORIGIN}/`,
      },
    });
    if (response.ok) return response;
    lastStatus = response.status;
    if (response.status !== 429 && response.status !== 503) break;
    await pause(1000 * (attempt + 1));
  }
  throw new Error(`HTTP ${lastStatus}. ${new URL(url).pathname}`);
}

// 본문 이미지가 아니면 제거한다. 이미 data URL이면 다시 받지 않는다.
async function inlineBodyImages($, content, sourceUrl) {
  for (const image of [...content.find("img").toArray()]) {
    let imageUrl = imageSrcOf(image, $);
    if (!isContentImageSrc(imageUrl)) {
      $(image).remove();
      continue;
    }
    if (imageUrl.startsWith("data:image/")) {
      imageMime(bytesFromImageDataUrl(imageUrl));
      $(image).removeAttr("srcset");
      continue;
    }
    imageUrl = toAbsoluteUrl(imageUrl, linkBaseOf(sourceUrl));
    const response = await fetchWithRetry(imageUrl, sourceUrl);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const dataUrl = imageDataUrl(bytes, response.headers.get("content-type"));
    $(image).attr("src", dataUrl);
    $(image).removeAttr("srcset");
  }
}

// 같은 호스트 PDF만 data URL로 넣는다. ZIP은 https 링크로 남긴다.
async function inlineAttachments($, content, sourceUrl) {
  const base = linkBaseOf(sourceUrl);
  for (const link of [...content.find("a[href]").toArray()]) {
    const href = $(link).attr("href") || "";
    if (
      !href ||
      href.startsWith("data:") ||
      href.startsWith("mailto:") ||
      href.startsWith("#")
    ) {
      continue;
    }
    const abs = toAbsoluteUrl(href, base);
    $(link).attr("href", abs);
    if (attachmentKind(abs) !== "pdf") continue;
    const filename = filenameFromUrl(abs) || "첨부.pdf";
    const response = await fetchWithRetry(abs, sourceUrl);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const markdown = assertDownloadableAttachment(
      filename,
      bytes,
      response.headers.get("content-type")
    );
    const match = /^\[[^\]]*\]\((data:[^)]+)\)$/.exec(markdown);
    if (!match || !match[1].startsWith("data:application/pdf")) {
      throw new Error("PDF data URL이 아닙니다.");
    }
    $(link).attr("href", match[1]);
    if (!$(link).text().trim()) $(link).text(filename);
  }
}

async function downloadedPage(html) {
  const $ = cheerio.load(html);
  const article = $("article.post").first();
  if (!article.length) {
    throw new Error("본문 영역 article.post 를 찾지 못했습니다.");
  }
  article.find(CHROME_SELECTOR).remove();
  await inlineBodyImages($, article, SOURCE_URL);
  await inlineAttachments($, article, SOURCE_URL);
  return pageFromHtml($.html());
}

function publicHrefs(hrefs) {
  return [
    ...new Set(
      (hrefs ?? []).filter((href) => !String(href).startsWith("data:"))
    ),
  ].sort();
}

// 라이브 변환 결과가 기대와 다르면 저장하지 않는다.
function assertLive({ title, markdown, stats, content }) {
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
  if (
    !markdown.includes("읽는 데 9분") ||
    !markdown.includes("2026-10-13 공개")
  ) {
    throw new Error("메타 줄이 없습니다.");
  }
  const actual = publicHrefs(stats.hrefs);
  const expected = [...REQUIRED_HREFS].sort();
  if (
    actual.length !== expected.length ||
    actual.some((href, index) => href !== expected[index])
  ) {
    throw new Error(`링크가 다릅니다. ${actual.join(" ")}`);
  }
  if (
    markdown.includes("data:application/zip") ||
    String(content).includes("data:application/zip")
  ) {
    throw new Error("ZIP data URL이 있습니다.");
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
    await fetchWithRetry(SOURCE_URL, `${SITE_ORIGIN}/`)
  ).text();
  const built = await downloadedPage(html);
  const content = JSON.stringify(libs.markdownToTiptapDoc(built.markdown));
  const stats = documentStats(content);
  assertLive({
    title: built.title,
    markdown: built.markdown,
    stats,
    content,
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
