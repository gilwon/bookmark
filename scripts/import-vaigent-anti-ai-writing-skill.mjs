// 바이비 AI티 빼는 클로드 스킬 3종을 Pages에만 저장한다
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import Database from "better-sqlite3";
import TurndownService from "turndown";
import { documentStats } from "./import-claude-eli5-page.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const SITE_NAME = "바이비";

export const SOURCE_URL = "https://www.withvaigent.com/blog/anti-ai-writing-skill";
export const PAGE_TITLE = "글쓸 때 AI티 빼는 클로드 스킬 3종 세트";
export const ATTACHMENT_SOURCE_ID = "withvaigent-anti-ai-writing";
export const EXPECTED_IMAGES = 0;
export const EXPECTED_ATTACHMENTS = 3;
export const EXPECTED_TABLES = 1;
export const EXPECTED_TABLE_ROWS = 4;

export const ZIP_FILES = [
  {
    filename: "humanize-korean.zip",
    bytes: 18068,
    sha256: "3144992b8c220629df7f46db56d4273df633c6c674a509a139f524fa3e053f36",
    url: "https://www.withvaigent.com/images/3e6f2254-ee13-802e-9444-e7fd6a7f0458/3e6f2254-ee13-80b6-8e67-d44bdbc69a1a-3144992b8c22/humanize-korean.zip",
  },
  {
    filename: "anti-ai-writing.zip",
    bytes: 6599,
    sha256: "f12cec2833a336c354ee08f3ff4c5f35bcaf64d5a4f41c28edce5cd9b88a0290",
    url: "https://www.withvaigent.com/images/3e6f2254-ee13-802e-9444-e7fd6a7f0458/3e6f2254-ee13-8093-9260-c2344cec3044-f12cec2833a3/anti-ai-writing.zip",
  },
  {
    filename: "voice-dna-maker.zip",
    bytes: 3313,
    sha256: "33a6e969b3a62732d8acbc874dd7f8c658d9db4d89ee170f4f0649a3468fd3cf",
    url: "https://www.withvaigent.com/images/3e6f2254-ee13-802e-9444-e7fd6a7f0458/3e6f2254-ee13-8058-b607-d22f0af3b8a4-33a6e969b3a6/voice-dna-maker.zip",
  },
];

const EXTERNAL_LINKS = [
  "https://human-ai-writing.vercel.app/",
  "https://github.com/epoko77-ai/im-not-ai",
  "https://github.com/artemnovitckii/content-skills",
  "https://open.kakao.com/o/gie1t2Hi",
];

const FORBIDDEN_SNIPPETS = [
  "fbclid",
  "utm_source",
  "source=copy_link",
  "관련 글",
  "/blog/ui-ux-pro-max-skill",
  "ai-티-안나게",
  "natural-camera-angle-prompts",
  "/images/3e6f2254-ee13-802e-9444-e7fd6a7f0458/",
  "data:application/zip",
  "http://",
];

const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^(['"])|(['"])$/g, "");
  }
}

function isTrackingParam(key, value) {
  return (
    key.startsWith("utm_") ||
    key === "fbclid" ||
    (key === "source" && value === "copy_link")
  );
}

/** 첨부 API 경로를 그대로 둔다. 사이트 절대 주소로 바꾸지 않는다. */
export function attachmentHref(filename) {
  return `/api/page-attachments/${ATTACHMENT_SOURCE_ID}/${encodeURIComponent(filename)}`;
}

