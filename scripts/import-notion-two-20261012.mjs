// 2026-10-12에 붙여 넣은 Notion 가이드 2건을 Pages에만 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import {
  buildMarkdown,
  documentStats,
  imageMime,
  plainText,
} from "./import-claude-eli5-page.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const SPACE_ID = "c9f63792-cf01-4ae9-982a-b4c0bb0f97a7";
const COOKIE_RELATIVE = "tmp/notion-kst-20260920/cookies.txt";
const COOKIE_PATH = resolve(root, COOKIE_RELATIVE);
const NOTION_ENDPOINT = "https://www.notion.so/api/v3/loadPageChunk";
const SIGNED_FILE_ENDPOINT = "https://www.notion.so/api/v3/getSignedFileUrls";
const retryDelays = [15000, 30000, 60000];
let lastRequestAt = 0;
let cachedCookie;
const EXPIRED_URL_PARTS = [
  "prod-files-secure",
  "file.notion.so",
  "expirationTimestamp",
  "X-Amz",
  "blob:",
  "fbclid",
  "utm_source",
];
/** 이미 이관했거나 링크로만 남길 hex. TARGETS에 넣지 않는다. */
export const SKIPPED_HEXES = [
  "285b256827ac829cb58381e6c9409da2",
  "3db98dec8eed8107b5eac827fe906cce",
  "417b256827ac83d09bb7013942b14bef",
  "f7bb256827ac8381be0e81a4cb198bbe",
  "f65b256827ac82bbaa25014f824bab76",
  "9beb256827ac823fb0120170ad07c5b9",
  "ef4b256827ac8250ac8001830bc891b4",
];
const MENTION_ONLY_HEX = "3db98dec8eed8107b5eac827fe906cce";

export const TARGETS = [
  {
    key: "instructions",
    title: "클로드 AI 팀장 켜기 전에, 지시문부터 붙여넣기",
    hex: "3f073c7b15ad8196bfc1e7956a7a1864",
    pageId: "3f073c7b-15ad-8196-bfc1-e7956a7a1864",
    sourceUrl: "https://app.notion.com/p/3f073c7b15ad8196bfc1e7956a7a1864",
    images: 0,
    attachments: 0,
    root: 65,
    tables: 2,
    codes: 5,
    phrases: ["클로드 새 프로젝트", "용도별 지시문"],
    requiredHrefs: [
      "https://claude.ai/code",
      "https://claude.com/form/projects",
      "https://code.claude.com/docs/en/claude-projects",
      "https://claude.com/blog/projects-redesigned",
      "https://sebia.ai",
    ],
  },
  {
    key: "workflow",
    title: "[가이드] AI로 나만의 노션 대시보드 만들고 자동화하기 - 전체 워크플로우",
    hex: "3f3e43a1672080b283a5e5f8ad06a6b9",
    pageId: "3f3e43a1-6720-80b2-83a5-e5f8ad06a6b9",
    sourceUrl: "https://app.notion.com/p/3f3e43a1672080b283a5e5f8ad06a6b9",
    images: 0,
    attachments: 0,
    root: 59,
    tables: 4,
    codes: 6,
    phrases: ["전체 흐름", "돈 관리 대시보드"],
    requiredHrefs: [
      "https://www.instagram.com/beucheo.ai/",
      "https://open.kakao.com/o/g8oGrusi",
    ],
  },
];

export const EXPECTED_IMAGES = Object.fromEntries(
  TARGETS.map((item) => [item.key, item.images])
);

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

function redact(value) {
  return String(value ?? "").replace(/https?:\/\/\S+/g, "[url]");
}

/** x.com과 twitter.com에서만 공유 쿼리 s를 지운다. */
function dropsXShareQuery(hostname) {
  const host = String(hostname ?? "").toLowerCase();
  return (
    host === "x.com" ||
    host === "twitter.com" ||
    host.endsWith(".x.com") ||
    host.endsWith(".twitter.com")
  );
}

/** localhost는 http 그대로 둔다. */
function keepsHttp(hostname) {
  return String(hostname ?? "").toLowerCase() === "localhost";
}

