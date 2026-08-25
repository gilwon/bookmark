// 공개 Notion 「[AI Brief] Claude Code ELI5 설치 가이드」를 Pages에만 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE_URL =
  "https://rounded-fossa-8ea.notion.site/AI-Brief-Claude-Code-ELI5-3c75142006a68008a3bfd0641a6b00ec";
export const NOTION_PAGE_ID = "3c751420-06a6-8008-a3bf-d0641a6b00ec";
const NOTION_PAGE_HEX = NOTION_PAGE_ID.replaceAll("-", "");
const SPACE_ID = "fd451420-06a6-8128-a850-00038d44c4be";
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const ENDPOINT = "https://www.notion.so/api/v3/loadPageChunk";
const SIGNED_FILE_ENDPOINT = "https://www.notion.so/api/v3/getSignedFileUrls";
export const EXPECTED_TITLE =
  "[AI Brief] Claude Code ELI5 설치 가이드 및 실무 활용 프롬프트";
const EXPECTED_ROOT_CHILDREN = 31;
const EXPECTED_TOGGLES = 1;
const EXPECTED_IMAGES = 0;
const EXPECTED_ATTACHMENTS = 0;
const EXPECTED_TABLES = 1;
const EXPECTED_CODES = 7;
const EXPECTED_CALLOUTS = 3;
const REQUIRED_HEADERS = [
  "1. `eli5` 30초 설치",
  "2. 설치 확인",
  "3. 바로 실행할 첫 명령어",
  "4. 잘 안 될 때",
  "5. 업무에서 바로 쓰는 프롬프트 3개",
];
const REQUIRED_PHRASES = [
  "claude plugin marketplace add anthropics/claude-plugins-community",
  "claude plugin install eli5@claude-community",
  "/plugin marketplace add",
  "/eli5 이 프로젝트가 어떻게 동작하는지",
  "[기술 A] 대신 [기술 B]",
  "[장애명 또는 발생 시각]",
  "ELI5란?",
  "잘 쓰는 법",
  "커뮤니티 마켓플레이스",
  "증상",
  "해결법",
  "claude: command not found",
];
const REQUIRED_HREFS = [
  SOURCE_URL,
  "https://x.com/trq212/status/2090884854590382515",
  "https://github.com/anthropics/claude-plugins-community/tree/main/eli5",
  "https://code.claude.com/docs/en/discover-plugins",
  "https://app.notion.com/p/3c5d596ff5bd80cc8314f386247910a6",
];
const UNSAFE_URL_PARTS = [
  "file.notion.so",
  "expirationTimestamp",
  "X-Amz",
  "prod-files-secure",
  "blob:",
  "fbclid",
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

export function fileNameOf(block) {
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

function codeLanguage(block) {
  const raw =
    plainText(block.properties?.language) ||
    block.format?.code_language ||
    "text";
  return /^plain\s*text$/i.test(raw) ? "text" : String(raw).toLowerCase();
}

export function isZipBytes(bytes, filename) {
  if (/\.zip$/i.test(filename)) return true;
  return (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)
  );
}

export function imageMime(bytes, header) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (Buffer.from(bytes.subarray(0, 6)).toString("ascii").match(/^GIF8[79]a$/)) {
    return "image/gif";
  }
  if (Buffer.from(bytes.subarray(0, 12)).toString("ascii").match(/^RIFF....WEBP$/)) {
    return "image/webp";
  }
  if (header?.startsWith("image/")) return header.split(";")[0];
  throw new Error("이미지 MIME을 판별하지 못했습니다.");
}

function fileMime(bytes, header, filename) {
  try {
    return imageMime(bytes, header);
  } catch {
    if (header?.startsWith("image/")) return header.split(";")[0];
  }
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "application/pdf";
  }
  if (header && header !== "application/octet-stream") return header.split(";")[0];
  if (/\.pdf$/i.test(filename)) return "application/pdf";
  return "application/octet-stream";
}

export function assertDownloadableAttachment(filename, bytes, header) {
  if (isZipBytes(bytes, filename)) {
    throw new Error("ZIP 첨부는 page-attachment-storage 화이트리스트가 필요합니다.");
  }
  const mime = fileMime(bytes, header, filename);
  const dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  if (UNSAFE_URL_PARTS.some((part) => dataUrl.includes(part))) {
    throw new Error("만료 URL이 첨부 데이터에 남아 있습니다.");
  }
  return `[${filename}](${dataUrl})`;
}

function isAttachmentHref(href) {
  return (
    href.startsWith("/api/page-attachments/") ||
    (href.startsWith("data:") && !href.startsWith("data:image/"))
  );
}

