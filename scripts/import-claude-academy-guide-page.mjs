// 클로드 공식 무료 강의 시작 가이드 Notion 원문을 Pages에만 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE_URL =
  "https://app.notion.com/p/3c3fd99f0e5f8170b159cf33eb5f6ee4?source=copy_link";
export const NOTION_PAGE_ID = "3c3fd99f-0e5f-8170-b159-cf33eb5f6ee4";
const NOTION_PAGE_HEX = NOTION_PAGE_ID.replaceAll("-", "");
const SPACE_ID = "b97fd99f-0e5f-81d6-b46e-0003ed3b57b7";
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const ENDPOINT = "https://www.notion.so/api/v3/loadPageChunk";
const SIGNED_FILE_ENDPOINT = "https://www.notion.so/api/v3/getSignedFileUrls";
export const EXPECTED_TITLE = "🎓 클로드 공식 무료 강의 시작 가이드";
const EXPECTED_ROOT_CHILDREN = 51;
const EXPECTED_TOGGLES = 9;
const EXPECTED_IMAGES = 5;
const COVER_URL = "https://academy.claude.com/og/site.png";
const NESTED_SKIP_TITLE = "프롬왓 | Prompt What";
const REQUIRED_HEADERS = [
  "나는 어디부터 들으면 되나",
  "여기가 어떤 곳인가",
  "들어가는 법",
  "내 길 고르기",
  "손에 남는 결과물",
  "자주 막히는 부분",
  "한 줄 정리",
];
const REQUIRED_HREFS = [
  SOURCE_URL,
  "https://academy.claude.com/",
  "https://claude.com/blog/anthropics-approach-to-teaching-and-learning-ai",
  "https://www.instagram.com/prompt_what/",
  "https://github.com/anthropics/skills/tree/main/skills/claude-academy-guide",
  "https://academy.claude.com/courses/claude-101",
];
const UNSAFE_URL_PARTS = [
  "file.notion.so",
  "expirationTimestamp",
  "X-Amz",
  "prod-files-secure",
];
const HEADING_PREFIX = {
  header: "##",
  header_1: "##",
  sub_header: "##",
  header_2: "##",
  sub_sub_header: "###",
  header_3: "###",
  header_4: "####",
};
const retryDelays = [15000, 30000, 60000];
let lastRequestAt = 0;

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
    )
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

const pause = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function getBlock(blocks, id) {
  if (!blocks || id == null) return null;
  if (typeof blocks.get === "function") return blocks.get(id) ?? null;
  return blocks[id] ?? null;
}

export function plainText(value) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((fragment) => {
      if (typeof fragment === "string") return fragment;
      if (!Array.isArray(fragment)) return "";
      return typeof fragment[0] === "string" ? fragment[0] : plainText(fragment);
    })
    .join("");
}

export function inlineMarkdown(value) {
  if (!Array.isArray(value)) return plainText(value);
  return value
    .map((fragment) => {
      if (typeof fragment === "string") return fragment;
      if (!Array.isArray(fragment)) return "";
      const text =
        typeof fragment[0] === "string" ? fragment[0] : plainText(fragment);
      const marks = Array.isArray(fragment[1]) ? fragment[1] : [];
      const link = marks.find(
        (mark) => Array.isArray(mark) && mark[0] === "a" && mark[1]
      );
      if (link) return `[${text}](${link[1]})`;
      let result = text;
      const has = (name) =>
        marks.some((mark) => Array.isArray(mark) && mark[0] === name);
      if (has("c")) result = `\`${result}\``;
      if (has("s")) result = `~~${result}~~`;
      if (has("i")) result = `*${result}*`;
      if (has("b")) result = `**${result}**`;
      return result;
    })
    .join("");
}

function titleOf(block) {
  return inlineMarkdown(block?.properties?.title).trim();
}

function sourceOf(block) {
  return (
    plainText(block?.properties?.source) ||
    block?.format?.display_source ||
    block?.format?.original_url ||
    ""
  );
}

function blockFromRecord(record) {
  const nested = record?.value?.value;
  if (nested && typeof nested === "object" && nested.type) return nested;
  const value = record?.value;
  if (value && typeof value === "object" && value.type) return value;
  return null;
}

