// 공개 Notion 스킬 정리 가이드와 매일 프롬프트 글을 Pages에만 저장한다.
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import {
  assertDownloadableAttachment,
  buildMarkdown,
  documentStats,
  imageMime,
  inlineMarkdown,
  plainText,
} from "./import-claude-eli5-page.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const NOTION_ENDPOINT = "https://www.notion.so/api/v3/loadPageChunk";
const SIGNED_FILE_ENDPOINT = "https://www.notion.so/api/v3/getSignedFileUrls";
const TRACKING_KEY = ["fb", "clid"].join("");
const EXPIRED_URL_PARTS = [
  "prod-files-secure",
  "file.notion.so",
  "expirationTimestamp",
  "X-Amz",
  "blob:",
  TRACKING_KEY,
  "utm_source",
  "utm_medium",
];

export const TARGETS = [
  {
    key: "skill-cleanup",
    title: "[가이드] 공유받은 클로드 스킬 정리 - 안 쓰는 스킬 찾기",
    hex: "4c8e43a1672082e1956f010642073465",
    pageId: "4c8e43a1-6720-82e1-956f-010642073465",
    sourceUrl: "https://app.notion.com/p/4c8e43a1672082e1956f010642073465",
    images: 3,
    attachments: 0,
    tables: 2,
    codes: 1,
    dividers: 3,
    root: 37,
    coverBytes: 100271,
    coverSha256: "bcea1abc69d2be1cac713aa9a44b7171e32ed7477bb421429d7998bd3cff3115",
    imageFiles: ["08_skills_menu.png", "09_skills_search.png"],
    imageBytes: [332949, 387951],
    imageSha256: [
      "6b543ad1dc2aaf1a24a7b73ac0ac4c33b43fd7a8c9ad122812ecfdd0802ab150",
      "b014e04c86dcfbd6bb252cd24bfe092cf3810939a9b5fe3ab1b878bbfc336b62",
    ],
    videoFiles: [],
    videoBytes: [],
    videoSha256: [],
    phrases: ["이럴 때 쓰세요", "클로드에게 후보 찾게 하기", "커넥터는요?"],
    hrefs: [
      "https://app.notion.com/p/4c8e43a1672082e1956f010642073465",
      "https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview",
      "https://www.instagram.com/beucheo.ai",
      "https://open.kakao.com/o/g8oGrusi",
    ],
  },
  {
    key: "daily-prompt",
    title: "매일 발전하는 클로드 프롬프트 두 줄",
    hex: "407fd99f0e5f81b1a0cfed104394aff6",
    pageId: "407fd99f-0e5f-81b1-a0cf-ed104394aff6",
    sourceUrl: "https://app.notion.com/p/407fd99f0e5f81b1a0cfed104394aff6",
    images: 2,
    attachments: 2,
    tables: 2,
    codes: 2,
    dividers: 7,
    root: 57,
    coverBytes: 0,
    coverSha256: "",
    imageFiles: ["xcard.png", "cta.png"],
    imageBytes: [92737, 492239],
    imageSha256: [
      "af4f2fd1fcb1db3515505c4e22ffb5fda1c037a49bdacf0f7f4068cadbb49f17",
      "168c6ac6da26180616df6ae0e4aba70843768c1914ab347663e5fa724bc521e8",
    ],
    videoFiles: ["wm_demo_log.mp4", "wm_demo_daily.mp4"],
    videoBytes: [1278801, 1851839],
    videoSha256: [
      "c9071a8d07c4935fee2492c6f780541dcf1931b6f3096ff2b46d8a23e9974b59",
      "a288f278dae258ea7465782c7bf41ee25870effe309fa1f84ad027eb5595cbaf",
    ],
    phrases: ["원문은 이 두 줄이에요", "STEP 1", "데스크톱 예약 작업 만드는 순서"],
    hrefs: [
      "https://app.notion.com/p/407fd99f0e5f81b1a0cfed104394aff6",
      "https://x.com/kunchenguid/status/2114772499686998221",
      "https://code.claude.com/docs/en/scheduled-tasks",
      "https://code.claude.com/docs/en/desktop-scheduled-tasks",
      "https://code.claude.com/docs/en/routines",
      "https://www.instagram.com/prompt_what",
    ],
  },
];

