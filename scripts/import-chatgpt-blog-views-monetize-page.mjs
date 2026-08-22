// 공개 Notion 「ChatGPT로 블로그 조회수부터 수익화까지」를 Pages에만 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_URL =
  "https://halved-stretch-7af.notion.site/ChatGPT-3c29770df064808a9dc0f03edf9834f3";
const NOTION_PAGE_ID = "3c29770d-f064-808a-9dc0-f03edf9834f3";
const NOTION_PAGE_HEX = NOTION_PAGE_ID.replaceAll("-", "");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const ENDPOINT = "https://www.notion.so/api/v3/loadPageChunk";
const EXPECTED_TITLE = "ChatGPT로 블로그 조회수부터 수익화까지 🚀";
const EXPECTED_ROOT_CHILDREN = 157;
const EXPECTED_BLOCKS = 159;
const EXPECTED_TYPES = {
  page: 1,
  text: 79,
  bulleted_list: 33,
  sub_sub_header: 15,
  divider: 10,
  header: 9,
  numbered_list: 7,
  header_4: 2,
  sub_header: 2,
  quote: 1,
};
const REQUIRED_HEADERS = [
  "1. 조회수 나올 블로그 글감 10개 뽑기",
  "2. 블로그 글 초안 쓰기",
  "3. ChatGPT로 블로그 운영 자동화하기",
  "4. 검색 유입 늘리는 글로 최적화하기",
  "5. 클릭하게 만드는 도입부 만들기",
  "6. 30일 블로그 성장 전략 만들기",
  "7. 블로그 글 하나를 여러 콘텐츠로 재활용하기",
];
const REQUIRED_HREFS = [
  "https://blog.naver.com/rldnjsrldnjs",
  "https://www.threads.com/@marketer_c_?hl=ko",
  "https://open.kakao.com/o/gnqrEJWd",
  "https://open.kakao.com/o/g87MMjIg",
  "https://blog.naver.com/rldnjsrldnjs/",
  "https://www.threads.com/@marketer_c_",
  "https://pf.kakao.com/_bASts/chat",
  "https://www.brandedge.co.kr/qna",
  SOURCE_URL,
];
const FORBIDDEN_TYPES = new Set(["image", "table", "code"]);
const HEADING_PREFIX = {
  header: "##",
  header_1: "##",
  sub_header: "###",
  sub_sub_header: "####",
  header_4: "#####",
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
      // 링크에 볼드를 먼저 씌우면 TipTap이 `**url**`을 링크 문구로 남긴다.
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

function asMarkdownLine(title) {
  // 원문의 깨진 `*[주제]**`만 코드로 감싼다. `**[주제]**`는 볼드로 둔다.
  if (title.startsWith("*[주제]**")) return `\`${title.replaceAll("`", "")}\``;
  return title;
}

function titleOf(block) {
  return inlineMarkdown(block?.properties?.title).trim();
}

function blockFromRecord(record) {
  const nested = record?.value?.value;
  if (nested && typeof nested === "object" && nested.type) return nested;
  const value = record?.value;
  if (value && typeof value === "object" && value.type) return value;
  return null;
}

export function renderBlock(block, blocks, path = new Set()) {
  if (!block) return "";
  const id = block.id;
  if (id && path.has(id)) return "";
  const nextPath = id ? new Set(path).add(id) : new Set(path);
  const type = block.type;
  if (FORBIDDEN_TYPES.has(type)) {
    throw new Error(`허용하지 않는 블록 타입. ${type}`);
  }
  const title = titleOf(block);
  const childMarkdown = (block.content ?? [])
    .map((childId) => renderBlock(getBlock(blocks, childId), blocks, nextPath))
    .filter(Boolean);

  if (type === "page") return childMarkdown.join("\n\n");
  if (type === "divider") return "---";
  if (type === "quote") {
    const lines = [`> ${title}`];
    for (const part of childMarkdown) {
      for (const line of part.split("\n")) {
        if (!line.trim()) continue;
        lines.push(line.startsWith(">") ? line : `> ${line}`);
      }
    }
    return lines.join("\n");
  }
  if (type === "bulleted_list" || type === "bulleted_list_item") {
    return [`- ${asMarkdownLine(title)}`, ...childMarkdown]
      .filter(Boolean)
      .join("\n");
  }
  if (type === "numbered_list" || type === "numbered_list_item") {
    return [`1. ${asMarkdownLine(title)}`, ...childMarkdown]
      .filter(Boolean)
      .join("\n");
  }
  if (HEADING_PREFIX[type]) {
    return [`${HEADING_PREFIX[type]} ${title}`, ...childMarkdown]
      .filter(Boolean)
      .join("\n\n");
  }
  if (type === "text") {
    if (!title) return childMarkdown.join("\n\n");
    return [asMarkdownLine(title), ...childMarkdown]
      .filter(Boolean)
      .join("\n\n");
  }
  return [title, ...childMarkdown].filter(Boolean).join("\n\n");
}

export function buildMarkdown(blocks, pageId, sourceUrl) {
  const page = getBlock(blocks, pageId);
  const pageTitle = plainText(page?.properties?.title).trim();
  const body = (page?.content ?? [])
    .map((id) => renderBlock(getBlock(blocks, id), blocks, new Set([pageId])))
    .filter(Boolean)
    .join("\n\n");
  const markdown = [`# ${pageTitle}`, `> 원문. [Notion](${sourceUrl})`, body]
    .filter(Boolean)
    .join("\n\n");
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

function typeCounts(blocks) {
  const counts = {};
  for (const block of blocks.values()) {
    counts[block.type] = (counts[block.type] || 0) + 1;
  }
  return counts;
}

async function requestChunk(cursor, chunkNumber) {
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < 1000) await pause(1000 - elapsed);
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0",
      },
      body: JSON.stringify({
        pageId: NOTION_PAGE_ID,
        limit: 100,
        cursor,
        chunkNumber,
        verticalColumns: false,
      }),
    });
    lastRequestAt = Date.now();
    if (response.ok) return response.json();
    const body = await response.text();
    if (![429, 503].includes(response.status) || attempt === retryDelays.length) {
      throw new Error(`Notion HTTP ${response.status}. ${body.slice(0, 300)}`);
    }
    await pause(retryDelays[attempt]);
  }
  throw new Error("Notion 요청 실패.");
}