function isListMarkdown(value) {
  const line = String(value).split("\n")[0] ?? "";
  return /^(-\s|\d+\.\s)/.test(line);
}

function joinRendered(parts) {
  const joined = [];
  for (const part of parts) {
    const previous = joined.at(-1);
    if (
      previous &&
      isListMarkdown(previous.split("\n").at(-1)) &&
      isListMarkdown(part)
    ) {
      joined[joined.length - 1] = `${previous}\n${part}`;
    } else {
      joined.push(part);
    }
  }
  return joined.join("\n\n");
}

export function tableMarkdown(block, blocks) {
  const columns = block.format?.table_block_column_order ?? [];
  const rows = (block.content ?? [])
    .map((id) => getBlock(blocks, id))
    .filter(Boolean)
    .map((row) =>
      columns.map((column) =>
        inlineMarkdown(row.properties?.[column])
          .replace(/\|/g, "\\|")
          .replace(/\n/g, " ")
      )
    );
  if (!rows.length) return "";
  return rows
    .map(
      (row, index) =>
        `| ${row.join(" | ")} |${index === 0 ? `\n| ${row.map(() => "---").join(" | ")} |` : ""}`
    )
    .join("\n");
}

function notionPageUrl(id) {
  return `https://www.notion.so/${String(id).replaceAll("-", "")}`;
}

export function renderBlock(block, blocks, media = new Map(), path = new Set()) {
  if (!block) return "";
  const id = block.id;
  if (id && path.has(id)) return "";
  const nextPath = id ? new Set(path).add(id) : new Set(path);
  const type = block.type;
  if (type === "page" && id && id !== NOTION_PAGE_ID) {
    const title = titleOf(block) || NESTED_SKIP_TITLE;
    return `[${title}](${notionPageUrl(id)})`;
  }
  const title = titleOf(block);
  const childMarkdown = joinRendered(
    (block.content ?? [])
      .map((childId) =>
        renderBlock(getBlock(blocks, childId), blocks, media, nextPath)
      )
      .filter(Boolean)
  );
  if (type === "image") {
    const src = media.get(id);
    if (!src) throw new Error(`이미지를 변환하지 못했습니다. ${id}`);
    return `![${title || "Notion 이미지"}](${src})`;
  }
  if (type === "table") return tableMarkdown(block, blocks);
  if (type === "table_row") return "";
  if (type === "divider") return "---";
  if (type === "callout") {
    return `:::callout\n${[title, childMarkdown].filter(Boolean).join("\n\n")}\n:::`;
  }
  if (type === "quote") {
    return `> ${title}${childMarkdown ? `\n${childMarkdown}` : ""}`.trim();
  }
  if (type === "toggle") {
    return [`**${title}**`, childMarkdown].filter(Boolean).join("\n\n");
  }
  if (type === "bulleted_list" || type === "bulleted_list_item") {
    return [`- ${title}`, childMarkdown].filter(Boolean).join("\n");
  }
  if (type === "numbered_list" || type === "numbered_list_item") {
    return [`1. ${title}`, childMarkdown].filter(Boolean).join("\n");
  }
  if (HEADING_PREFIX[type]) {
    return [`${HEADING_PREFIX[type]} ${title}`, childMarkdown]
      .filter(Boolean)
      .join("\n\n");
  }
  if (type === "column_list" || type === "column") return childMarkdown;
  if (type === "text") {
    if (!title) return childMarkdown;
    return [title, childMarkdown].filter(Boolean).join("\n\n");
  }
  return [title, childMarkdown].filter(Boolean).join("\n\n");
}

export function buildMarkdown(blocks, pageId, sourceUrl, media = new Map()) {
  const page = getBlock(blocks, pageId);
  const pageTitle = plainText(page?.properties?.title).trim();
  const cover = media.get(`${pageId}:cover`);
  const body = joinRendered(
    (page?.content ?? [])
      .map((id) =>
        renderBlock(getBlock(blocks, id), blocks, media, new Set([pageId]))
      )
      .filter(Boolean)
  );
  const markdown = [
    `# ${pageTitle}`,
    `> 원문. [Notion](${sourceUrl})`,
    cover ? `![Notion 커버](${cover})` : "",
    body,
  ]
    .filter(Boolean)
    .join("\n\n")
    .replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, "\n\n![$1]($2)\n\n");
  return { pageTitle, markdown };
}