/** http는 https로 올리고 utm, fbclid, source=copy_link는 뺀다. */
export function stripTracking(url, base) {
  const value = String(url ?? "");
  if (
    !value ||
    value.startsWith("data:") ||
    value.startsWith("mailto:") ||
    value.startsWith("#") ||
    value.startsWith("/api/page-attachments/")
  ) {
    return value;
  }
  try {
    const parsed = new URL(value, base);
    if (parsed.protocol === "http:") parsed.protocol = "https:";
    for (const key of [...parsed.searchParams.keys()]) {
      if (isTrackingParam(key, parsed.searchParams.get(key))) parsed.searchParams.delete(key);
    }
    if ([...parsed.searchParams.keys()].length === 0) parsed.search = "";
    return parsed.href;
  } catch {
    return value
      .replace(/^http:\/\//i, "https://")
      .replace(/[?&](?:utm_[^=&#]*|fbclid)=[^&\s)#]*/g, "")
      .replace(/[?&]source=copy_link/g, "")
      .replace(/[?&]$/, "")
      .replace(/\?&/, "?");
  }
}

function storedSourceUrl(url = SOURCE_URL) {
  return stripTracking(url || SOURCE_URL).replace(/\/+$/, "") || SOURCE_URL;
}

function linkBaseOf(url = SOURCE_URL) {
  return `${storedSourceUrl(url)}/`;
}

/** 제목 또는 source_url이 같으면 중복이다. 본문 언급만으로는 중복이 아니다. */
export function isDuplicateRow(row, title, sourceUrl) {
  if (!row) return false;
  if (row.title === title) return true;
  return Boolean(sourceUrl) && row.source_url === sourceUrl;
}

/** PK 시그니처, 바이트, sha256이 모두 같아야 한다. 하나라도 다르면 throw. */
export function verifyVaigentAntiAiZip(filename, bytes) {
  const expected = ZIP_FILES.find((file) => file.filename === filename);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const signature =
    bytes?.[0] === 0x50 &&
    bytes?.[1] === 0x4b &&
    (bytes?.[2] === 0x03 || bytes?.[2] === 0x05 || bytes?.[2] === 0x07);
  if (
    !expected ||
    !signature ||
    bytes.byteLength !== expected.bytes ||
    hash !== expected.sha256
  ) {
    throw new Error("바이비 스킬 ZIP 무결성 검증에 실패했습니다.");
  }
  return { filename, bytes: bytes.byteLength, sha256: hash };
}

function loadLibs() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(resolve(root, "src/lib/markdown-to-tiptap.ts"));
  const { preparePageFindability, isMissingPageFindabilityColumn } = require(
    resolve(root, "src/lib/page-findability.ts")
  );
  const storage = require(resolve(root, "src/lib/page-attachment-storage.ts"));
  return {
    markdownToTiptapDoc,
    preparePageFindability,
    isMissingPageFindabilityColumn,
    ...storage,
  };
}

export function toPageDocument(markdown) {
  return JSON.stringify(loadLibs().markdownToTiptapDoc(markdown));
}

function cleanTitle(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*[·|]\s*바이비\s*$/u, "")
    .trim();
}

function pageTitleOf($) {
  const h1 = $("article.post h1").first();
  const raw = h1.length ? h1.text() : $("title").first().text();
  return cleanTitle(raw) || PAGE_TITLE;
}

function selectBody($) {
  const body = $("article.post div.post__body").first();
  if (!body.length) {
    throw new Error("본문 영역 article.post 의 div.post__body 를 찾지 못했습니다.");
  }
  const root = body.clone();
  root.find("ul.tag-list, section.related, header, footer, nav.sidebar, ul.post-list").remove();
  root.find("script, style, noscript").remove();
  root.find("h1").remove();
  return root;
}

function rewriteZipLinks($, root) {
  root.find("a[href]").each((_, link) => {
    const href = $(link).attr("href") || "";
    const path = href.split("?")[0];
    const file = ZIP_FILES.find((item) => path.endsWith(`/${item.filename}`));
    if (!file) return;
    $(link).attr("href", attachmentHref(file.filename));
    $(link).removeAttr("download");
    $(link).text(file.filename);
  });
}

function rewriteLinks($, root, sourceUrl) {
  root.find("a[href]").each((_, link) => {
    const href = $(link).attr("href") || "";
    if (
      !href ||
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("data:") ||
      href.startsWith("/api/page-attachments/")
    ) {
      return;
    }
    $(link).attr("href", stripTracking(href, sourceUrl));
  });
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

function cleanWebMarkdown(markdown, base) {
  return String(markdown ?? "")
    .replace(/\\([\[\]\.])/g, "$1")
    .replace(/\]\((\/[^)]+)\)/g, (_, path) => `](${stripTracking(path, base)})`)
    .replace(/https?:\/\/[^\s)]+/g, (url) => stripTracking(url, base))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function assertClean(text) {
  for (const snippet of FORBIDDEN_SNIPPETS) {
    if (String(text).includes(snippet)) {
      throw new Error(`제거 대상이 본문에 남아 있습니다. ${snippet}`);
    }
  }
}

function tableRowCount(content) {
  let rows = 0;
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "tableRow") rows += 1;
    for (const child of node.content ?? []) visit(child);
  }
  visit(JSON.parse(content));
  return rows;
}

