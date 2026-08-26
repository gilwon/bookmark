// 디자인 플러그인 5개·21st MCP·클로드 디자인 켜기 원문을 Pages에만 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const ENDPOINT = "https://www.notion.so/api/v3/loadPageChunk";
const SIGNED_FILE_ENDPOINT = "https://www.notion.so/api/v3/getSignedFileUrls";
const UNSAFE_URL_PARTS = [
  "file.notion.so",
  "expirationTimestamp",
  "X-Amz",
  "prod-files-secure",
  "blob:",
  "fbclid",
];
const DEFAULT_HEADING = {
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

export const FIELDBY_SOURCE =
  "https://fieldby.notion.site/5-3c5d730b39538128a0b3cd708a04e204";
export const FIELDBY_PAGE_ID = "3c5d730b-3953-8128-a0b3-cd708a04e204";
export const FIELDBY_TITLE = "클로드 코드 디자인 플러그인 5개 설치 가이드";

export const DESIGN_SOURCE =
  "https://app.notion.com/p/3c473c7b15ad81f09d8eede9c2048762";
export const DESIGN_PAGE_ID = "3c473c7b-15ad-81f0-9d8e-ede9c2048762";
export const DESIGN_TITLE = "클로드 코드에서 디자인 열기 — 켜기 전에 알아둘 것들";

export const TWENTYFIRST_SOURCE = "https://21st.dev/mcp";
export const TWENTYFIRST_TITLE =
  "21st MCP — UI Components for AI Coding Agents";

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

function imageMime(bytes, header) {
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

export function renderBlock(
  block,
  blocks,
  media = new Map(),
  path = new Set(),
  files = new Map(),
  options = {}
) {
  if (!block) return "";
  const pageId = options.pageId ?? "";
  const headingPrefix = { ...DEFAULT_HEADING, ...(options.heading ?? {}) };
  const id = block.id;
  if (id && path.has(id)) return "";
  const nextPath = id ? new Set(path).add(id) : new Set(path);
  const type = block.type;
  if (type === "page" && id && id !== pageId) {
    const title = titleOf(block) || "Notion 페이지";
    return `[${title}](https://www.notion.so/${String(id).replaceAll("-", "")})`;
  }
  const title = titleOf(block);
  const childMarkdown = joinRendered(
    (block.content ?? [])
      .map((childId) =>
        renderBlock(
          getBlock(blocks, childId),
          blocks,
          media,
          nextPath,
          files,
          options
        )
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
  if (type === "bookmark") {
    const url = sourceOf(block);
    if (!url) return title;
    return `[${title || url}](${url})`;
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
  if (type === "to_do") {
    const checked = /^(yes|true)$/i.test(plainText(block.properties?.checked));
    return [`- [${checked ? "x" : " "}] ${title}`, childMarkdown]
      .filter(Boolean)
      .join("\n");
  }
  if (type === "bulleted_list" || type === "bulleted_list_item") {
    return [`- ${title}`, childMarkdown].filter(Boolean).join("\n");
  }
  if (type === "numbered_list" || type === "numbered_list_item") {
    return [`1. ${title}`, childMarkdown].filter(Boolean).join("\n");
  }
  if (headingPrefix[type]) {
    return [`${headingPrefix[type]} ${title}`, childMarkdown]
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
  files = new Map(),
  options = {}
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
          files,
          { ...options, pageId }
        )
      )
      .filter(Boolean)
  );
  for (const block of [...blocks.values()]) {
    if (block.type === "image" && !media.has(block.id)) {
      throw new Error(`이미지를 변환하지 못했습니다. ${block.id}`);
    }
    if ((block.type === "file" || block.type === "pdf") && !files.has(block.id)) {
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
        const href = mark.attrs.href;
        if (
          href.startsWith("/api/page-attachments/") ||
          (href.startsWith("data:") && !href.startsWith("data:image/"))
        ) {
          stats.attachments += 1;
        }
      }
    }
    for (const child of node.content ?? []) visit(child);
  }
  visit(JSON.parse(tiptapJsonString));
  return stats;
}

function countType(blocks, type) {
  let count = 0;
  for (const block of blocks.values()) {
    if (block.type === type) count += 1;
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

function parentsWithMissingChildren(blocks, pageId, fetched) {
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
  let queue = parentsWithMissingChildren(blocks, pageId, fetched);
  while (queue.length) {
    const id = queue.shift();
    if (fetched.has(id)) continue;
    fetched.add(id);
    const chunk = await requestChunk(id);
    absorbChunk(blocks, chunk);
    queue = parentsWithMissingChildren(blocks, pageId, fetched);
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

async function resolveMedia(blocks, page, pageId) {
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
      `${pageId}:cover`,
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
      assertDownloadableAttachment(
        filename,
        bytes,
        response.headers.get("content-type")
      )
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

export function build21stMarkdown() {
  return [
    `# ${TWENTYFIRST_TITLE}`,
    `> 원문. [21st](${TWENTYFIRST_SOURCE})`,
    "Connect Cursor, Claude Code, Windsurf, or any MCP client to the 21st catalog: search 12,000+ React components and install them without leaving your editor. Formerly known as Magic MCP — the `@21st-dev/magic` package still works.",
    "## CLI & MCP",
    "Use 21st in your agent. Search the catalog, install components, generate UI and publish your own work — from the terminal or any MCP client.",
    "One global install; login opens the browser and saves a token locally.",
    "In CI or scripts, skip login and pass `--api-key $API_KEY_21ST` (or set the env var) instead.",
    "## What do you want to do?",
    "Each job is a skill CLI loads on its own, plus the command behind it. Install the skills once.",
    "### Find and install a component",
    "Search the catalog, read the real code, bring it in with its dependencies.",
    "Search free · 2 installs a day",
    "```text\n21st search \"pricing table\"\n```",
    "### Sketch UI with 21st AI",
    "Draft several variants from a prompt, preview them, keep the one that works.",
    "Uses AI credits",
    "```text\n21st generate \"a pricing table\" --variants 3\n```",
    "### Explore design directions",
    "Meaningfully different directions grounded in this project, before any code.",
    "```text\nshow me three directions for this page\n```",
    "### Build a screen in our style",
    "Production UI that reuses the components and conventions already here.",
    "```text\nbuild the settings screen in our style\n```",
    "### Review the UI we have",
    "Audit design, accessibility and responsive behavior with evidence, then fix.",
    "```text\naudit this page and fix what is clearly broken\n```",
    "### Publish our theme",
    "Turn the project's own CSS variables into a theme the community can install.",
    "```text\n21st publish-theme ./theme.css --name \"Midnight\"\n```",
    "### Publish to our library",
    "One file in, one install command out for everyone else on the team.",
    "```text\n21st publish ./PinList.tsx\n```",
    "### Manage what we shipped",
    "Descriptions, tags and visibility across everything published, in one pass.",
    "```text\n21st components --status all\n```",
    "Search, publishing and managing are free. Installs are capped at two a day, and 21st AI needs credits.",
  ].join("\n\n");
}

export function assert21stLiveHtml(html) {
  const required = [
    "21st MCP",
    "API_KEY_21ST",
    "What do you want to do",
    "21st search",
    "21st generate",
    "21st publish-theme",
    "21st publish",
    "21st components",
  ];
  const decoded = html
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");
  for (const phrase of required) {
    if (!decoded.includes(phrase)) {
      throw new Error(`21st 원문에 문구가 없습니다. ${phrase}`);
    }
  }
}

export function isDuplicateRow(row, title, markers) {
  if (!row) return false;
  if (row.title === title) return true;
  const content = String(row.content ?? "");
  return markers.some((marker) => marker && content.includes(marker));
}

function assertIntegrity(spec, { page, blocks, pageTitle, markdown, stats }) {
  if (pageTitle !== spec.title) {
    throw new Error(`페이지 제목이 다릅니다. ${pageTitle}`);
  }
  if ((page.content || []).length !== spec.root) {
    throw new Error(`루트 자식 수가 다릅니다. ${(page.content || []).length}`);
  }
  if (countType(blocks, "code") !== spec.codes) {
    throw new Error(`코드 블록 수가 다릅니다. ${countType(blocks, "code")}`);
  }
  if (countType(blocks, "image") !== spec.images) {
    throw new Error(`이미지 블록 수가 다릅니다. ${countType(blocks, "image")}`);
  }
  if (attachmentCount(blocks) !== spec.attachments) {
    throw new Error(`첨부 블록 수가 다릅니다. ${attachmentCount(blocks)}`);
  }
  if (stats.images !== spec.images) {
    throw new Error(`TipTap 이미지 수가 다릅니다. ${stats.images}`);
  }
  if (stats.attachments !== spec.attachments) {
    throw new Error(`TipTap 첨부 수가 다릅니다. ${stats.attachments}`);
  }
  if (stats.tables !== spec.tables) {
    throw new Error(`표 수가 다릅니다. ${stats.tables}`);
  }
  if (stats.codes !== spec.codes) {
    throw new Error(`TipTap 코드 수가 다릅니다. ${stats.codes}`);
  }
  if (stats.callouts !== spec.callouts) {
    throw new Error(`콜아웃 수가 다릅니다. ${stats.callouts}`);
  }
  if (!markdown.includes(spec.sourceUrl)) throw new Error("원문 주소가 없습니다.");
  for (const phrase of spec.phrases) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  if (UNSAFE_URL_PARTS.some((part) => markdown.includes(part))) {
    throw new Error("만료 서명 URL이 본문에 남아 있습니다.");
  }
  for (const href of spec.hrefs) {
    if (!stats.hrefs.includes(href)) throw new Error(`링크가 없습니다. ${href}`);
  }
}

function findLocalPage(db, title, markers) {
  const rows = db
    .prepare("SELECT id, title, content FROM custom_pages WHERE user_id = ?")
    .all(LOCAL_USER);
  return rows.find((row) => isDuplicateRow(row, title, markers)) ?? null;
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
    .select("id")
    .eq("user_id", PROD_USER)
    .eq("title", page.title)
    .limit(1);
  if (error) throw error;
  if (data?.[0]) {
    result.pageSkips += 1;
    result.pageId = data[0].id;
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

const NOTION_SPECS = [
  {
    key: "fieldby",
    sourceUrl: FIELDBY_SOURCE,
    pageId: FIELDBY_PAGE_ID,
    title: FIELDBY_TITLE,
    root: 51,
    codes: 4,
    images: 0,
    attachments: 0,
    tables: 0,
    callouts: 2,
    heading: { sub_sub_header: "##", header_3: "##" },
    phrases: [
      "npx skills add https://github.com/Leonxlnx/taste-skill",
      "npx skills add vercel-labs/agent-skills",
      "npx @21st-dev/cli@latest init --client claude",
      "claude mcp add playwright npx @playwright/mcp@latest",
      "자주 묻는 질문",
    ],
    hrefs: [
      FIELDBY_SOURCE,
      "https://github.com/Leonxlnx/taste-skill",
      "https://github.com/vercel-labs/agent-skills",
      "https://github.com/VoltAgent/awesome-design-md",
      "https://21st.dev/mcp",
      "https://github.com/microsoft/playwright-mcp",
      "https://www.instagram.com/ai.trend.kr/",
    ],
  },
  {
    key: "design",
    sourceUrl: DESIGN_SOURCE,
    pageId: DESIGN_PAGE_ID,
    title: DESIGN_TITLE,
    root: 46,
    codes: 1,
    images: 0,
    attachments: 0,
    tables: 1,
    callouts: 2,
    heading: DEFAULT_HEADING,
    phrases: [
      "/design consent",
      "claude.ai/design",
      "인라인 댓글",
      "한글 폰트",
      "/design-sync",
    ],
    hrefs: [DESIGN_SOURCE],
  },
];

async function importNotionSpec(spec, markdownToTiptapDoc, checkOnly) {
  const blocks = await collectBlocks(spec.pageId);
  const page = getBlock(blocks, spec.pageId);
  if (!page) throw new Error(`Notion 페이지를 찾지 못했습니다. ${spec.key}`);
  const media = await resolveMedia(blocks, page, spec.pageId);
  const files = await resolveAttachments(blocks);
  const { pageTitle, markdown } = buildMarkdown(
    blocks,
    spec.pageId,
    spec.sourceUrl,
    media,
    files,
    { heading: spec.heading, pageId: spec.pageId }
  );
  const content = JSON.stringify(markdownToTiptapDoc(markdown));
  const stats = documentStats(content);
  assertIntegrity(spec, { page, blocks, pageTitle, markdown, stats });
  const markers = [
    spec.sourceUrl,
    spec.pageId,
    spec.pageId.replaceAll("-", ""),
  ];
  if (checkOnly) {
    return {
      key: spec.key,
      pageTitle,
      images: stats.images,
      attachments: stats.attachments,
      tables: stats.tables,
      codes: stats.codes,
      check: true,
    };
  }
  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    title: pageTitle,
    content,
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record, markers);
  record.id = local.pageId;
  const production = await importProduction(record);
  return {
    key: spec.key,
    pageTitle,
    pageId: production.pageId || local.pageId,
    path: `/pages/${production.pageId || local.pageId}`,
    images: stats.images,
    attachments: stats.attachments,
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

async function import21st(markdownToTiptapDoc, checkOnly) {
  const response = await fetch(TWENTYFIRST_SOURCE, {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  if (!response.ok) throw new Error(`21st HTTP ${response.status}`);
  assert21stLiveHtml(await response.text());
  const markdown = build21stMarkdown();
  const content = JSON.stringify(markdownToTiptapDoc(markdown));
  const stats = documentStats(content);
  if (!markdown.includes(TWENTYFIRST_SOURCE)) {
    throw new Error("21st 원문 주소가 없습니다.");
  }
  if (stats.codes < 8) throw new Error(`21st 코드가 부족합니다. ${stats.codes}`);
  if (UNSAFE_URL_PARTS.some((part) => markdown.includes(part))) {
    throw new Error("21st 본문에 추적 파라미터가 남아 있습니다.");
  }
  if (checkOnly) {
    return {
      key: "21st",
      pageTitle: TWENTYFIRST_TITLE,
      images: stats.images,
      attachments: stats.attachments,
      codes: stats.codes,
      check: true,
    };
  }
  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    title: TWENTYFIRST_TITLE,
    content,
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record, [
    `원문. [21st](${TWENTYFIRST_SOURCE})`,
  ]);
  record.id = local.pageId;
  const production = await importProduction(record);
  return {
    key: "21st",
    pageTitle: TWENTYFIRST_TITLE,
    pageId: production.pageId || local.pageId,
    path: `/pages/${production.pageId || local.pageId}`,
    images: stats.images,
    attachments: stats.attachments,
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

async function main() {
  const markdownToTiptapDoc = loadMarkdownToTiptap();
  const checkOnly = process.argv.includes("--check");
  const results = [];
  for (const spec of NOTION_SPECS) {
    results.push(await importNotionSpec(spec, markdownToTiptapDoc, checkOnly));
  }
  results.push(await import21st(markdownToTiptapDoc, checkOnly));
  console.log(JSON.stringify({ results }, null, 2));
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