/** 유입 추적 쿼리를 빼고 localhost가 아닌 http는 https로 바꾼다. Threads 단축 주소는 목적지 주소만 남긴다. */
export function stripTracking(url, base) {
  if (!url) return url;
  if (String(url).startsWith("data:")) return url;
  if (String(url).startsWith("/api/page-attachments/")) return url;
  try {
    const parsed = new URL(url, base);
    if (parsed.hostname === "l.threads.com") {
      const target = parsed.searchParams.get("u");
      if (target) return stripTracking(target, base);
    }
    if (parsed.protocol === "http:" && !keepsHttp(parsed.hostname)) {
      parsed.protocol = "https:";
    }
    if (
      parsed.hostname === "instagram.com" ||
      parsed.hostname === "www.instagram.com"
    ) {
      parsed.hostname = "www.instagram.com";
      if (parsed.pathname.length > 1) {
        parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
      }
    }
    for (const key of [...parsed.searchParams.keys()]) {
      const value = parsed.searchParams.get(key);
      if (
        key.startsWith("utm_") ||
        key === "fbclid" ||
        key === "pvs" ||
        key === "mcp_token" ||
        (key === "from" && value === "dm") ||
        (key === "source" && value === "copy_link") ||
        (key === "s" && dropsXShareQuery(parsed.hostname))
      ) {
        parsed.searchParams.delete(key);
      }
    }
    if ([...parsed.searchParams.keys()].length === 0) parsed.search = "";
    const source = String(url);
    const hadTrailingSlash = source.split(/[?#]/, 1)[0].endsWith("/");
    if (parsed.pathname === "/" && !hadTrailingSlash) {
      return `${parsed.origin}${parsed.search}${parsed.hash}`;
    }
    return parsed.href;
  } catch {
    return String(url)
      .replace(/^http:\/\/(?!localhost(?:[:/]|$))/i, "https://")
      .replace(/[?&](?:utm_[^=&#]*|fbclid|pvs|mcp_token)=[^&\s)#]*/g, "")
      .replace(/[?&]from=dm(?=&|$)/g, "")
      .replace(/[?&]source=copy_link/g, "")
      .replace(/[?&]$/, "")
      .replace(/\?&/, "?");
  }
}

/** 만료 URL 문자열이 본문에 없으면 true다. */
export function hasNoExpiredUrl(text) {
  const value = String(text ?? "");
  return EXPIRED_URL_PARTS.every((part) => !value.includes(part));
}

/** 제목 또는 source_url이 정확히 같으면 중복이다. 비슷한 제목은 통과한다. */
export function isDuplicateRow(row, title, markers) {
  if (!row) return false;
  if (row.title === title) return true;
  const source = String(row.source_url ?? "");
  const list = Array.isArray(markers) ? markers : [markers];
  return list.some((marker) => marker && source === String(marker));
}

/** 이미 링크가 아닌 맨 http(s) URL을 마크다운 링크로 바꾼다. */
export function autolinkBareUrls(markdown) {
  const parts = String(markdown).split(/(```[\s\S]*?```)/);
  return parts
    .map((part) => {
      if (part.startsWith("```")) return part;
      return part.replace(
        /(!?\[[^\]]*]\()([^)]*)(\))|(https?:\/\/[^\s)<]+)/g,
        (match, prefix, href, suffix, bare) => {
          if (bare) {
            if (bare.startsWith("data:")) return match;
            const cleaned = stripTracking(bare);
            return `[${cleaned}](${cleaned})`;
          }
          if (href && /^https?:\/\//i.test(href)) {
            return `${prefix}${stripTracking(href)}${suffix}`;
          }
          return match;
        }
      );
    })
    .join("");
}

function getBlock(blocks, id) {
  if (!blocks || id == null) return null;
  if (typeof blocks.get === "function") return blocks.get(id) ?? null;
  return blocks[id] ?? null;
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
  let count = 0;
  for (const block of blocks.values()) {
    if (block.type === "file" || block.type === "pdf") count += 1;
  }
  return count;
}

function sourceOf(block) {
  return (
    plainText(block?.properties?.source) ||
    block?.format?.display_source ||
    block?.format?.original_url ||
    ""
  );
}

function bookmarkHref(block) {
  return (
    plainText(block?.properties?.link) ||
    sourceOf(block) ||
    block?.format?.bookmark_url ||
    ""
  );
}

function storedTitleOf(title) {
  return String(title ?? "")
    .replace(/^🌍\s*/, "")
    .trim();
}

function bareHex(id) {
  return String(id ?? "").replaceAll("-", "").toLowerCase();
}

function isMentionOnly(id) {
  return bareHex(id) === MENTION_ONLY_HEX;
}

/** 대상 페이지와 그 자손만 남긴다. 자식 페이지와 언급 전용 3db98dec는 펼치지 않는다. */
function subtreeIds(blocks, pageId) {
  const ids = new Set();
  const stack = [pageId];
  while (stack.length) {
    const id = stack.pop();
    if (!id || ids.has(id)) continue;
    const block = blocks.get(id);
    if (!block) continue;
    ids.add(id);
    if (isMentionOnly(id)) continue;
    if (block.type === "page" && id !== pageId) continue;
    for (const childId of block.content ?? []) stack.push(childId);
  }
  return ids;
}

export function keepSubtree(blocks, pageId) {
  const owned = subtreeIds(blocks, pageId);
  const kept = new Map();
  for (const [id, block] of blocks) {
    if (owned.has(id)) kept.set(id, block);
  }
  return kept;
}

function missingChildCount(blocks, pageId) {
  const owned = subtreeIds(blocks, pageId);
  let missing = 0;
  for (const [id, block] of blocks) {
    if (!owned.has(id)) continue;
    if (isMentionOnly(id)) continue;
    if (block.type === "page" && id !== pageId) continue;
    for (const childId of block.content ?? []) {
      if (!blocks.has(childId)) missing += 1;
    }
  }
  return missing;
}

function looksLikeSvg(bytes, hint = "") {
  if (/\.svg(?:$|[?#])/i.test(String(hint))) return true;
  const head = Buffer.from(bytes.subarray(0, 512)).toString("utf8");
  return /<svg[\s>/]/i.test(head);
}

/** SVG는 image MIME이 아니어도 data URL로 넣는다. */
function imageMimeOf(bytes, header, hint = "") {
  if (looksLikeSvg(bytes, hint) || /svg/i.test(String(header ?? ""))) {
    return "image/svg+xml";
  }
  return imageMime(bytes, header);
}

function pointerIdOf(block) {
  const pointer = block?.format?.transclusion_reference_pointer;
  if (!pointer) return "";
  if (typeof pointer === "string") return pointer;
  return pointer.id ?? "";
}

/** 내용이 비어 있는 동기화 참조에 컨테이너 자식을 복사한다. */
function expandEmptyTransclusions(blocks) {
  for (const block of blocks.values()) {
    if (block.type !== "transclusion_reference") continue;
    if ((block.content ?? []).length) continue;
    const pointerId = pointerIdOf(block);
    if (!pointerId) continue;
    const children = blocks.get(pointerId)?.content ?? [];
    if (!children.length) continue;
    block.content = [...children];
  }
}

/** 북마크, 할 일, 트윗을 마크다운이 알아먹는 형태로 바꾸고 빈 동기화 참조를 펼친다. */
export function preprocessBlocks(blocks) {
  expandEmptyTransclusions(blocks);
  for (const block of blocks.values()) {
    if (block.type === "bookmark") {
      const href = stripTracking(bookmarkHref(block));
      if (href) {
        const label = plainText(block.properties?.title).trim() || href;
        block.properties = {
          ...(block.properties || {}),
          title: [[label, [["a", href]]]],
        };
      }
    }
    if (block.type === "tweet") {
      const href = stripTracking(sourceOf(block));
      if (href) {
        const label = plainText(block.properties?.title).trim() || href;
        block.type = "text";
        block.properties = {
          ...(block.properties || {}),
          title: [[label, [["a", href]]]],
        };
      }
    }
    if (block.type === "to_do") {
      const checked = /^(yes|true)$/i.test(plainText(block.properties?.checked));
      const prefix = checked ? "[x] " : "[ ] ";
      const title = Array.isArray(block.properties?.title)
        ? block.properties.title
        : [];
      block.type = "bulleted_list";
      block.properties = {
        ...(block.properties || {}),
        title: [[prefix], ...title],
      };
    }
  }
}

function fenceParts(lines) {
  const parts = [];
  let buffer = [];
  let index = 0;
  const flush = () => {
    if (buffer.length) parts.push({ kind: "text", lines: buffer });
    buffer = [];
  };
  while (index < lines.length) {
    if (/^```/.test(lines[index] ?? "")) {
      flush();
      const fence = [lines[index]];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index] ?? "")) {
        fence.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) {
        fence.push(lines[index]);
        index += 1;
      }
      parts.push({ kind: "fence", lines: fence });
      continue;
    }
    buffer.push(lines[index]);
    index += 1;
  }
  flush();
  return parts;
}

function calloutBody(lines, start) {
  let index = start + 1;
  let depth = 1;
  const body = [];
  while (index < lines.length && depth > 0) {
    const trimmed = (lines[index] ?? "").trim();
    if (/^:::callout\s*$/i.test(trimmed)) depth += 1;
    else if (/^:::\s*$/.test(trimmed)) depth -= 1;
    if (depth === 0) {
      index += 1;
      break;
    }
    body.push(lines[index]);
    index += 1;
  }
  return { body, next: index };
}

/** 콜아웃 안 코드 펜스를 밖으로 꺼낸다. TipTap은 콜아웃 안의 펜스를 문단으로 접는다. */
export function liftFencesOutOfCallouts(markdown) {
  const lines = String(markdown).split("\n");
  const out = [];
  let index = 0;
  while (index < lines.length) {
    if (!/^:::callout\s*$/i.test((lines[index] ?? "").trim())) {
      out.push(lines[index]);
      index += 1;
      continue;
    }
    const extracted = calloutBody(lines, index);
    index = extracted.next;
    const lifted = liftFencesOutOfCallouts(extracted.body.join("\n"));
    for (const part of fenceParts(lifted.split("\n"))) {
      if (part.kind === "fence") {
        if (out.length && out[out.length - 1] !== "") out.push("");
        out.push(...part.lines);
        out.push("");
        continue;
      }
      const text = part.lines.join("\n").trim();
      if (!text) continue;
      if (out.length && out[out.length - 1] !== "") out.push("");
      out.push(":::callout");
      out.push(text);
      out.push(":::");
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

function finalizeMarkdown(markdown, spec) {
  let text = String(markdown);
  if (text.startsWith("# ")) {
    const newline = text.indexOf("\n");
    text = `# ${spec.title}${newline === -1 ? "" : text.slice(newline)}`;
  }
  return autolinkBareUrls(liftFencesOutOfCallouts(text));
}

function imageLinkOf(node) {
  if (!node || node.type !== "text" || !Array.isArray(node.marks)) return null;
  const link = node.marks.find(
    (mark) => mark?.type === "link" && typeof mark.attrs?.href === "string"
  );
  if (!link?.attrs.href.startsWith("data:image/")) return null;
  return { href: link.attrs.href, text: String(node.text ?? "") };
}

/** 콜아웃 안 이미지는 인라인 링크로 내려가므로 image 노드로 되돌린다. */
function restoreDataImages(node) {
  if (!node || typeof node !== "object") return node;
  if (!Array.isArray(node.content)) return node;
  const next = [];
  for (const child of node.content) {
    const restored = restoreParagraphImages(child);
    const list = Array.isArray(restored) ? restored : [restored];
    for (const item of list) next.push(restoreDataImages(item));
  }
  node.content = next;
  return node;
}

function restoreParagraphImages(node) {
  if (node?.type !== "paragraph" || !Array.isArray(node.content)) return node;
  const parts = [];
  let buffer = [];
  const flush = () => {
    if (!buffer.length) return;
    parts.push({ type: "paragraph", content: buffer });
    buffer = [];
  };
  for (let index = 0; index < node.content.length; index += 1) {
    const current = node.content[index];
    const nextLink = imageLinkOf(node.content[index + 1]);
    if (current?.type === "text" && current.text === "!" && !current.marks && nextLink) {
      flush();
      parts.push({ type: "image", attrs: { src: nextLink.href, alt: nextLink.text } });
      index += 1;
      continue;
    }
    const self = imageLinkOf(current);
    if (self) {
      flush();
      parts.push({ type: "image", attrs: { src: self.href, alt: self.text } });
      continue;
    }
    buffer.push(current);
  }
  flush();
  return parts.length ? parts : node;
}

function imageSourcesOf(content) {
  const sources = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "image") sources.push(String(node.attrs?.src ?? ""));
    for (const child of node.content ?? []) visit(child);
  }
  visit(JSON.parse(content));
  return sources;
}

/** attachment 소스는 마지막 콜론 뒤 파일명을 제목보다 우선한다. */
export function imageNameOf(block) {
  const title = plainText(block?.properties?.title).trim().normalize("NFC");
  const source = sourceOf(block);
  if (source.startsWith("attachment:")) {
    const raw = source.split(":").at(-1) ?? "";
    let tail = raw;
    try {
      tail = decodeURIComponent(raw);
    } catch {
      tail = raw;
    }
    tail = tail.trim().normalize("NFC");
    if (tail) return tail;
  }
  let tail = "";
  if (source) {
    const path = source.split("?")[0].split("/").pop() ?? "";
    try {
      tail = decodeURIComponent(path).normalize("NFC");
    } catch {
      tail = path.normalize("NFC");
    }
  }
  return title || tail;
}

function imageNamesInOrder(blocks, pageId) {
  const names = [];
  function visit(id) {
    const block = blocks.get(id);
    if (!block) return;
    if (block.type === "page" && id !== pageId) return;
    if (block.type === "image") names.push(imageNameOf(block));
    for (const childId of block.content ?? []) visit(childId);
  }
  visit(pageId);
  return names;
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

/** 로그인 쿠키는 요청 시에만 읽고 값은 출력하지 않는다. */
function notionCookie() {
  if (cachedCookie != null) return cachedCookie;
  if (!existsSync(COOKIE_PATH)) {
    throw new Error(`Notion 쿠키가 없습니다. ${COOKIE_RELATIVE}`);
  }
  const raw = readFileSync(COOKIE_PATH, "utf8").trim();
  if (!raw) {
    throw new Error(`Notion 쿠키가 없습니다. ${COOKIE_RELATIVE}`);
  }
  cachedCookie = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .join("; ");
  return cachedCookie;
}

function mediaHeaders() {
  return {
    referer: "https://www.notion.so/",
    "user-agent": "Mozilla/5.0",
    cookie: notionCookie(),
  };
}

async function pace() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < 1200) await pause(1200 - elapsed);
  lastRequestAt = Date.now();
}

async function requestJson(endpoint, body) {
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    await pace();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0",
        cookie: notionCookie(),
      },
      body: JSON.stringify(body),
    });
    if (response.ok) return response.json();
    const message = await response.text();
    if (
      ![429, 503].includes(response.status) ||
      attempt === retryDelays.length
    ) {
      throw new Error(`Notion HTTP ${response.status}. ${redact(message).slice(0, 180)}`);
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
    if (!block?.type) continue;
    if (!block.id) block.id = id;
    blocks.set(block.id, block);
  }
}