export function documentStats(tiptapJsonString) {
  const stats = { images: 0, tables: 0, links: 0, hrefs: [] };
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "image") stats.images += 1;
    if (node.type === "table") stats.tables += 1;
    for (const mark of node.marks ?? []) {
      if (mark?.type === "link" && mark.attrs?.href) {
        stats.links += 1;
        stats.hrefs.push(mark.attrs.href);
      }
    }
    for (const child of node.content ?? []) visit(child);
  }
  visit(JSON.parse(tiptapJsonString));
  return stats;
}

function toggleCount(blocks) {
  let count = 0;
  for (const block of blocks.values()) {
    if (block.type === "toggle") count += 1;
  }
  return count;
}

function imageCount(blocks) {
  let count = 0;
  for (const block of blocks.values()) {
    if (block.type === "image") count += 1;
  }
  return count;
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
  return requestJson(ENDPOINT, {
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

function parentsWithMissingChildren(blocks, fetched) {
  const ids = [];
  for (const block of blocks.values()) {
    if (!block.id || fetched.has(block.id)) continue;
    if (block.type === "page" && block.id !== NOTION_PAGE_ID) continue;
    if ((block.content ?? []).some((childId) => !blocks.has(childId))) {
      ids.push(block.id);
    }
  }
  return ids;
}

async function collectBlocks() {
  const blocks = new Map();
  let cursor = { stack: [] };
  let chunkNumber = 0;
  do {
    const chunk = await requestChunk(NOTION_PAGE_ID, cursor, chunkNumber);
    absorbChunk(blocks, chunk);
    cursor = chunk.cursor ?? { stack: [] };
    chunkNumber += 1;
  } while (cursor.stack?.length);

  const fetched = new Set([NOTION_PAGE_ID]);
  let queue = parentsWithMissingChildren(blocks, fetched);
  while (queue.length) {
    const id = queue.shift();
    if (fetched.has(id)) continue;
    fetched.add(id);
    const chunk = await requestChunk(id);
    absorbChunk(blocks, chunk);
    queue = parentsWithMissingChildren(blocks, fetched);
  }
  return blocks;
}

function imageMime(bytes, header) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (header?.startsWith("image/")) return header.split(";")[0];
  throw new Error("이미지 MIME을 판별하지 못했습니다.");
}

async function dataUrlFromResponse(response) {
  if (!response.ok) throw new Error(`이미지 HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const dataUrl = `data:${imageMime(bytes, response.headers.get("content-type"))};base64,${Buffer.from(bytes).toString("base64")}`;
  if (UNSAFE_URL_PARTS.some((part) => dataUrl.includes(part))) {
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

async function resolveMedia(blocks, page) {
  const media = new Map();
  for (const block of blocks.values()) {
    if (block.type !== "image") continue;
    const url = sourceOf(block);
    if (!url) throw new Error(`이미지 URL이 없습니다. ${block.id}`);
    media.set(block.id, await dataUrlFromResponse(await fetchMedia(url, block)));
  }
  const cover = page.format?.page_cover || COVER_URL;
  media.set(
    `${NOTION_PAGE_ID}:cover`,
    await dataUrlFromResponse(await fetchMedia(cover, page))
  );
  return media;
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

function assertIntegrity({ page, blocks, pageTitle, markdown, stats }) {
  if (pageTitle !== EXPECTED_TITLE) {
    throw new Error(`페이지 제목이 다릅니다. ${pageTitle}`);
  }
  if ((page.content || []).length !== EXPECTED_ROOT_CHILDREN) {
    throw new Error(`루트 자식 수가 51이 아닙니다. ${(page.content || []).length}`);
  }
  if (toggleCount(blocks) !== EXPECTED_TOGGLES) {
    throw new Error(`토글 수가 9가 아닙니다. ${toggleCount(blocks)}`);
  }
  if (imageCount(blocks) !== EXPECTED_IMAGES) {
    throw new Error(`이미지 블록 수가 5가 아닙니다. ${imageCount(blocks)}`);
  }
  if (!markdown.includes(SOURCE_URL)) throw new Error("원문 주소가 없습니다.");
  for (const header of REQUIRED_HEADERS) {
    if (!markdown.includes(header)) throw new Error(`헤더가 없습니다. ${header}`);
  }
  if (stats.images !== EXPECTED_IMAGES + 1) {
    throw new Error(`TipTap 이미지 수가 6이 아닙니다. ${stats.images}`);
  }
  if (stats.tables !== 1) {
    throw new Error(`표 수가 1이 아닙니다. ${stats.tables}`);
  }
  if (UNSAFE_URL_PARTS.some((part) => markdown.includes(part))) {
    throw new Error("만료 서명 URL이 본문에 남아 있습니다.");
  }
  for (const href of REQUIRED_HREFS) {
    if (!stats.hrefs.includes(href)) throw new Error(`링크가 없습니다. ${href}`);
  }
}

function findLocalPage(db, title) {
  return db
    .prepare(
      `SELECT id, title, content FROM custom_pages
       WHERE user_id = ? AND (title = ? OR content LIKE ? OR content LIKE ?)`
    )
    .get(LOCAL_USER, title, `%${NOTION_PAGE_ID}%`, `%${NOTION_PAGE_HEX}%`);
}

function importLocal(page) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pages: 0, pageUpdates: 0, pageSkips: 0, pageId: page.id };
  const existing = findLocalPage(db, page.title);
  if (existing && existing.content === page.content) {
    result.pageSkips += 1;
    result.pageId = existing.id;
  } else if (existing) {
    db.prepare(
      "UPDATE custom_pages SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?"
    ).run(page.content, page.updated_at, existing.id, LOCAL_USER);
    result.pageUpdates += 1;
    result.pageId = existing.id;
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
    result.pages += 1;
  }
  db.close();
  return result;
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
  const { data, error } = await supabase
    .from("custom_pages")
    .select("id, content")
    .eq("user_id", PROD_USER)
    .eq("title", page.title)
    .limit(1);
  if (error) throw error;
  const existing = data?.[0];
  if (existing && existing.content === page.content) {
    result.pageSkips += 1;
    result.pageId = existing.id;
    return result;
  }
  if (existing) {
    const { error: updateError } = await supabase
      .from("custom_pages")
      .update({ content: page.content, updated_at: page.updated_at })
      .eq("id", existing.id)
      .eq("user_id", PROD_USER);
    if (updateError) throw updateError;
    result.pageUpdates += 1;
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

async function main() {
  const blocks = await collectBlocks();
  const page = getBlock(blocks, NOTION_PAGE_ID);
  if (!page) throw new Error("Notion 페이지를 찾지 못했습니다.");
  const media = await resolveMedia(blocks, page);
  const { pageTitle, markdown } = buildMarkdown(
    blocks,
    NOTION_PAGE_ID,
    SOURCE_URL,
    media
  );
  const markdownToTiptapDoc = loadMarkdownToTiptap();
  const content = JSON.stringify(markdownToTiptapDoc(markdown));
  const stats = documentStats(content);
  assertIntegrity({ page, blocks, pageTitle, markdown, stats });

  if (process.argv.includes("--check")) {
    console.log({
      pageTitle,
      blocks: blocks.size,
      rootChildren: (page.content || []).length,
      toggles: toggleCount(blocks),
      markdownLength: markdown.length,
      images: stats.images,
      tables: stats.tables,
      links: stats.links,
    });
    return;
  }

  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    title: pageTitle,
    content,
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record);
  record.id = local.pageId;
  const production = await importProduction(record);
  const pageId = production.pageId || local.pageId;
  console.log({
    local: {
      pages: local.pages,
      pageUpdates: local.pageUpdates,
      pageSkips: local.pageSkips,
    },
    production: {
      pages: production.pages,
      pageUpdates: production.pageUpdates,
      pageSkips: production.pageSkips,
    },
    pageId,
    path: `/pages/${pageId}`,
  });
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
