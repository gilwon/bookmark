// 비밀 코드 100개·QJC 예약 작업·짐코딩 ELI5를 Pages에만 저장하고 fieldby는 스킵한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import Database from "better-sqlite3";
import TurndownService from "turndown";
import {
  assertDownloadableAttachment,
  buildMarkdown,
  documentStats,
  imageMime,
  plainText,
} from "./import-claude-eli5-page.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const here = dirname(fileURLToPath(import.meta.url));
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const NOTION_ENDPOINT = "https://www.notion.so/api/v3/loadPageChunk";
const SIGNED_FILE_ENDPOINT = "https://www.notion.so/api/v3/getSignedFileUrls";
const retryDelays = [15000, 30000, 60000];
let lastRequestAt = 0;

export const FIELDBY_HEX = "3c5d730b39538128a0b3cd708a04e204";
const SECRET_CODES_ID = "3c969bdb-9038-8174-af89-d583691739f1";
const SECRET_CODES_HEX = SECRET_CODES_ID.replaceAll("-", "");
const SECRET_CODES_SPACE = "ec769bdb-9038-81bf-8cfc-000345b0a624";
const SECRET_CODES_TITLE = "클로드 고수들만 아는 비밀 코드 100개";
const SECRET_CODES_URL =
  "https://app.notion.com/p/100-3c969bdb90388174af89d583691739f1";
const QJC_TITLE = "챗GPT 예약 작업 무료 개방, 오늘 3개까지 걸 수 있습니다";
const QJC_URL = "https://qjc.app/blog/chatgpt-scheduled-tasks-free";
const QJC_ORIGIN = "https://qjc.app";
const GYM_TITLE =
  "Claude Code ELI5 설치 및 사용법: 실무 프롬프트와 커스텀 eli 스킬";
const GYM_URL = "https://www.gymcoding.co/articles/claude-code-eli5-guide";
const GYM_ORIGIN = "https://www.gymcoding.co";
const GYM_OG_URL =
  "https://www.gymcoding.co/articles/claude-code-eli5-guide/opengraph-image-1ya3q7?052be9e71b4cd640";
const FIELDBY_TITLE = "클로드 코드 디자인 플러그인 5개 설치 가이드";
const FIELDBY_URL =
  "https://fieldby.notion.site/5-3c5d730b39538128a0b3cd708a04e204";
const SKIP_IMAGE_RE = /logo\.svg/i;
const EXPIRED_URL_PARTS = [
  "prod-files-secure",
  "X-Amz",
  "file.notion.so",
  "expirationTimestamp",
];
const GYM_FORBIDDEN = [
  "fbclid",
  "동의하고 구독",
  "짐코딩 뉴스레터",
  "인프런",
  "클로드 코드 완벽 마스터",
  "/logo.svg",
];
const QJC_FORBIDDEN = ["fbclid", "mcp_token", "utm_source"];
const QJC_PROMO = [
  "3분 무료 진단",
  "AI 전환 우선순위 진단",
  "우리 회사는 무엇부터 AI로",
  "인기글",
  "댓글을 작성하려면",
  "공유하기",
  "AI 자동화 인사이트",
  "특이점 빌더스",
  "ceo-profile",
  "origin_channel=blog",
];
const GYM_PROMO = [
  "짐코딩 뉴스레터",
  "동의하고 구독",
  "privacy#newsletter",
  "인프런",
  "클로드 코드 완벽 마스터",
  "인프런에서 수강하기",
  "inf.run",
];

export const TARGETS = [
  {
    key: "secret-codes",
    title: SECRET_CODES_TITLE,
    sourceUrl: SECRET_CODES_URL,
    hex: SECRET_CODES_HEX,
    skip: false,
  },
  {
    key: "qjc",
    title: QJC_TITLE,
    sourceUrl: QJC_URL,
    skip: false,
  },
  {
    key: "gymcoding-eli5",
    title: GYM_TITLE,
    sourceUrl: GYM_URL,
    skip: false,
  },
  {
    key: "fieldby",
    title: FIELDBY_TITLE,
    sourceUrl: FIELDBY_URL,
    hex: FIELDBY_HEX,
    skip: true,
  },
];