async function collectBlocks() {
  const blocks = new Map();
  let cursor = { stack: [] };
  let chunkNumber = 0;
  // limit 100은 루트 자식을 자르므로 cursor.stack이 빌 때까지 이어 받는다.
  do {
    const chunk = await requestChunk(cursor, chunkNumber);
    for (const [id, record] of Object.entries(chunk.recordMap?.block ?? {})) {
      const block = blockFromRecord(record);
      if (block?.type) blocks.set(id, block);
    }
    cursor = chunk.cursor ?? { stack: [] };
    chunkNumber += 1;
  } while (cursor.stack?.length);

  const missing = [...blocks.values()]
    .flatMap((block) => block.content ?? [])
    .filter((id) => !blocks.has(id));
  if (missing.length) {
    throw new Error(`Notion 블록 수집 누락. ${[...new Set(missing)].join(", ")}`);
  }
  for (const block of blocks.values()) {
    if (FORBIDDEN_TYPES.has(block.type)) {
      throw new Error(`허용하지 않는 블록 타입. ${block.type}`);
    }
  }
  return blocks;
}

function assertTypeCounts(counts) {
  const extra = Object.keys(counts).filter((type) => EXPECTED_TYPES[type] == null);
  if (extra.length) throw new Error(`예상 밖 블록 타입. ${extra.join(", ")}`);
  for (const [type, expected] of Object.entries(EXPECTED_TYPES)) {
    if (counts[type] !== expected) {
      throw new Error(`블록 타입 수가 다릅니다. ${type}=${counts[type] ?? 0}`);
    }
  }
}