let lastRequestAt = 0;

function loadEnv() {
  const envPath = resolve(root, ".env.local");
  if (!existsSync(envPath)) return;
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

function dropsXShareQuery(hostname) {
  const host = String(hostname ?? "").toLowerCase();
  return host === "x.com" || host === "twitter.com" || host.endsWith(".x.com") || host.endsWith(".twitter.com");
}

function isTrackingParam(key, value, hostname) {
  return (
    key.startsWith("utm_") ||
    key === TRACKING_KEY ||
    key === "pvs" ||
    key === "igsh" ||
    key === "gclid" ||
    key === "mcp_token" ||
    (key === "source" && value === "copy_link") ||
    (key === "m" && value === "1") ||
    (key === "from" && ["dm", "littly", "guide"].includes(value)) ||
    (key === "s" && dropsXShareQuery(hostname))
  );
}

/** 유입 추적 쿼리를 빼고 http는 https로 바꾼다. localhost는 http로 남긴다. */
export function stripTracking(url, base) {
  if (!url || String(url).startsWith("data:") || String(url).startsWith("mailto:")) return url;
  try {
    const parsed = new URL(url, base);
    if (parsed.hostname === "l.threads.com") {
      const target = parsed.searchParams.get("u");
      if (target) return stripTracking(target, base);
    }
    const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (parsed.protocol === "http:" && !local) parsed.protocol = "https:";
    if (parsed.hostname === "instagram.com" || parsed.hostname === "www.instagram.com") {
      parsed.hostname = "www.instagram.com";
      if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    }
    for (const key of [...parsed.searchParams.keys()]) {
      if (isTrackingParam(key, parsed.searchParams.get(key), parsed.hostname)) {
        parsed.searchParams.delete(key);
      }
    }
    if ([...parsed.searchParams.keys()].length === 0) parsed.search = "";
    return parsed.href;
  } catch {
    return String(url);
  }
}

/** 만료 URL 문자열이 없으면 true다. */
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
  const source = stripTracking(raw).replace(/\/+$/, "");
  return markers.some((marker) => source === stripTracking(marker).replace(/\/+$/, ""));
}

function sourceOf(block) {
  return plainText(block?.properties?.source) || block?.format?.display_source || block?.format?.original_url || "";
}

function fileNameOf(block) {
  const titled = plainText(block?.properties?.title).trim();
  if (titled) return titled;
  const source = sourceOf(block);
  if (source.startsWith("attachment:")) return source.split(":").at(-1)?.trim() || "";
  try {
    return decodeURIComponent(new URL(source).pathname.split("/").filter(Boolean).at(-1) || "");
  } catch {
    return "";
  }
}

function bookmarkHref(block) {
  return plainText(block?.properties?.link) || sourceOf(block) || block?.format?.bookmark_url || "";
}

/** 코드가 든 콜아웃은 펜스 밖으로 꺼내 코드 블록이 살아남게 한다. */
export function unwrapCodeCallouts(blocks, pageId) {
  function visit(id) {
    const block = blocks.get(id);
    if (!block || (block.type === "page" && id !== pageId)) return;
    const next = [];
    for (const childId of block.content ?? []) {
      const child = blocks.get(childId);
      const grands = child?.content ?? [];
      const hasCode = child?.type === "callout" && grands.some((grandId) => blocks.get(grandId)?.type === "code");
      if (!hasCode) {
        next.push(childId);
        visit(childId);
        continue;
      }
      const title = plainText(child.properties?.title).trim();
      child.content = [];
      if (title) {
        child.type = "quote";
        next.push(childId);
      }
      next.push(...grands);
      for (const grandId of grands) visit(grandId);
    }
    block.content = next;
  }
  visit(pageId);
}

/** 북마크를 링크 문단이 되게 제목에 주소를 심는다. */
export function preprocessBlocks(blocks) {
  for (const block of blocks.values()) {
    if (block.type !== "bookmark") continue;
    const href = stripTracking(bookmarkHref(block));
    if (!href) continue;
    const label = plainText(block.properties?.title).trim() || href;
    block.type = "text";
    block.properties = { ...(block.properties || {}), title: [[label, [["a", href]]]] };
  }
}

