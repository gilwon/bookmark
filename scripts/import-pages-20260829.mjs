// 사용자 링크 5건을 Pages에만 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
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
];

export const TARGETS = [
  {
    key: "qjc",
    title: "챗GPT 예약 작업 무료 개방, 오늘 3개까지 걸 수 있습니다",
    sourceUrl: "https://qjc.app/blog/chatgpt-scheduled-tasks-free",
    skip: true,
  },
  {
    key: "notepolio",
    title: "노트폴리오 | 길쭉해서 릴스나 쇼츠에 찰떡! 컨덴스드 폰트 7",
    sourceUrl:
      "https://app.notion.com/p/stunningkr/7-3c9380e0d41580cf841ce748f1a55e9e",
    pageId: "3c9380e0-d415-80cf-841c-e748f1a55e9e",
    hex: "3c9380e0d41580cf841ce748f1a55e9e",
    root: 27,
    images: 1,
    attachments: 0,
    phrases: ["K110 일방통행체", "sandollcloud.com"],
    skip: false,
  },
  {
    key: "orinaga",
    title: "🟨 홈피드 체류형 블로그 콘텐츠 생성 프롬프트 (최종 완성본)",
    sourceUrl: "https://app.notion.com/p/3cab2befb25b80c6b581ee729fe43b03",
    pageId: "3cab2bef-b25b-80c6-b581-ee729fe43b03",
    hex: "3cab2befb25b80c6b581ee729fe43b03",
    root: 85,
    images: 2,
    attachments: 0,
    phrases: [
      "11월 네이버 수익화 무료 특강",
      "홈피드 체류형",
      "vo.la/ZU8G9Z",
    ],
    skip: false,
  },
  {
    key: "computer-history",
    title: "클릭까지 다 남는다길래, 공식 문서 읽어봤어요",
    sourceUrl: "https://app.notion.com/p/3bf73c7b15ad8146b8eaee0de5b0cbf0",
    pageId: "3bf73c7b-15ad-8146-b8ea-ee0de5b0cbf0",
    hex: "3bf73c7b15ad8146b8eaee0de5b0cbf0",
    root: 72,
    images: 0,
    attachments: 0,
    todos: 12,
    phrases: ["Computer History", "Pause·Resume"],
    skip: false,
  },
  {
    key: "chatgpt-sticker",
    title: "ChatGPT로 스티커 만들기: 생성 가이드 & 개선 프롬프트",
    sourceUrl:
      "https://app.notion.com/p/ChatGPT-3c969bdb9038811382e5d5edbf5d2cda",
    pageId: "3c969bdb-9038-8113-82e5-d5edbf5d2cda",
    hex: "3c969bdb9038811382e5d5edbf5d2cda",
    root: 81,
    images: 5,
    attachments: 0,
    codes: 9,
    tables: 1,
    phrases: ["STEP 1. 스티커 생성 시작하기", "인물 캐릭터 스티커"],
    skip: false,
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

/** 만료 서명 URL 조각이 본문에 없으면 true다. */
export function hasNoExpiredUrl(text) {
  const value = String(text ?? "");
  return EXPIRED_URL_PARTS.every((part) => !value.includes(part));
}

/** 제목 또는 원문 식별자가 있으면 중복이다. */
export function isDuplicateRow(row, title, markers) {
  if (!row) return false;
  if (row.title === title) return true;
  const content = String(row.content ?? "");
  return markers.some((marker) => marker && content.includes(marker));
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

function loadMarkdownToTiptap() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(
    resolve(root, "src/lib/markdown-to-tiptap.ts")
  );
  return markdownToTiptapDoc;
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

function assertIntegrity(spec, { page, blocks, pageTitle, markdown, stats, content }) {
  if (pageTitle !== spec.title) {
    throw new Error(`페이지 제목이 다릅니다. ${pageTitle}`);
  }
  if (!markdown.startsWith(`# ${spec.title}`)) {
    throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
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
  if (spec.todos != null && countType(blocks, "to_do") !== spec.todos) {
    throw new Error(`할 일 수가 다릅니다. ${countType(blocks, "to_do")}`);
  }
  if (spec.codes != null && countType(blocks, "code") !== spec.codes) {
    throw new Error(`코드 블록 수가 다릅니다. ${countType(blocks, "code")}`);
  }
  if (stats.images !== spec.images) {
    throw new Error(`TipTap 이미지 수가 다릅니다. ${stats.images}`);
  }
  if (stats.attachments !== spec.attachments) {
    throw new Error(`TipTap 첨부 수가 다릅니다. ${stats.attachments}`);
  }
  if (spec.tables != null && stats.tables !== spec.tables) {
    throw new Error(`표 수가 다릅니다. ${stats.tables}`);
  }
  if (spec.codes != null && stats.codes !== spec.codes) {
    throw new Error(`TipTap 코드 수가 다릅니다. ${stats.codes}`);
  }
  const sourceUrl = stripTracking(spec.sourceUrl);
  if (!markdown.includes(sourceUrl)) throw new Error("원문 주소가 없습니다.");
  for (const phrase of spec.phrases ?? []) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(content)) {
    throw new Error("만료 URL이 본문에 남아 있습니다.");
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
}

function markersOf(spec, sourceUrl) {
  return [sourceUrl, spec.pageId, spec.hex].filter(Boolean);
}

function findLocalPage(db, title, markers) {
  const byTitle = db
    .prepare(
      "SELECT id, title, content FROM custom_pages WHERE user_id = ? AND title = ?"
    )
    .get(LOCAL_USER, title);
  if (isDuplicateRow(byTitle, title, markers)) return byTitle;
  for (const marker of markers) {
    if (!marker) continue;
    const row = db
      .prepare(
        `SELECT id, title, content FROM custom_pages
         WHERE user_id = ? AND content LIKE ?
         LIMIT 1`
      )
      .get(LOCAL_USER, `%${marker}%`);
    if (isDuplicateRow(row, title, markers)) return row;
  }
  return null;
}

function importLocal(page, markers) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pages: 0, pageUpdates: 0, pageSkips: 0, pageId: page.id };
  const existing = findLocalPage(db, page.title, markers);
  if (existing) {
    result.pageSkips += 1;
    result.pageId = existing.id;
    db.close();
    return result;
  }
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
  result.pages += 1;
  db.close();
  return result;
}

async function findProductionPage(supabase, title) {
  // 운영 content ilike는 큰 JSON에서 statement timeout이 난다.
  const { data, error } = await supabase
    .from("custom_pages")
    .select("id, title")
    .eq("user_id", PROD_USER)
    .eq("title", title)
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

async function importProduction(page) {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const result = { pages: 0, pageUpdates: 0, pageSkips: 0, pageId: page.id };
  const existing = await findProductionPage(supabase, page.title);
  if (existing) {
    result.pageSkips += 1;
    result.pageId = existing.id;
    return result;
  }
  const { error: insertError } = await supabase.from("custom_pages").insert({
    id: page.id,
    user_id: PROD_USER,
    title: page.title,
    content: page.content,
    created_at: page.created_at,
    updated_at: page.updated_at,
  });
  if (insertError) throw insertError;
  result.pages += 1;
  return result;
}

async function persist(title, content, markers, extra) {
  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    title,
    content,
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record, markers);
  record.id = local.pageId;
  const production = await importProduction(record);
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

function skipTarget(target, checkOnly) {
  const extra = {
    key: target.key,
    pageTitle: target.title,
    skipped: true,
    images: 0,
    attachments: 0,
  };
  if (checkOnly) return extra;
  return {
    ...extra,
    local: { pages: 0, pageSkips: 1 },
    production: { pages: 0, pageSkips: 1 },
  };
}

async function importTarget(spec, markdownToTiptapDoc, checkOnly) {
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
  assertIntegrity(spec, {
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
    todos: countType(blocks, "to_do"),
    root: (page.content || []).length,
  };
  if (checkOnly) return extra;
  return persist(pageTitle, content, markersOf(spec, sourceUrl), extra);
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const markdownToTiptapDoc = loadMarkdownToTiptap();
  const results = [];
  for (const target of TARGETS) {
    if (target.skip) {
      results.push(skipTarget(target, checkOnly));
      continue;
    }
    results.push(await importTarget(target, markdownToTiptapDoc, checkOnly));
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