/** HTML 픽스처나 원문에서 저장용 마크다운을 만든다. 네트워크를 쓰지 않는다. */
export function parseVaigentAntiAiHtml(html, sourceUrl = SOURCE_URL) {
  const storedUrl = storedSourceUrl(sourceUrl);
  const base = linkBaseOf(storedUrl);
  const $ = cheerio.load(html);
  const title = pageTitleOf($);
  if (title !== PAGE_TITLE) throw new Error("페이지 제목이 다릅니다.");
  const root = selectBody($);
  if (root.find("img").length !== 0) throw new Error("본문 이미지가 있으면 안 됩니다.");
  rewriteZipLinks($, root);
  rewriteLinks($, root, base);
  for (const file of ZIP_FILES) {
    const href = attachmentHref(file.filename);
    const links = root.find("a[href]").filter((_, el) => $(el).attr("href") === href);
    if (links.length !== 1 || links.text().replace(/\s+/g, " ").trim() !== file.filename) {
      throw new Error(`첨부 링크가 파일명과 다릅니다. ${file.filename}`);
    }
  }
  const articleMarkdown = createTurndown().turndown(root.html() || "").trim();
  const markdown = [`# ${title}`, `> 원문. [${SITE_NAME}](${storedUrl})`, cleanWebMarkdown(articleMarkdown, base)]
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!markdown.startsWith(`# ${PAGE_TITLE}`)) throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
  if (!markdown.includes(`> 원문. [${SITE_NAME}](${SOURCE_URL})`)) throw new Error("원문 인용이 없습니다.");
  for (const href of EXTERNAL_LINKS) {
    if (!markdown.includes(href)) throw new Error(`외부 링크가 없습니다. ${href}`);
  }
  for (const file of ZIP_FILES) {
    const href = attachmentHref(file.filename);
    if (!markdown.includes(`[${file.filename}](${href})`)) {
      throw new Error(`첨부 마크다운이 없습니다. ${file.filename}`);
    }
  }
  if (!markdown.includes("#파일-받기")) throw new Error("문서 안 파일 받기 링크가 없습니다.");
  assertClean(markdown);
  return { title, markdown };
}

function assertIntegrity({ title, markdown, stats, content }) {
  if (title !== PAGE_TITLE) throw new Error("페이지 제목이 다릅니다.");
  if (stats.images !== EXPECTED_IMAGES) throw new Error(`TipTap 이미지 수가 다릅니다. ${stats.images}`);
  if (stats.attachments !== EXPECTED_ATTACHMENTS) {
    throw new Error(`TipTap 첨부 수가 다릅니다. ${stats.attachments}`);
  }
  if (stats.tables !== EXPECTED_TABLES) throw new Error(`TipTap 표 수가 다릅니다. ${stats.tables}`);
  if (tableRowCount(content) !== EXPECTED_TABLE_ROWS) throw new Error("스킬 표 행 수가 다릅니다.");
  for (const href of [...EXTERNAL_LINKS, ...ZIP_FILES.map((file) => attachmentHref(file.filename))]) {
    if (!stats.hrefs.includes(href)) throw new Error(`저장 링크가 없습니다. ${href}`);
  }
  assertClean(markdown);
  assertClean(content);
  if (content.includes("data:application/zip") || markdown.includes("data:application/zip")) {
    throw new Error("ZIP을 data URL로 넣었습니다.");
  }
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`원문 HTTP ${response.status}`);
  return response.text();
}