function stripRichLinks(value) {
  if (!Array.isArray(value)) return;
  for (const fragment of value) {
    if (!Array.isArray(fragment) || !Array.isArray(fragment[1])) continue;
    for (const mark of fragment[1]) {
      if (Array.isArray(mark) && mark[0] === "a" && mark[1]) mark[1] = stripTracking(mark[1]);
    }
  }
}

function stripBlockLinks(blocks) {
  for (const block of blocks.values()) {
    for (const value of Object.values(block.properties || {})) stripRichLinks(value);
  }
}

function blockFromRecord(record) {
  const nested = record?.value?.value;
  if (nested && typeof nested === "object" && nested.type) return nested;
  const value = record?.value;
  if (value && typeof value === "object" && value.type) return value;
  return null;
}

function absorbChunk(blocks, chunk) {
  for (const [id, record] of Object.entries(chunk.recordMap?.block ?? {})) {
    const block = blockFromRecord(record);
    if (!block?.type) continue;
    if (!block.id) block.id = id;
    blocks.set(block.id, block);
  }
}

function subtreeIds(blocks, pageId) {
  const ids = new Set();
  const stack = [pageId];
  while (stack.length) {
    const id = stack.pop();
    if (!id || ids.has(id)) continue;
    const block = blocks.get(id);
    if (!block) continue;
    ids.add(id);
    if (block.type === "page" && id !== pageId) continue;
    for (const childId of block.content ?? []) stack.push(childId);
  }
  return ids;
}

function keepSubtree(blocks, pageId) {
  const owned = subtreeIds(blocks, pageId);
  const kept = new Map();
  for (const [id, block] of blocks) {
    if (owned.has(id)) kept.set(id, block);
  }
  return kept;
}

function missingChildCount(blocks, pageId) {
  let missing = 0;
  for (const [id, block] of blocks) {
    if (block.type === "page" && id !== pageId) continue;
    for (const childId of block.content ?? []) {
      if (!blocks.has(childId)) missing += 1;
    }
  }
  return missing;
}

async function pace() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < 1200) await pause(1200 - elapsed);
  lastRequestAt = Date.now();
}

async function requestJson(endpoint, body) {
  await pace();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "Mozilla/5.0",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Notion HTTP ${response.status}. ${message.replace(/https?:\/\/\S+/g, "[url]").slice(0, 160)}`);
  }
  return response.json();
}

async function requestChunk(id, cursor = { stack: [] }, chunkNumber = 0) {
  return requestJson(NOTION_ENDPOINT, {
    page: { id },
    limit: 100,
    cursor,
    chunkNumber,
    verticalColumns: false,
  });
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
    if (chunkNumber > 20) throw new Error("페이지 청크가 너무 많습니다.");
  } while (cursor.stack?.length);

  const fetched = new Set([pageId]);
  for (let guard = 0; guard < 30; guard += 1) {
    const parents = [];
    for (const block of blocks.values()) {
      if (!block.id || fetched.has(block.id)) continue;
      if (block.type === "page" && block.id !== pageId) continue;
      if ((block.content ?? []).some((childId) => !blocks.has(childId))) parents.push(block.id);
    }
    if (!parents.length) break;
    for (const parentId of parents) {
      fetched.add(parentId);
      absorbChunk(blocks, await requestChunk(parentId));
    }
  }
  const kept = keepSubtree(blocks, pageId);
  if (missingChildCount(kept, pageId) !== 0) throw new Error("빠진 자식 블록이 있습니다.");
  return kept;
}

function notionImageUrl(url, block) {
  const params = new URLSearchParams({
    table: "block",
    id: block.id,
    spaceId: block.space_id || "",
    width: "2000",
    cache: "v2",
  });
  return `https://www.notion.so/image/${encodeURIComponent(url)}?${params}`;
}

async function downloadBytes(url) {
  await pace();
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0", referer: "https://www.notion.so/" } });
  if (!response.ok) {
    await response.arrayBuffer().catch(() => {});
    throw new Error(`파일 HTTP ${response.status}`);
  }
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    header: response.headers.get("content-type"),
  };
}