function parentsWithMissingChildren(blocks, fetched, pageId) {
  const owned = subtreeIds(blocks, pageId);
  const ids = [];
  for (const [id, block] of blocks) {
    if (!owned.has(id) || fetched.has(id)) continue;
    if (isMentionOnly(id)) continue;
    if (block.type === "page" && id !== pageId) continue;
    if ((block.content ?? []).some((childId) => !blocks.has(childId))) {
      ids.push(id);
    }
  }
  return ids;
}

async function fillMissingChildren(blocks, pageId, fetched) {
  let queue = parentsWithMissingChildren(blocks, fetched, pageId);
  while (queue.length) {
    const id = queue.shift();
    if (fetched.has(id)) continue;
    fetched.add(id);
    const chunk = await requestChunk(id);
    absorbChunk(blocks, chunk);
    queue = parentsWithMissingChildren(blocks, fetched, pageId);
  }
}

/** 펼친 뒤에 맵에 없는 자식은 그 블록을 직접 받는다. */
async function fetchAbsentSubtreeChildren(blocks, pageId) {
  const owned = subtreeIds(blocks, pageId);
  const missing = [];
  for (const id of owned) {
    const block = blocks.get(id);
    if (!block || isMentionOnly(id)) continue;
    if (block.type === "page" && id !== pageId) continue;
    for (const childId of block.content ?? []) {
      if (!blocks.has(childId) && !missing.includes(childId)) missing.push(childId);
    }
  }
  for (const childId of missing) {
    if (blocks.has(childId)) continue;
    const chunk = await requestChunk(childId);
    absorbChunk(blocks, chunk);
  }
}