async function downloadZip(file) {
  let last = new Error("첨부 다운로드에 실패했습니다.");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(file.url, {
        headers: { "user-agent": "Mozilla/5.0", referer: SOURCE_URL },
      });
      if (response.ok) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        return { filename: file.filename, bytes, integrity: verifyVaigentAntiAiZip(file.filename, bytes) };
      }
      last = new Error(`첨부 HTTP ${response.status}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch {
      last = new Error("첨부 다운로드에 실패했습니다.");
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 400 * (attempt + 1)));
  }
  throw last;
}

function pageColumns(db) {
  return db.prepare("PRAGMA table_info(custom_pages)").all().map((column) => column.name);
}

function sqliteHasFindability(db) {
  const cols = pageColumns(db);
  return ["tags", "source_url", "search_text", "is_favorite"].every((name) => cols.includes(name));
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
  if (cols.includes("source_url") && sourceUrl) {
    const bySource = db
      .prepare(`SELECT ${select} FROM custom_pages WHERE user_id = ? AND source_url = ? LIMIT 1`)
      .get(LOCAL_USER, sourceUrl);
    if (isDuplicateRow(bySource, title, sourceUrl)) return bySource;
  }
  return null;
}

function findabilityOf(libs, content) {
  const found = libs.preparePageFindability({
    title: PAGE_TITLE,
    content,
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
  const result = { action: "insert", pageId: page.id };
  const existing = findLocalPage(db, page.title, SOURCE_URL);
  if (existing) {
    db.close();
    return { action: "skip", pageId: existing.id };
  }
  const found = findabilityOf(libs, page.content);
  const now = page.created_at;
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
      now,
      now
    );
  } else {
    db.prepare(
      `INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(page.id, LOCAL_USER, page.title, page.content, now, now);
  }
  db.close();
  return result;
}

async function findProductionPage(supabase) {
  const byTitle = await supabase
    .from("custom_pages")
    .select("id, title, source_url")
    .eq("user_id", PROD_USER)
    .eq("title", PAGE_TITLE)
    .limit(1);
  if (byTitle.error) throw byTitle.error;
  if (isDuplicateRow(byTitle.data?.[0], PAGE_TITLE, SOURCE_URL)) return byTitle.data[0];
  const bySource = await supabase
    .from("custom_pages")
    .select("id, title, source_url")
    .eq("user_id", PROD_USER)
    .eq("source_url", SOURCE_URL)
    .limit(1);
  if (bySource.error) {
    if (/source_url/i.test(bySource.error.message)) return null;
    throw bySource.error;
  }
  if (isDuplicateRow(bySource.data?.[0], PAGE_TITLE, SOURCE_URL)) return bySource.data[0];
  return null;
}

async function importProduction(page, libs) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const existing = await findProductionPage(supabase);
  if (existing) return { action: "skip", pageId: existing.id, supabase };
  const found = findabilityOf(libs, page.content);
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
  return { action: "insert", pageId: page.id, supabase };
}

function objectPaths(libs) {
  const paths = [];
  for (const file of ZIP_FILES) {
    for (const userId of [LOCAL_USER, PROD_USER]) {
      const path = libs.createPageAttachmentObjectPath(userId, ATTACHMENT_SOURCE_ID, file.filename);
      if (!path) throw new Error("첨부 Storage 경로 검증에 실패했습니다.");
      paths.push({ filename: file.filename, path });
    }
  }
  return paths;
}

function bucketOptions(libs) {
  return {
    public: false,
    fileSizeLimit: libs.PAGE_ATTACHMENT_STORAGE_FILE_SIZE_LIMIT,
    allowedMimeTypes: [libs.PAGE_ATTACHMENT_STORAGE_MIME],
  };
}

async function ensureBucket(supabase, libs) {
  const bucket = libs.PAGE_ATTACHMENT_STORAGE_BUCKET;
  const { data, error } = await supabase.storage.getBucket(bucket);
  if (data && !error) return "unchanged";
  const status = error?.status ?? error?.statusCode;
  const missing = String(status) === "404" || /not found/i.test(String(error?.message ?? ""));
  if (!missing) throw error ?? new Error("첨부 버킷을 확인하지 못했습니다.");
  const { error: createError } = await supabase.storage.createBucket(bucket, bucketOptions(libs));
  if (createError) throw createError;
  return "created";
}

async function uploadZips(supabase, libs, files) {
  const bucket = libs.PAGE_ATTACHMENT_STORAGE_BUCKET;
  let count = 0;
  for (const file of files) {
    for (const userId of [LOCAL_USER, PROD_USER]) {
      const path = libs.createPageAttachmentObjectPath(userId, ATTACHMENT_SOURCE_ID, file.filename);
      if (!path) throw new Error("첨부 Storage 경로 검증에 실패했습니다.");
      const { error } = await supabase.storage.from(bucket).upload(path, Buffer.from(file.bytes), {
        contentType: libs.PAGE_ATTACHMENT_STORAGE_MIME,
        upsert: true,
      });
      if (error) throw error;
      count += 1;
    }
  }
  return count;
}