function dataImageUrl(bytes, header) {
  const mime = imageMime(bytes, header);
  const dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  if (!hasNoExpiredUrl(dataUrl)) throw new Error("만료 URL이 이미지 데이터에 남아 있습니다.");
  return dataUrl;
}

async function signedDownload(block, url) {
  const signed = await requestJson(SIGNED_FILE_ENDPOINT, {
    urls: [
      {
        permissionRecord: { table: "block", id: block.id, spaceId: block.space_id },
        url,
      },
    ],
  });
  const value = signed.signedUrls?.[0];
  const signedUrl = typeof value === "string" ? value : value?.url || "";
  if (!signedUrl) throw new Error(`서명 URL을 받지 못했습니다. ${block.id}`);
  try {
    return await downloadBytes(signedUrl);
  } catch (error) {
    throw new Error(`첨부 다운로드에 실패했습니다. ${block.id}. ${error instanceof Error ? error.message : ""}`);
  }
}

function blocksInOrder(blocks, pageId, type) {
  const found = [];
  function visit(id) {
    const block = blocks.get(id);
    if (!block) return;
    if (block.type === "page" && id !== pageId) return;
    if (block.type === type) found.push(block);
    for (const childId of block.content ?? []) visit(childId);
  }
  visit(pageId);
  return found;
}

async function resolveImages(blocks, pageId) {
  const media = new Map();
  const names = [];
  const sizes = [];
  const hashes = [];
  const page = blocks.get(pageId);
  const coverUrl = page?.format?.page_cover || "";
  if (coverUrl) {
    const downloaded = await downloadBytes(notionImageUrl(coverUrl, page));
    media.set(`${pageId}:cover`, dataImageUrl(downloaded.bytes, downloaded.header));
    names.push("표지");
    sizes.push(downloaded.bytes.length);
    hashes.push(createHash("sha256").update(downloaded.bytes).digest("hex"));
  }
  for (const block of blocksInOrder(blocks, pageId, "image")) {
    const url = sourceOf(block);
    if (!url) throw new Error(`이미지 URL이 없습니다. ${block.id}`);
    const downloaded = await downloadBytes(notionImageUrl(url, block));
    media.set(block.id, dataImageUrl(downloaded.bytes, downloaded.header));
    names.push(fileNameOf(block) || "Notion 이미지");
    sizes.push(downloaded.bytes.length);
    hashes.push(createHash("sha256").update(downloaded.bytes).digest("hex"));
    const caption = inlineMarkdown(block.properties?.caption).trim();
    if (caption.includes("]")) {
      block.properties = { ...(block.properties || {}), caption: [[fileNameOf(block) || "Notion 이미지"]] };
    }
  }
  return { media, names, sizes, hashes };
}

async function resolveVideos(blocks, pageId) {
  const files = new Map();
  const names = [];
  const sizes = [];
  const hashes = [];
  for (const block of blocksInOrder(blocks, pageId, "video")) {
    const url = sourceOf(block);
    const filename = fileNameOf(block) || "video.mp4";
    if (!url) throw new Error(`영상 URL이 없습니다. ${block.id}`);
    const downloaded = await signedDownload(block, url);
    files.set(block.id, assertDownloadableAttachment(filename, downloaded.bytes, downloaded.header));
    block.type = "file";
    names.push(filename);
    sizes.push(downloaded.bytes.length);
    hashes.push(createHash("sha256").update(downloaded.bytes).digest("hex"));
  }
  return { files, names, sizes, hashes };
}

function countNodes(content, type) {
  let count = 0;
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === type) count += 1;
    for (const child of node.content ?? []) visit(child);
  }
  visit(JSON.parse(content));
  return count;
}