const faqPath = resolve(here, "import-gymcoding-eli5-faq.json");
const skillPath = resolve(here, "import-gymcoding-eli5-skill.md");
const faqs = JSON.parse(readFileSync(faqPath, "utf8"));
const skillMarkdown = readFileSync(skillPath, "utf8").replace(/\s+$/, "");

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
      if (key.startsWith("utm_") || key === "fbclid" || key === "mcp_token") {
        parsed.searchParams.delete(key);
      }
    }
    if ([...parsed.searchParams.keys()].length === 0) parsed.search = "";
    return parsed.href;
  } catch {
    return url
      .replace(/[?&](?:utm_[^=&#]*|fbclid|mcp_token)=[^&\s)#]*/g, "")
      .replace(/[?&]$/, "")
      .replace(/\?&/, "?");
  }
}

/** 만료 서명 URL 조각이 본문에 없으면 true다. */
export function hasNoExpiredUrl(text) {
  const value = String(text ?? "");
  return EXPIRED_URL_PARTS.every((part) => !value.includes(part));
}

export function isSkipImage(url) {
  if (!url) return true;
  const candidates = [url];
  try {
    candidates.push(decodeURI(url));
  } catch {
    // 잘못된 퍼센트 인코딩은 원문 URL만 검사한다.
  }
  return candidates.some((value) => SKIP_IMAGE_RE.test(value));
}

/** 닫힌 FAQ 헤딩 아래에 답을 넣는다. */
export function fillFaqAnswers(markdown) {
  let text = markdown;
  for (const item of faqs) {
    const heading = `### ${item.q}`;
    const escaped = item.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(### ${escaped})\\n+(?=### |## |$)`);
    if (pattern.test(text)) {
      text = text.replace(pattern, `$1\n\n${item.a}\n\n`);
    } else if (text.includes(heading) && !text.includes(item.a)) {
      text = text.replace(heading, `${heading}\n\n${item.a}`);
    }
  }
  return text;
}

function fillSkillMarkdown(markdown) {
  const heading = "### eli/SKILL.md 전체 코드 보기";
  if (!markdown.includes(heading)) return markdown;
  if (markdown.includes(skillMarkdown)) return markdown;
  const fence = `\`\`\`markdown\n${skillMarkdown}\n\`\`\``;
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(${escaped})\\n+(?=### |## |$)`);
  if (pattern.test(markdown)) {
    return markdown.replace(pattern, `$1\n\n${fence}\n\n`);
  }
  return markdown.replace(heading, `${heading}\n\n${fence}`);
}

function toAbsoluteUrl(url, origin) {
  if (!url) return url;
  if (/^(https?:|data:|mailto:)/i.test(url)) return stripTracking(url);
  try {
    return stripTracking(new URL(url, origin).href);
  } catch {
    return stripTracking(url);
  }
}

function filterPromoBlocks(markdown, needles) {
  return markdown
    .split(/\n{2,}/)
    .filter((block) => !needles.some((needle) => block.includes(needle)))
    .join("\n\n");
}

function cleanWebMarkdown(markdown, origin, extraNeedles = []) {
  let text = markdown
    .replace(/\[(!\[[^\]]*\]\([^)]+\))\]\([^)]+\)/g, "$1")
    .replace(/\]\((\/[^)]+)\)/g, (_, path) => `](${toAbsoluteUrl(path, origin)})`)
    .replace(/https?:\/\/[^\s)]+/g, (url) => stripTracking(url));
  text = filterPromoBlocks(text, extraNeedles);
  text = text.replace(/[?&](?:utm_[^=&#]*|fbclid|mcp_token)=[^&\s)#]*/g, "");
  text = text.replace(/fbclid/g, "");
  text = text.replace(/mcp_token/g, "");
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function createTurndown() {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });
  turndown.addRule("preToFence", {
    filter: "pre",
    replacement(_inner, node) {
      const text = String(node.textContent || "").replace(/\n$/, "");
      return `\n\n\`\`\`\n${text}\n\`\`\`\n\n`;
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
            cells.push(
              $table(cell)
                .text()
                .replace(/\s+/g, " ")
                .replace(/\|/g, "\\|")
                .trim()
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

function loadMarkdownToTiptap() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(
    resolve(root, "src/lib/markdown-to-tiptap.ts")
  );
  return markdownToTiptapDoc;
}

function loadExtractPageMediaReferences() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { extractPageMediaReferences } = require(
    resolve(root, "src/lib/page-attachment-storage.ts")
  );
  return extractPageMediaReferences;
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

function getBlock(blocks, id) {
  if (!blocks || id == null) return null;
  if (typeof blocks.get === "function") return blocks.get(id) ?? null;
  return blocks[id] ?? null;
}

function sourceOf(block) {
  return (
    plainText(block?.properties?.source) ||
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
  const dataUrl = `data:${imageMime(bytes, response.headers.get("content-type"))};base64,${Buffer.from(bytes).toString("base64")}`;
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
          spaceId: block.space_id || SECRET_CODES_SPACE,
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

async function downloadImage(url, referer) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0", referer: referer || url },
  });
  if (!response.ok) throw new Error(`이미지 HTTP ${response.status}: ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const dataUrl = `data:${imageMime(bytes, response.headers.get("content-type"))};base64,${Buffer.from(bytes).toString("base64")}`;
  if (!hasNoExpiredUrl(dataUrl)) {
    throw new Error("만료 URL이 이미지 데이터에 남아 있습니다.");
  }
  return dataUrl;
}

async function tryDownloadImage(url, referer) {
  try {
    return await downloadImage(url, referer);
  } catch {
    return null;
  }
}

function imageSrcOf(image, $) {
  return (
    $(image).attr("src") ||
    $(image).attr("data-src") ||
    $(image).attr("data-lazy-src") ||
    ""
  );
}

function unwrapGymHeadings($, content) {
  content.find("h3[data-accordion-value]").each((_, el) => {
    const question = $(el).attr("data-accordion-value") || $(el).text().trim();
    $(el).replaceWith($("<h3>").text(question));
  });
  content.find("[role='region'][hidden], [role='region'][data-state='closed']").remove();
  content.find("h1, h2, h3, h4, h5, h6").each((_, heading) => {
    const node = $(heading);
    const anchor = node.find("a[href^='#']").first();
    if (!anchor.length) return;
    const text = anchor.text().trim();
    if (!text) return;
    node.empty();
    node.text(text);
  });
}

function removeGymPromo($, content) {
  content.find("script, style, noscript, form, ins, video, button.cpy").remove();
  content.find("a[href*='inf.run'], a[href*='inflearn']").each((_, link) => {
    const wrap = $(link).closest("[data-slot='card']");
    if (wrap.length) wrap.remove();
    else $(link).remove();
  });
  content.find("[data-slot='card']").each((_, el) => {
    const text = $(el).text();
    if (text.includes("짐코딩 뉴스레터")) {
      $(el).remove();
      return;
    }
    if (text.includes("인프런") && text.includes("클로드 코드 완벽 마스터")) {
      $(el).remove();
    }
  });
}

function assertNoForbidden(markdown, content, forbidden) {
  for (const item of forbidden) {
    if (markdown.includes(item) || content.includes(item)) {
      throw new Error(`금지 문구가 남아 있습니다. ${item}`);
    }
  }
}

function assertDataImages(content, minimum) {
  const extractPageMediaReferences = loadExtractPageMediaReferences();
  const media = extractPageMediaReferences(content);
  if (media.imageSources.some((src) => !src.startsWith("data:image/"))) {
    throw new Error("이미지가 data URL이 아닙니다.");
  }
  if (media.imageSources.length < minimum) {
    throw new Error(`본문 이미지가 부족합니다. ${media.imageSources.length}`);
  }
  return media;
}

function findLocalPage(db, title, markers) {
  const byTitle = db
    .prepare(
      "SELECT id, title, content FROM custom_pages WHERE user_id = ? AND title = ?"
    )
    .get(LOCAL_USER, title);
  if (byTitle) return byTitle;
  for (const marker of markers) {
    if (!marker) continue;
    const row = db
      .prepare(
        `SELECT id, title, content FROM custom_pages
         WHERE user_id = ? AND content LIKE ?
         LIMIT 1`
      )
      .get(LOCAL_USER, `%${marker}%`);
    if (row) return row;
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

function skipResult(key, title, extra = {}) {
  return {
    key,
    pageTitle: title,
    skipped: true,
    images: 0,
    attachments: 0,
    local: { pages: 0, pageSkips: 1 },
    production: { pages: 0, pageSkips: 1 },
    ...extra,
  };
}

async function importSecretCodes(markdownToTiptapDoc, checkOnly) {
  const blocks = await collectBlocks(SECRET_CODES_ID);
  const page = getBlock(blocks, SECRET_CODES_ID);
  if (!page) throw new Error("비밀 코드 Notion 페이지를 찾지 못했습니다.");
  const media = await resolveMedia(blocks, page, SECRET_CODES_ID);
  const files = await resolveAttachments(blocks);
  const { pageTitle, markdown } = buildMarkdown(
    blocks,
    SECRET_CODES_ID,
    SECRET_CODES_URL,
    media,
    files
  );
  if (pageTitle !== SECRET_CODES_TITLE) {
    throw new Error(`비밀 코드 제목이 다릅니다. ${pageTitle}`);
  }
  if ((page.content || []).length !== 170) {
    throw new Error(`비밀 코드 루트 자식 수가 170이 아닙니다. ${(page.content || []).length}`);
  }
  if (countType(blocks, "code") !== 50) {
    throw new Error(`비밀 코드 코드 블록이 50이 아닙니다. ${countType(blocks, "code")}`);
  }
  if (countType(blocks, "image") !== 0) {
    throw new Error(`비밀 코드 이미지 블록이 0이 아닙니다. ${countType(blocks, "image")}`);
  }
  if (attachmentCount(blocks) !== 0) {
    throw new Error(`비밀 코드 첨부가 0이 아닙니다. ${attachmentCount(blocks)}`);
  }
  if (countType(blocks, "numbered_list") !== 50) {
    throw new Error(
      `비밀 코드 numbered_list가 50이 아닙니다. ${countType(blocks, "numbered_list")}`
    );
  }
  if (countType(blocks, "callout") !== 1) {
    throw new Error(`비밀 코드 콜아웃이 1이 아닙니다. ${countType(blocks, "callout")}`);
  }
  if (!markdown.includes(SECRET_CODES_URL)) {
    throw new Error("비밀 코드 원문 주소가 없습니다.");
  }
  if (!hasNoExpiredUrl(markdown)) {
    throw new Error("비밀 코드 본문에 만료 URL이 남아 있습니다.");
  }
  const content = JSON.stringify(markdownToTiptapDoc(markdown));
  const stats = documentStats(content);
  if (stats.codes !== 50) {
    throw new Error(`비밀 코드 TipTap 코드가 50이 아닙니다. ${stats.codes}`);
  }
  if (stats.images !== 0) {
    throw new Error(`비밀 코드 TipTap 이미지가 0이 아닙니다. ${stats.images}`);
  }
  if (stats.attachments !== 0) {
    throw new Error(`비밀 코드 TipTap 첨부가 0이 아닙니다. ${stats.attachments}`);
  }
  if (!hasNoExpiredUrl(content)) {
    throw new Error("비밀 코드 저장 본문에 만료 URL이 남아 있습니다.");
  }
  const extra = {
    key: "secret-codes",
    pageTitle,
    codes: stats.codes,
    images: stats.images,
    attachments: stats.attachments,
    numberedLists: countType(blocks, "numbered_list"),
    callouts: stats.callouts,
  };
  if (checkOnly) return extra;
  return persist(pageTitle, content, [SECRET_CODES_URL, SECRET_CODES_ID, SECRET_CODES_HEX], extra);
}

async function importQjc(markdownToTiptapDoc, checkOnly) {
  const response = await fetch(QJC_URL, {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  if (!response.ok) throw new Error(`QJC HTTP ${response.status}`);
  const html = await response.text();
  const $ = cheerio.load(html);
  const content = $("article.blog-content").first();
  if (!content.length) throw new Error("QJC 본문 영역을 찾지 못했습니다.");
  content.find("aside, script, style, noscript, form, button, svg").remove();
  content.find("h2").each((_, el) => {
    if ($(el).text().trim() === QJC_TITLE) $(el).remove();
  });
  content.find("img").each((_, image) => {
    $(image).remove();
  });
  content.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href) return;
    $(link).attr("href", toAbsoluteUrl(href, QJC_ORIGIN));
  });
  content.find("a[href*='ceo-profile']").remove();

  const ogUrl = $('meta[property="og:image"]').attr("content");
  const coverDataUrl = ogUrl
    ? await tryDownloadImage(stripTracking(ogUrl), QJC_URL)
    : null;
  const articleMarkdown = cleanWebMarkdown(
    createTurndown().turndown(content.html() || "").trim(),
    QJC_ORIGIN,
    QJC_PROMO
  );
  const markdown = [
    `# ${QJC_TITLE}`,
    `> 원문. [QJC](${QJC_URL})`,
    coverDataUrl ? `![표지](${coverDataUrl})` : "",
    articleMarkdown,
  ]
    .filter(Boolean)
    .join("\n\n");
  if (!markdown.includes(QJC_URL)) throw new Error("QJC 원문 주소가 없습니다.");
  if (!markdown.includes("동시에 켜 둘 작업 수")) {
    throw new Error("QJC 플랜 표가 없습니다.");
  }
  if (!markdown.includes("예약 작업은 어디서 만드나요")) {
    throw new Error("QJC FAQ가 없습니다.");
  }
  if (!markdown.includes("help.openai.com")) {
    throw new Error("QJC 참고자료 링크가 없습니다.");
  }
  if (markdown.includes("ceo-profile-jung-sangrok.pdf")) {
    throw new Error("QJC CEO PDF가 본문에 들어갔습니다.");
  }
  const pageContent = JSON.stringify(markdownToTiptapDoc(markdown));
  assertNoForbidden(markdown, pageContent, QJC_FORBIDDEN);
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(pageContent)) {
    throw new Error("QJC 본문에 만료 URL이 남아 있습니다.");
  }
  const media = assertDataImages(pageContent, 0);
  if (media.imageSources.length > 1) {
    throw new Error(`QJC 이미지가 표지 1장을 넘습니다. ${media.imageSources.length}`);
  }
  const extra = {
    key: "qjc",
    pageTitle: QJC_TITLE,
    images: media.imageSources.length,
    attachments: 0,
  };
  if (checkOnly) return extra;
  return persist(QJC_TITLE, pageContent, [QJC_URL], extra);
}

async function importGymcoding(markdownToTiptapDoc, checkOnly) {
  const response = await fetch(GYM_URL, {
    headers: { "user-agent": "Mozilla/5.0" },
  });
  if (!response.ok) throw new Error(`짐코딩 HTTP ${response.status}`);
  const $ = cheerio.load(await response.text());
  const content = $("article.py-page-y").first();
  if (!content.length) throw new Error("짐코딩 본문 영역을 찾지 못했습니다.");
  content.find("header h1").remove();
  unwrapGymHeadings($, content);
  removeGymPromo($, content);
  content.find("button, svg").remove();
  content.find("img").each((_, image) => {
    const imageUrl = imageSrcOf(image, $);
    if (!imageUrl || isSkipImage(imageUrl)) {
      $(image).remove();
      return;
    }
    $(image).remove();
  });
  content.find("a[href]").each((_, link) => {
    const href = $(link).attr("href");
    if (!href) return;
    $(link).attr("href", toAbsoluteUrl(href, GYM_ORIGIN));
  });

  const coverDataUrl = await downloadImage(GYM_OG_URL, GYM_URL);
  const articleMarkdown = fillSkillMarkdown(
    fillFaqAnswers(
      cleanWebMarkdown(
        createTurndown().turndown(content.html() || "").trim(),
        GYM_ORIGIN,
        GYM_PROMO
      )
    )
  );
  const markdown = [
    `# ${GYM_TITLE}`,
    `> 원문. [짐코딩](${GYM_URL})`,
    `![표지](${coverDataUrl})`,
    articleMarkdown,
  ].join("\n\n");
  if (!markdown.includes(GYM_URL)) throw new Error("짐코딩 원문 주소가 없습니다.");
  if (!markdown.includes("이런 분을 위한 글입니다")) {
    throw new Error("짐코딩 본문 문구가 없습니다.");
  }
  if (!markdown.includes("claude plugin marketplace add")) {
    throw new Error("짐코딩 설치 명령이 없습니다.");
  }
  if (!markdown.includes(skillMarkdown.split("\n")[1])) {
    throw new Error("짐코딩 SKILL.md가 없습니다.");
  }
  if (!markdown.includes("Claude Code가 설치되어 있는지 확인하고 터미널을 다시 여세요")) {
    throw new Error("짐코딩 FAQ 답이 없습니다.");
  }
  const pageContent = JSON.stringify(markdownToTiptapDoc(markdown));
  assertNoForbidden(markdown, pageContent, GYM_FORBIDDEN);
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(pageContent)) {
    throw new Error("짐코딩 본문에 만료 URL이 남아 있습니다.");
  }
  const media = assertDataImages(pageContent, 1);
  const extra = {
    key: "gymcoding-eli5",
    pageTitle: GYM_TITLE,
    images: media.imageSources.length,
    attachments: 0,
  };
  if (checkOnly) return extra;
  return persist(GYM_TITLE, pageContent, [GYM_URL], extra);
}

function importFieldbySkip(checkOnly) {
  const extra = {
    key: "fieldby",
    pageTitle: FIELDBY_TITLE,
    skipped: true,
    images: 0,
    attachments: 0,
  };
  if (checkOnly) return extra;
  return skipResult("fieldby", FIELDBY_TITLE);
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const markdownToTiptapDoc = loadMarkdownToTiptap();
  const results = [
    await importSecretCodes(markdownToTiptapDoc, checkOnly),
    await importQjc(markdownToTiptapDoc, checkOnly),
    await importGymcoding(markdownToTiptapDoc, checkOnly),
    importFieldbySkip(checkOnly),
  ];
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