async function verifyStoredObjects(supabase, libs, files) {
  const bucket = libs.PAGE_ATTACHMENT_STORAGE_BUCKET;
  const matched = [];
  for (const file of files) {
    for (const userId of [LOCAL_USER, PROD_USER]) {
      const path = libs.createPageAttachmentObjectPath(userId, ATTACHMENT_SOURCE_ID, file.filename);
      const info = await supabase.storage.from(bucket).info(path);
      const size = Number(info.data?.metadata?.size ?? info.data?.size);
      if (!info.error && size === file.integrity.bytes) {
        matched.push({ filename: file.filename, bytes: size });
        continue;
      }
      const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60);
      if (signed.error || typeof signed.data?.signedUrl !== "string") {
        throw new Error("저장 ZIP 후검증에 실패했습니다.");
      }
      let bytes;
      try {
        const response = await fetch(signed.data.signedUrl);
        if (!response.ok) throw new Error("status");
        bytes = new Uint8Array(await response.arrayBuffer());
      } catch {
        throw new Error("저장 ZIP 후검증에 실패했습니다.");
      }
      const integrity = verifyVaigentAntiAiZip(file.filename, bytes);
      matched.push({ filename: file.filename, bytes: integrity.bytes });
    }
  }
  return matched;
}

function requireEnv() {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
}

function assertAllowlist(libs) {
  if (libs.PAGE_ATTACHMENT_VAIGENT_ANTI_AI_SOURCE_ID !== ATTACHMENT_SOURCE_ID) {
    throw new Error("첨부 sourceId가 허용 목록과 다릅니다.");
  }
  for (const file of ZIP_FILES) {
    if (!libs.PAGE_ATTACHMENT_VAIGENT_ANTI_AI_FILENAMES.includes(file.filename)) {
      throw new Error("첨부 파일명이 허용 목록과 다릅니다.");
    }
    if (libs.PAGE_ATTACHMENT_STORAGE_MIME !== "application/zip") {
      throw new Error("첨부 MIME이 application/zip이 아닙니다.");
    }
  }
}

async function main() {
  requireEnv();
  const checkOnly = process.argv.includes("--check");
  const libs = loadLibs();
  assertAllowlist(libs);
  const [html, ...files] = await Promise.all([fetchText(SOURCE_URL), ...ZIP_FILES.map((file) => downloadZip(file))]);
  const parsed = parseVaigentAntiAiHtml(html, SOURCE_URL);
  const content = JSON.stringify(libs.markdownToTiptapDoc(parsed.markdown));
  const stats = documentStats(content);
  assertIntegrity({ title: parsed.title, markdown: parsed.markdown, stats, content });
  const summary = {
    title: parsed.title,
    images: stats.images,
    attachments: stats.attachments,
    tables: stats.tables,
    tableRows: tableRowCount(content),
    zips: files.map((file) => file.integrity),
    objectPaths: objectPaths(libs).map((item) => item.path),
  };
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  if (checkOnly) {
    const localDb = new Database(resolve(root, "data/mymark.db"), { readonly: true });
    const localExisting = findLocalPage(localDb, PAGE_TITLE, SOURCE_URL);
    localDb.close();
    const productionExisting = await findProductionPage(supabase);
    console.log(
      JSON.stringify(
        {
          ...summary,
          writes: 0,
          preflight: {
            local: localExisting ? "skip" : "insert",
            production: productionExisting ? "skip" : "insert",
          },
        },
        null,
        2
      )
    );
    return;
  }
  const now = new Date().toISOString();
  const page = { id: randomUUID(), title: parsed.title, content, created_at: now, updated_at: now };
  const bucket = await ensureBucket(supabase, libs);
  const uploads = await uploadZips(supabase, libs, files);
  const local = importLocal(page, libs);
  const production = await importProduction({ ...page, id: local.pageId }, libs);
  const verify = await verifyStoredObjects(supabase, libs, files);
  const pageId = local.pageId;
  console.log(
    JSON.stringify(
      {
        ...summary,
        bucket,
        uploads,
        verify: { count: verify.length, bytes: ZIP_FILES.map((file) => file.bytes) },
        local: { action: local.action, pageId: local.pageId },
        production: { action: production.action, pageId: production.pageId },
        pageId,
        path: `/pages/${pageId}`,
      },
      null,
      2
    )
  );
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