function assertIntegrity({ spec, page, markdown, stats, content, images, videos }) {
  if (plainText(page.properties?.title).trim() !== spec.title) {
    throw new Error(`페이지 제목이 다릅니다. ${plainText(page.properties?.title).trim()}`);
  }
  if (!markdown.startsWith(`# ${spec.title}`)) throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
  if (!markdown.includes(spec.sourceUrl)) throw new Error("원문 주소가 없습니다.");
  if ((page.content || []).length !== spec.root) {
    throw new Error(`루트 자식 수가 다릅니다. ${(page.content || []).length}`);
  }
  if (images.names.slice(spec.coverBytes ? 1 : 0).join("\n") !== spec.imageFiles.join("\n")) {
    throw new Error(`이미지 파일명이 다릅니다. ${images.names.join(", ")}`);
  }
  if (images.sizes.join(",") !== [spec.coverBytes, ...spec.imageBytes].filter((size) => size).join(",")) {
    throw new Error(`이미지 바이트가 다릅니다. ${images.sizes.join(",")}`);
  }
  if (images.hashes.join(",") !== [spec.coverSha256, ...spec.imageSha256].filter(Boolean).join(",")) {
    throw new Error("이미지 해시가 다릅니다.");
  }
  if (videos.names.join("\n") !== spec.videoFiles.join("\n")) {
    throw new Error(`영상 파일명이 다릅니다. ${videos.names.join(", ")}`);
  }
  if (videos.sizes.join(",") !== spec.videoBytes.join(",")) {
    throw new Error(`영상 바이트가 다릅니다. ${videos.sizes.join(",")}`);
  }
  if (videos.hashes.join(",") !== spec.videoSha256.join(",")) throw new Error("영상 해시가 다릅니다.");
  if (stats.images !== spec.images) throw new Error(`TipTap 이미지 수가 다릅니다. ${stats.images}`);
  if (stats.attachments !== spec.attachments) throw new Error(`TipTap 첨부 수가 다릅니다. ${stats.attachments}`);
  if (stats.tables !== spec.tables) throw new Error(`TipTap 표 수가 다릅니다. ${stats.tables}`);
  if (stats.codes !== spec.codes) throw new Error(`TipTap 코드 수가 다릅니다. ${stats.codes}`);
  if (countNodes(content, "horizontalRule") !== spec.dividers) {
    throw new Error(`구분선 수가 다릅니다. ${countNodes(content, "horizontalRule")}`);
  }
  const hrefs = new Set(stats.hrefs.map((href) => stripTracking(href).replace(/\/+$/, "")));
  for (const href of spec.hrefs) {
    if (!hrefs.has(href.replace(/\/+$/, ""))) throw new Error(`링크가 없습니다. ${href}`);
  }
  for (const phrase of spec.phrases) {
    if (!content.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(content)) throw new Error("만료 URL이 본문에 남아 있습니다.");
  if (content.includes("pvs=") || content.includes("from=dm")) throw new Error("추적 쿼리가 본문에 남아 있습니다.");
}

function loadLibs() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(resolve(root, "src/lib/markdown-to-tiptap.ts"));
  const { preparePageFindability, isMissingPageFindabilityColumn } = require(
    resolve(root, "src/lib/page-findability.ts"),
  );
  return { markdownToTiptapDoc, preparePageFindability, isMissingPageFindabilityColumn };
}

function sqliteHasFindability(db) {
  const cols = db.prepare("PRAGMA table_info(custom_pages)").all().map((column) => column.name);
  return ["tags", "source_url", "search_text", "is_favorite"].every((name) => cols.includes(name));
}

function pageColumns(db) {
  return db.prepare("PRAGMA table_info(custom_pages)").all().map((column) => column.name);
}