/** 빈 동기화 참조의 컨테이너가 없으면 그 블록만 더 받는다. */
async function loadMissingSyncedSources(blocks) {
  const seen = new Set();
  for (;;) {
    const wanted = [];
    for (const block of blocks.values()) {
      if (block.type !== "transclusion_reference") continue;
      if ((block.content ?? []).length) continue;
      const pointerId = pointerIdOf(block);
      if (!pointerId || seen.has(pointerId)) continue;
      const container = blocks.get(pointerId);
      const children = container?.content ?? [];
      if (!container || children.some((childId) => !blocks.has(childId))) {
        wanted.push(pointerId);
      }
    }
    if (!wanted.length) break;
    for (const pointerId of wanted) {
      seen.add(pointerId);
      const chunk = await requestChunk(pointerId);
      absorbChunk(blocks, chunk);
    }
  }
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
  await fillMissingChildren(blocks, pageId, fetched);
  await loadMissingSyncedSources(blocks);
  expandEmptyTransclusions(blocks);
  await fetchAbsentSubtreeChildren(blocks, pageId);
  await fillMissingChildren(blocks, pageId, fetched);
  return blocks;
}

function dataUrlFromBytes(bytes, header, hint = "") {
  const dataUrl = `data:${imageMimeOf(bytes, header, hint)};base64,${Buffer.from(bytes).toString("base64")}`;
  if (!hasNoExpiredUrl(dataUrl)) {
    throw new Error("만료 URL이 이미지 데이터에 남아 있습니다.");
  }
  if (!dataUrl.startsWith("data:image/")) {
    throw new Error("이미지 src가 data URL이 아닙니다.");
  }
  return dataUrl;
}