export function renderBlock(
  block,
  blocks,
  media = new Map(),
  path = new Set(),
  files = new Map()
) {
  if (!block) return "";
  const id = block.id;
  if (id && path.has(id)) return "";
  const nextPath = id ? new Set(path).add(id) : new Set(path);
  const type = block.type;
  if (type === "page" && id && id !== NOTION_PAGE_ID) {
    const title = titleOf(block) || "Notion 페이지";
    return `[${title}](https://www.notion.so/${String(id).replaceAll("-", "")})`;
  }
  const title = titleOf(block);
  const childMarkdown = joinRendered(
    (block.content ?? [])
      .map((childId) =>
        renderBlock(getBlock(blocks, childId), blocks, media, nextPath, files)
      )
      .filter(Boolean)
  );
  if (type === "image") {
    const src = media.get(id);
    if (!src) throw new Error(`이미지를 변환하지 못했습니다. ${id}`);
    const caption = inlineMarkdown(block.properties?.caption).trim();
    return `![${caption || title || "Notion 이미지"}](${src})`;
  }
  if (type === "file" || type === "pdf") {
    const markdown = files.get(id);
    if (!markdown) throw new Error(`첨부 파일을 찾지 못했습니다. ${id}`);
    return markdown;
  }
  if (type === "code") {
    const body = plainText(block.properties?.title);
    return `\`\`\`${codeLanguage(block)}\n${body}\n\`\`\``;
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
    const heading = /^\*\*.*\*\*$/.test(title) ? title : `**${title}**`;
    return [heading, childMarkdown].filter(Boolean).join("\n\n");
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

export function buildMarkdown(
  blocks,
  pageId,
  sourceUrl,
  media = new Map(),
  files = new Map()
) {
  const page = getBlock(blocks, pageId);
  const pageTitle = plainText(page?.properties?.title).trim();
  const cover = media.get(`${pageId}:cover`);
  const body = joinRendered(
    (page?.content ?? [])
      .map((id) =>
        renderBlock(
          getBlock(blocks, id),
          blocks,
          media,
          new Set([pageId]),
          files
        )
      )
      .filter(Boolean)
  );
  for (const block of [...blocks.values()]) {
    if (block.type === "image" && !media.has(block.id)) {
      throw new Error(`이미지를 변환하지 못했습니다. ${block.id}`);
    }
    if (
      (block.type === "file" || block.type === "pdf") &&
      !files.has(block.id)
    ) {
      throw new Error(`첨부 파일을 찾지 못했습니다. ${block.id}`);
    }
  }
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
  const stats = {
    images: 0,
    tables: 0,
    links: 0,
    hrefs: [],
    codes: 0,
    callouts: 0,
    attachments: 0,
  };
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "image") stats.images += 1;
    if (node.type === "table") stats.tables += 1;
    if (node.type === "codeBlock") stats.codes += 1;
    if (node.type === "callout") stats.callouts += 1;
    for (const mark of node.marks ?? []) {
      if (mark?.type === "link" && mark.attrs?.href) {
        stats.links += 1;
        stats.hrefs.push(mark.attrs.href);
        if (isAttachmentHref(mark.attrs.href)) stats.attachments += 1;
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

function attachmentCount(blocks) {
  let count = 0;
  for (const block of blocks.values()) {
    if (block.type === "file" || block.type === "pdf") count += 1;
  }
  return count;
}

function codeCount(blocks) {
  let count = 0;
  for (const block of blocks.values()) {
    if (block.type === "code") count += 1;
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
  const cover = page.format?.page_cover;
  if (cover) {
    media.set(
      `${NOTION_PAGE_ID}:cover`,
      await dataUrlFromResponse(await fetchMedia(cover, page))
    );
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
      if (UNSAFE_URL_PARTS.some((part) => url.includes(part))) {
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
      assertDownloadableAttachment(filename, bytes, response.headers.get("content-type"))
    );
  }
  return files;
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
    throw new Error(`루트 자식 수가 31이 아닙니다. ${(page.content || []).length}`);
  }
  if (toggleCount(blocks) !== EXPECTED_TOGGLES) {
    throw new Error(`토글 수가 1이 아닙니다. ${toggleCount(blocks)}`);
  }
  if (imageCount(blocks) !== EXPECTED_IMAGES) {
    throw new Error(`이미지 블록 수가 0이 아닙니다. ${imageCount(blocks)}`);
  }
  if (attachmentCount(blocks) !== EXPECTED_ATTACHMENTS) {
    throw new Error(`첨부 블록 수가 0이 아닙니다. ${attachmentCount(blocks)}`);
  }
  if (codeCount(blocks) !== EXPECTED_CODES) {
    throw new Error(`코드 블록 수가 7이 아닙니다. ${codeCount(blocks)}`);
  }
  if (!markdown.includes(SOURCE_URL)) throw new Error("원문 주소가 없습니다.");
  for (const header of REQUIRED_HEADERS) {
    if (!markdown.includes(header)) throw new Error(`헤더가 없습니다. ${header}`);
  }
  for (const phrase of REQUIRED_PHRASES) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  if (stats.images !== EXPECTED_IMAGES) {
    throw new Error(`TipTap 이미지 수가 0이 아닙니다. ${stats.images}`);
  }
  if (stats.attachments !== EXPECTED_ATTACHMENTS) {
    throw new Error(`TipTap 첨부 수가 0이 아닙니다. ${stats.attachments}`);
  }
  if (stats.tables !== EXPECTED_TABLES) {
    throw new Error(`표 수가 1이 아닙니다. ${stats.tables}`);
  }
  if (stats.codes !== EXPECTED_CODES) {
    throw new Error(`TipTap 코드 수가 7이 아닙니다. ${stats.codes}`);
  }
  if (stats.callouts !== EXPECTED_CALLOUTS) {
    throw new Error(`콜아웃 수가 3이 아닙니다. ${stats.callouts}`);
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
  const files = await resolveAttachments(blocks);
  const { pageTitle, markdown } = buildMarkdown(
    blocks,
    NOTION_PAGE_ID,
    SOURCE_URL,
    media,
    files
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
      attachments: stats.attachments,
      tables: stats.tables,
      codes: stats.codes,
      callouts: stats.callouts,
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
    images: stats.images,
    attachments: stats.attachments,
  });
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