function findLocalPage(db, spec) {
  const cols = pageColumns(db);
  const fields = ["id", "title"];
  if (cols.includes("source_url")) fields.push("source_url");
  const select = fields.join(", ");
  const byTitle = db
    .prepare(`SELECT ${select} FROM custom_pages WHERE user_id = ? AND title = ?`)
    .get(LOCAL_USER, spec.title);
  if (isDuplicateRow(byTitle, spec.title, [spec.sourceUrl])) return byTitle;
  if (!cols.includes("source_url")) return null;
  const bySource = db
    .prepare(`SELECT ${select} FROM custom_pages WHERE user_id = ? AND source_url = ? LIMIT 1`)
    .get(LOCAL_USER, spec.sourceUrl);
  if (isDuplicateRow(bySource, spec.title, [spec.sourceUrl])) return bySource;
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

function importLocal(page, libs) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  const existing = findLocalPage(db, page);
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
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    ).run(
      page.id,
      LOCAL_USER,
      page.title,
      page.content,
      found.tags,
      found.sourceUrl,
      found.searchText,
      page.created_at,
      page.updated_at,
    );
  } else {
    db.prepare(
      `INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
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

async function findProductionPage(supabase, spec) {
  const byTitle = await supabase
    .from("custom_pages")
    .select("id, title, source_url")
    .eq("user_id", PROD_USER)
    .eq("title", spec.title)
    .limit(1);
  if (byTitle.error) throw byTitle.error;
  if (isDuplicateRow(byTitle.data?.[0], spec.title, [spec.sourceUrl])) return byTitle.data[0];
  const bySource = await supabase
    .from("custom_pages")
    .select("id, title, source_url")
    .eq("user_id", PROD_USER)
    .eq("source_url", spec.sourceUrl)
    .limit(1);
  if (bySource.error) throw bySource.error;
  if (isDuplicateRow(bySource.data?.[0], spec.title, [spec.sourceUrl])) return bySource.data[0];
  return null;
}

async function importProduction(page, libs) {
  const supabase = createSupabase();
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  const existing = await findProductionPage(supabase, page);
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

async function savedOnBothSides(spec) {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  let local = null;
  try {
    local = findLocalPage(db, spec);
  } finally {
    db.close();
  }
  const production = await findProductionPage(createSupabase(), spec);
  if (!local && !production) return null;
  if (!local || !production) throw new Error(`로컬과 운영 중 한쪽에만 글이 있습니다. ${spec.sourceUrl}`);
  if (local.id !== production.id) throw new Error(`로컬과 운영의 페이지 id가 다릅니다. ${spec.sourceUrl}`);
  return {
    key: spec.key,
    pageTitle: spec.title,
    pageId: local.id,
    path: `/pages/${local.id}`,
    local: { action: "skip", pages: 0, pageSkips: 1 },
    production: { action: "skip", pages: 0, pageSkips: 1 },
  };
}

async function persist(spec, content, extra, libs) {
  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    title: spec.title,
    content,
    sourceUrl: spec.sourceUrl,
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
    local: { action: local.pages ? "insert" : "skip", pages: local.pages, pageSkips: local.pageSkips },
    production: {
      action: production.pages ? "insert" : "skip",
      pages: production.pages,
      pageSkips: production.pageSkips,
    },
  };
}

async function buildImportedPage(spec, libs) {
  const blocks = await collectBlocks(spec.pageId);
  preprocessBlocks(blocks);
  stripBlockLinks(blocks);
  const images = await resolveImages(blocks, spec.pageId);
  const videos = await resolveVideos(blocks, spec.pageId);
  unwrapCodeCallouts(blocks, spec.pageId);
  const built = buildMarkdown(blocks, spec.pageId, spec.sourceUrl, images.media, videos.files);
  const markdown = built.markdown;
  const content = JSON.stringify(libs.markdownToTiptapDoc(markdown));
  const stats = documentStats(content);
  assertIntegrity({ spec, page: blocks.get(spec.pageId), markdown, stats, content, images, videos });
  return {
    key: spec.key,
    pageTitle: spec.title,
    sourceUrl: spec.sourceUrl,
    images: stats.images,
    attachments: stats.attachments,
    tables: stats.tables,
    codes: stats.codes,
    links: stats.links,
    dividers: countNodes(content, "horizontalRule"),
    length: content.length,
    hash: createHash("sha256").update(content).digest("hex"),
    content,
  };
}

function emit(value) {
  const output = JSON.stringify(value, null, 2);
  if (output.includes("data:")) throw new Error("로그에 data URL이 있습니다.");
  if (!hasNoExpiredUrl(output)) throw new Error("로그에 만료 URL이 있습니다.");
  console.log(output);
}

async function main() {
  loadEnv();
  const checkOnly = process.argv.includes("--check");
  const libs = loadLibs();
  const results = [];
  for (const spec of TARGETS) {
    if (!checkOnly) {
      const saved = await savedOnBothSides(spec);
      if (saved) {
        results.push(saved);
        continue;
      }
    }
    const built = await buildImportedPage(spec, libs);
    const { content, ...extra } = built;
    if (checkOnly) {
      results.push(extra);
      continue;
    }
    results.push(await persist(spec, content, extra, libs));
  }
  emit({ pages: results });
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) await main();