function notionImageUrl(url, block, withIds) {
  const params = new URLSearchParams();
  params.set("table", "block");
  params.set("id", withIds ? block.id : "");
  params.set("spaceId", withIds ? block.space_id || SPACE_ID : "");
  params.set("width", "2000");
  params.set("cache", "v2");
  return `https://www.notion.so/image/${encodeURIComponent(url)}?${params}`;
}

async function fetchOk(url, headers) {
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    await pace();
    const response = await fetch(url, { headers });
    if (response.ok) return response;
    await response.arrayBuffer().catch(() => {});
    if (![429, 503].includes(response.status) || attempt === retryDelays.length) {
      return response;
    }
    await pause(retryDelays[attempt]);
  }
  throw new Error("이미지 요청 실패.");
}

function signedUrlValue(value) {
  if (typeof value === "string") return value;
  if (value && typeof value.url === "string") return value.url;
  return "";
}

/** 서명 주소는 응답에서만 읽고 data URL 바이트로 바꾼 뒤 버린다. */
async function signedImageDataUrl(block, url) {
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
  const signedUrl = signedUrlValue(signed.signedUrls?.[0]);
  if (!signedUrl) throw new Error(`서명 URL을 받지 못했습니다. ${block.id}`);
  let response;
  try {
    await pace();
    response = await fetch(signedUrl);
  } catch {
    throw new Error(`이미지 다운로드에 실패했습니다. ${block.id}`);
  }
  if (!response.ok) {
    await response.arrayBuffer().catch(() => {});
    throw new Error(`이미지 HTTP ${response.status}. ${block.id}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  return dataUrlFromBytes(bytes, response.headers.get("content-type"), imageNameOf(block));
}

async function imageDataUrl(url, block) {
  const headers = mediaHeaders();
  const hint = imageNameOf(block);
  let lastStatus = 0;
  let sawUnprocessable = false;
  for (const withIds of [false, true]) {
    const response = await fetchOk(notionImageUrl(url, block, withIds), headers);
    lastStatus = response.status;
    if (response.status === 422) sawUnprocessable = true;
    if (!response.ok) continue;
    const bytes = new Uint8Array(await response.arrayBuffer());
    try {
      return dataUrlFromBytes(bytes, response.headers.get("content-type"), hint);
    } catch {
      if (withIds) throw new Error("이미지 MIME을 판별하지 못했습니다.");
    }
  }
  // 비디오가 아닌 이미지는 래퍼가 422이면 서명 바이트만 받는다.
  if (block.type !== "video" && sawUnprocessable) {
    return signedImageDataUrl(block, url);
  }
  throw new Error(`이미지 HTTP ${lastStatus || 0}`);
}

async function resolveMedia(blocks) {
  // 본문 image만 data URL로 저장한다. social_media_image_preview_url은 커버로 넣지 않는다.
  const media = new Map();
  for (const block of blocks.values()) {
    if (block.type !== "image") continue;
    const url = sourceOf(block);
    if (!url) throw new Error(`이미지 URL이 없습니다. ${block.id}`);
    media.set(block.id, await imageDataUrl(url, block));
  }
  return media;
}

/** file과 pdf는 빠뜨리지 않고 거절한다. ZIP data URL도 저장하지 않는다. */
export function assertNoFileOrPdf(blocks) {
  for (const block of blocks.values()) {
    if (block.type !== "file" && block.type !== "pdf") continue;
    throw new Error(`file 또는 pdf 블록은 저장하지 않습니다. ${block.id}`);
  }
}

function assertIntegrity({
  spec,
  page,
  blocks,
  pageTitle,
  markdown,
  stats,
  content,
  todoCount,
}) {
  if (pageTitle !== spec.title) {
    throw new Error(`페이지 제목이 다릅니다. ${pageTitle}`);
  }
  if (!markdown.startsWith(`# ${spec.title}`)) {
    throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
  }
  if (!markdown.includes(spec.sourceUrl)) throw new Error("원문 주소가 없습니다.");
  if (!markdown.includes(spec.hex)) throw new Error("페이지 hex가 없습니다.");
  if ((page.content || []).length !== spec.root) {
    throw new Error(`루트 자식 수가 다릅니다. ${(page.content || []).length}`);
  }
  if (missingChildCount(blocks, spec.pageId) !== 0) {
    throw new Error("빠진 자식 블록이 있습니다.");
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
  const imageSrcs = imageSourcesOf(content);
  if (imageSrcs.length !== spec.images) {
    throw new Error(`본문 이미지 수가 다릅니다. ${imageSrcs.length}`);
  }
  for (const src of imageSrcs) {
    if (!src.startsWith("data:image/")) {
      throw new Error("이미지 src가 data URL이 아닙니다.");
    }
    if (spec.imageMime && !src.startsWith(`data:${spec.imageMime}`)) {
      throw new Error("이미지 MIME이 기대와 다릅니다.");
    }
  }
  if (spec.imageFiles) {
    const names = imageNamesInOrder(blocks, spec.pageId);
    if (names.join("\n") !== spec.imageFiles.join("\n")) {
      throw new Error(`이미지 파일명이 다릅니다. ${names.join(", ")}`);
    }
  }
  if (spec.codesMin != null && stats.codes < spec.codesMin) {
    throw new Error(`TipTap 코드 수가 부족합니다. ${stats.codes}`);
  }
  if (spec.codes != null && stats.codes !== spec.codes) {
    throw new Error(`TipTap 코드 수가 다릅니다. ${stats.codes}`);
  }
  if (spec.tables != null) {
    if (countType(blocks, "table") !== spec.tables) {
      throw new Error(`표 수가 다릅니다. ${countType(blocks, "table")}`);
    }
    if (stats.tables !== spec.tables) {
      throw new Error(`TipTap 표 수가 다릅니다. ${stats.tables}`);
    }
  }
  if (spec.toDo != null && todoCount !== spec.toDo) {
    throw new Error(`할 일 블록 수가 다릅니다. ${todoCount}`);
  }
  if (spec.attachments !== 0) {
    throw new Error("이 이관은 첨부가 없는 페이지만 받습니다.");
  }
  for (const phrase of spec.phrases ?? []) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  const hrefs = (stats.hrefs ?? []).map((href) => stripTracking(href));
  for (const href of [spec.sourceUrl, ...(spec.requiredHrefs ?? [])]) {
    const want = stripTracking(href);
    // 코드 펜스 안 GitHub 주소는 링크 노드가 아니어도 본문에 있으면 통과한다.
    if (!hrefs.includes(want) && !markdown.includes(want)) {
      throw new Error(`링크가 없습니다. ${href}`);
    }
  }
  if (markdown.includes("data:application/zip") || content.includes("data:application/zip")) {
    throw new Error("ZIP을 data URL로 넣었습니다.");
  }
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(content)) {
    throw new Error("만료 URL이 본문에 남아 있습니다.");
  }
  if (SKIPPED_HEXES.includes(spec.hex) || spec.hex === MENTION_ONLY_HEX) {
    throw new Error(`이미 이관했거나 링크로만 남길 페이지입니다. ${spec.hex}`);
  }
  if (markdown.includes("source=copy_link")) {
    throw new Error("source=copy_link가 본문에 남아 있습니다.");
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

function markersOf(spec) {
  return [spec.sourceUrl, spec.pageId, spec.hex];
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
  // 운영 content ilike는 큰 JSON에서 statement timeout이 난다.
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

async function persist(spec, content, extra, libs) {
  const now = new Date().toISOString();
  const sourceUrl = stripTracking(spec.sourceUrl);
  const record = {
    id: randomUUID(),
    title: spec.title,
    content,
    sourceUrl,
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record, markersOf(spec), libs);
  record.id = local.pageId;
  const production = await importProduction(record, libs);
  const pageId = production.pageId || local.pageId;
  return {
    ...extra,
    pageId,
    path: `/pages/${pageId}`,
    local: {
      action: pageAction(local),
      pages: local.pages,
      pageSkips: local.pageSkips,
    },
    production: {
      action: pageAction(production),
      pages: production.pages,
      pageSkips: production.pageSkips,
    },
  };
}

async function importTarget(spec, checkOnly, libs) {
  const loaded = await collectBlocks(spec.pageId);
  expandEmptyTransclusions(loaded);
  if (missingChildCount(loaded, spec.pageId) !== 0) {
    throw new Error(`빠진 자식 블록이 있습니다. ${spec.key}`);
  }
  // 다른 페이지 이미지는 자손을 자른 뒤에야 변환 대상에서 빠진다.
  const blocks = keepSubtree(loaded, spec.pageId);
  assertNoFileOrPdf(blocks);
  const page = getBlock(blocks, spec.pageId);
  if (!page) throw new Error(`Notion 페이지를 찾지 못했습니다. ${spec.key}`);
  const todoCount = countType(blocks, "to_do");
  const media = await resolveMedia(blocks);
  preprocessBlocks(blocks);
  const built = buildMarkdown(
    blocks,
    spec.pageId,
    spec.sourceUrl,
    media,
    new Map()
  );
  const markdown = finalizeMarkdown(built.markdown, spec);
  const pageTitle = storedTitleOf(built.pageTitle);
  const document = restoreDataImages(libs.markdownToTiptapDoc(markdown));
  const content = JSON.stringify(document);
  const stats = documentStats(content);
  assertIntegrity({
    spec,
    page,
    blocks,
    pageTitle,
    markdown,
    stats,
    content,
    todoCount,
  });
  const extra = {
    key: spec.key,
    pageTitle: spec.title,
    codes: stats.codes,
    tables: stats.tables,
    images: stats.images,
    attachments: stats.attachments,
    root: (page.content || []).length,
    todos: todoCount,
  };
  if (checkOnly) return extra;
  return persist(spec, content, extra, libs);
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const libs = loadLibs();
  const results = [];
  for (const target of TARGETS) {
    results.push(await importTarget(target, checkOnly, libs));
  }
  const skippedTargets = TARGETS.filter((item) => SKIPPED_HEXES.includes(item.hex));
  if (skippedTargets.length) {
    throw new Error("스킵 대상이 TARGETS에 있습니다.");
  }
  if (checkOnly) {
    const output = JSON.stringify({ results }, null, 2);
    if (!hasNoExpiredUrl(output)) throw new Error("로그에 만료 URL이 있습니다.");
    console.log(output);
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
  const output = JSON.stringify(summary, null, 2);
  if (!hasNoExpiredUrl(output)) throw new Error("로그에 만료 URL이 있습니다.");
  console.log(output);
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