function assertIntegrity({ page, blocks, pageTitle, markdown, stats }) {
  if (pageTitle !== EXPECTED_TITLE) {
    throw new Error(`페이지 제목이 다릅니다. ${pageTitle}`);
  }
  if ((page.content || []).length !== EXPECTED_ROOT_CHILDREN) {
    throw new Error(`루트 자식 수가 157이 아닙니다. ${(page.content || []).length}`);
  }
  if (blocks.size !== EXPECTED_BLOCKS) {
    throw new Error(`블록 수가 159가 아닙니다. ${blocks.size}`);
  }
  assertTypeCounts(typeCounts(blocks));
  if (!markdown.includes(SOURCE_URL)) throw new Error("원문 주소가 없습니다.");
  for (const header of REQUIRED_HEADERS) {
    if (!markdown.includes(header)) throw new Error(`헤더가 없습니다. ${header}`);
  }
  if (!markdown.includes("복사해서 바로 쓰는 실전 프롬프트 7가지")) {
    throw new Error("실전 프롬프트 제목이 없습니다.");
  }
  if (stats.images !== 0 || stats.tables !== 0) {
    throw new Error(`이미지/표가 있습니다. images=${stats.images} tables=${stats.tables}`);
  }
  for (const href of REQUIRED_HREFS) {
    if (!stats.hrefs.includes(href)) throw new Error(`링크가 없습니다. ${href}`);
  }
}

function loadMarkdownToTiptap() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  // 테스트에서 헬퍼만 import할 때는 이 함수를 호출하지 않는다.
  const { markdownToTiptapDoc } = require(
    resolve(root, "src/lib/markdown-to-tiptap.ts")
  );
  return markdownToTiptapDoc;
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
      `UPDATE custom_pages SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?`
    ).run(page.content, page.updated_at, existing.id, LOCAL_USER);
    result.pageUpdates += 1;
    result.pageId = existing.id;
  } else {
    db.prepare(
      `INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(page.id, LOCAL_USER, page.title, page.content, page.created_at, page.updated_at);
    result.pages += 1;
  }
  db.close();
  return result;
}

async function findProductionPage(supabase, title) {
  const { data, error } = await supabase
    .from("custom_pages")
    .select("id, title, content")
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
  if (existing && existing.content === page.content) {
    result.pageSkips += 1;
    result.pageId = existing.id;
    return result;
  }
  if (existing) {
    const { error } = await supabase
      .from("custom_pages")
      .update({ content: page.content, updated_at: page.updated_at })
      .eq("id", existing.id)
      .eq("user_id", PROD_USER);
    if (error) throw error;
    result.pageUpdates += 1;
    result.pageId = existing.id;
    return result;
  }
  const { error } = await supabase.from("custom_pages").insert({
    id: page.id,
    user_id: PROD_USER,
    title: page.title,
    content: page.content,
    created_at: page.created_at,
    updated_at: page.updated_at,
  });
  if (error) throw error;
  result.pages += 1;
  return result;
}

async function main() {
  const blocks = await collectBlocks();
  const page = getBlock(blocks, NOTION_PAGE_ID);
  if (!page) throw new Error("Notion 페이지를 찾지 못했습니다.");
  const { pageTitle, markdown } = buildMarkdown(blocks, NOTION_PAGE_ID, SOURCE_URL);
  const markdownToTiptapDoc = loadMarkdownToTiptap();
  const content = JSON.stringify(markdownToTiptapDoc(markdown));
  const stats = documentStats(content);
  assertIntegrity({ page, blocks, pageTitle, markdown, stats });

  if (process.argv.includes("--check")) {
    console.log({
      pageTitle,
      blocks: blocks.size,
      rootChildren: (page.content || []).length,
      markdownLength: markdown.length,
      images: stats.images,
      tables: stats.tables,
      links: stats.links,
      hrefs: stats.hrefs,
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
