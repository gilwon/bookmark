// BRANDBUILDER 바이브 코딩 프롬프트 7개를 Pages에만 저장한다
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

export const SOURCE_URL =
  "https://brandbuilder-vibe-prompts.brandbuilder-bb.chatgpt.site/";
export const PAGE_TITLE = "BRANDBUILDER · 바이브 코딩 프롬프트";
export const EXPECTED_IMAGES = 0;
export const EXPECTED_ATTACHMENTS = 0;
export const EXPECTED_CODES = 7;
export const PROMPT_IDS = [
  "prd",
  "design",
  "security",
  "debug",
  "test",
  "refactor",
  "skill",
];
export const REQUIRED_HREFS = [
  SOURCE_URL,
  ...PROMPT_IDS.map((id) => promptHref(id)),
];
export const REQUIRED_PHRASES = [
  SOURCE_URL,
  "전체 PRD 작성하기",
  "Playwright",
  "07번은 없습니다",
  "작업을 Skill로 만들기",
  "data-testid",
  "시니어 프로젝트 매니저야",
];

const PROMPTS_JSON_URL = new URL("prompts.json", SOURCE_URL).href;
const DEFAULT_INTRO = [
  "기획부터 자산화까지, 바로 쓰는 7가지 실무 프롬프트.",
  "첨부 카드뉴스의 프롬프트를 텍스트로 옮겼습니다. 원본 번호를 유지하여 07번은 없습니다.",
  "-by Brandbuilder-",
];
const EXPIRED_URL_PARTS = [
  "prod-files-secure",
  "file.notion.so",
  "expirationTimestamp",
  "X-Amz",
  "blob:",
  "fbclid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
];
const COPY_UI_RE = /^\s*복사(?:됨!)?\s*$/m;

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

function isTrackingParam(key, value) {
  return (
    key.startsWith("utm_") ||
    key === "fbclid" ||
    key === "pvs" ||
    key === "igsh" ||
    key === "mcp_token" ||
    (key === "source" && value === "copy_link") ||
    (key === "m" && value === "1")
  );
}

/** 유입 추적 쿼리를 빼고 절대 주소로 바꾼다. */
export function stripTracking(url, base) {
  if (!url || String(url).startsWith("data:") || String(url).startsWith("mailto:")) {
    return url;
  }
  try {
    const parsed = new URL(url, base);
    for (const key of [...parsed.searchParams.keys()]) {
      const value = parsed.searchParams.get(key);
      if (isTrackingParam(key, value)) parsed.searchParams.delete(key);
    }
    if ([...parsed.searchParams.keys()].length === 0) parsed.search = "";
    return parsed.href;
  } catch {
    return String(url)
      .replace(/[?&](?:utm_[^=&#]*|fbclid|pvs|igsh|mcp_token)=[^&\s)#]*/g, "")
      .replace(/[?&]source=copy_link/g, "")
      .replace(/[?&]m=1(?=[&#]|$)/g, "")
      .replace(/[?&]$/, "")
      .replace(/\?&/, "?");
  }
}

function promptHref(id) {
  const parsed = new URL(SOURCE_URL);
  parsed.hash = String(id ?? "");
  return stripTracking(parsed.href);
}

/** 만료 URL 문자열이 본문에 없으면 true다. */
export function hasNoExpiredUrl(text) {
  const value = String(text ?? "");
  return EXPIRED_URL_PARTS.every((part) => !value.includes(part));
}

/** 제목 또는 원문 식별자가 있으면 중복이다. */
export function isDuplicateRow(row, title, markers) {
  if (!row) return false;
  if (row.title === title) return true;
  const hay = `${row.source_url ?? ""}\n${row.content ?? ""}`;
  return markers.some((marker) => marker && hay.includes(marker));
}

function stripTags(html) {
  return String(html ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function introLines(introHtml) {
  if (introHtml == null || introHtml === "") return [...DEFAULT_INTRO];
  const text = stripTags(introHtml);
  const fromHtml = DEFAULT_INTRO.filter((phrase) => text.includes(phrase));
  return fromHtml.length ? fromHtml : [...DEFAULT_INTRO];
}

function cardMarkdown(prompt) {
  const href = promptHref(prompt.id);
  const lead = [prompt.tag, prompt.hint].filter(Boolean).join(". ");
  return [
    `## ${prompt.n} ${prompt.title}`,
    "",
    lead,
    "",
    `[이 프롬프트 링크](${href})`,
    "",
    "```text",
    String(prompt.text ?? ""),
    "```",
  ].join("\n");
}

/** 프롬프트 카드와 소개 문구를 저장용 마크다운으로 묶는다. */
export function buildMarkdown(prompts, introHtml) {
  const cards = (Array.isArray(prompts) ? prompts : []).map(cardMarkdown);
  const markdown = [
    `# ${PAGE_TITLE}`,
    `> 원문. [BRANDBUILDER](${SOURCE_URL})`,
    ...introLines(introHtml),
    ...cards,
  ]
    .filter(Boolean)
    .join("\n\n")
    .replace(/https?:\/\/[^\s)]+/g, (url) => stripTracking(url))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return markdown;
}

function documentStats(tiptapJsonString) {
  const stats = { images: 0, attachments: 0, codes: 0, hrefs: [] };
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "image") stats.images += 1;
    if (node.type === "codeBlock") stats.codes += 1;
    for (const mark of node.marks ?? []) {
      if (mark?.type === "link" && mark.attrs?.href) {
        const href = String(mark.attrs.href);
        stats.hrefs.push(href);
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

function looksLikeHtml(text) {
  const trimmed = String(text ?? "").trim();
  return (
    trimmed.startsWith("<") ||
    /^<!doctype\s+html/i.test(trimmed) ||
    /<html[\s>]/i.test(trimmed)
  );
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0",
    },
  });
  if (!response.ok) throw new Error(`원문 HTTP ${response.status}`);
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html") || looksLikeHtml(text)) {
    throw new Error("JSON이 아니라 HTML 셸입니다.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("JSON이 아닙니다.");
  }
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html",
      "user-agent": "Mozilla/5.0",
    },
  });
  if (!response.ok) throw new Error(`원문 HTTP ${response.status}`);
  return response.text();
}

function assertPromptList(prompts) {
  if (!Array.isArray(prompts)) {
    throw new Error("prompts.json이 배열이 아닙니다.");
  }
  if (prompts.length !== 7) {
    throw new Error(`프롬프트가 7개가 아닙니다. ${prompts.length}`);
  }
  const ids = prompts.map((item) => item?.id);
  if (ids.join(",") !== PROMPT_IDS.join(",")) {
    throw new Error(`프롬프트 id가 다릅니다. ${ids.join(",")}`);
  }
  const numbers = prompts.map((item) => item?.n);
  if (numbers.join(",") !== "01,02,03,04,05,06,08") {
    throw new Error(`프롬프트 번호가 다릅니다. ${numbers.join(",")}`);
  }
}

function assertIntegrity({ markdown, stats, content }) {
  if (!markdown.startsWith(`# ${PAGE_TITLE}`)) {
    throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
  }
  if (!markdown.includes(`> 원문. [BRANDBUILDER](${SOURCE_URL})`)) {
    throw new Error("원문 인용이 없습니다.");
  }
  for (const phrase of REQUIRED_PHRASES) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  for (const href of REQUIRED_HREFS) {
    if (!markdown.includes(href)) throw new Error(`링크가 없습니다. ${href}`);
  }
  if (stats.images !== EXPECTED_IMAGES) {
    throw new Error(`TipTap 이미지 수가 다릅니다. ${stats.images}`);
  }
  if (stats.attachments !== EXPECTED_ATTACHMENTS) {
    throw new Error(`TipTap 첨부 수가 다릅니다. ${stats.attachments}`);
  }
  if (stats.codes !== EXPECTED_CODES) {
    throw new Error(`TipTap 코드 블록 수가 다릅니다. ${stats.codes}`);
  }
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(content)) {
    throw new Error("만료 URL이 본문에 남아 있습니다.");
  }
  if (COPY_UI_RE.test(markdown)) {
    throw new Error("복사 버튼 문구가 남아 있습니다.");
  }
  if (markdown.includes("링크 공유") || markdown.includes("전체 프롬프트 복사")) {
    throw new Error("공유·복사 버튼 문구가 남아 있습니다.");
  }
  if (markdown.includes("<dialog") || markdown.includes('id="toast"')) {
    throw new Error("dialog·toast가 남아 있습니다.");
  }
  if (markdown.includes("__CF$cv$params") || markdown.includes("cdn-cgi")) {
    throw new Error("Cloudflare 스크립트가 남아 있습니다.");
  }
  if (markdown.includes("data:image/svg+xml")) {
    throw new Error("favicon data URL이 본문에 있습니다.");
  }
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

function markersOf() {
  return [SOURCE_URL];
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
  for (const marker of markers) {
    if (!marker) continue;
    const row = db
      .prepare(
        `SELECT ${select} FROM custom_pages
         WHERE user_id = ? AND content LIKE ?
         LIMIT 1`
      )
      .get(LOCAL_USER, `%${marker}%`);
    if (isDuplicateRow(row, title, markers)) return row;
  }
  return null;
}

function findabilityOf(libs, page) {
  const found = libs.preparePageFindability({
    title: page.title,
    content: page.content,
    existingSourceUrl: SOURCE_URL,
  });
  return {
    tags: JSON.stringify(found.tags ?? []),
    sourceUrl: found.sourceUrl || SOURCE_URL,
    searchText: found.searchText ?? "",
  };
}

function importLocal(page, markers, libs) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pages: 0, pageUpdates: 0, pageSkips: 0, pageId: page.id };
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

function isTimeoutError(error) {
  const message = String(error?.message ?? error ?? "");
  const code = String(error?.code ?? error?.cause?.code ?? "");
  return /timeout|57014|canceling statement/i.test(`${message} ${code}`);
}

async function findProductionPage(supabase, title, sourceUrl) {
  // 운영 content ilike는 큰 JSON에서 57014 statement timeout이 난다.
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

function isMissingFindability(error, libs) {
  const message = String(error?.message ?? error ?? "");
  return (
    libs.isMissingPageFindabilityColumn(message) ||
    /(tags|source_url|search_text|is_favorite)/i.test(message)
  );
}

async function insertViaKodakStub(supabase, full, withFindability) {
  // 대용량 본문은 직접 INSERT하면 statement timeout이 나서 짧은 행을 만든 뒤 갱신한다.
  const stub = JSON.stringify({ type: "doc", content: [] });
  const stubRow = withFindability
    ? { ...full, content: stub }
    : {
        id: full.id,
        user_id: full.user_id,
        title: full.title,
        content: stub,
        created_at: full.created_at,
        updated_at: full.updated_at,
      };
  const { error: insertError } = await supabase.from("custom_pages").insert(stubRow);
  if (insertError) throw insertError;
  const { error: fillError } = await supabase
    .from("custom_pages")
    .update({ content: full.content, updated_at: full.updated_at })
    .eq("id", full.id)
    .eq("user_id", full.user_id);
  if (fillError) throw fillError;
}

async function insertProductionRow(supabase, full, libs) {
  const { error: insertError } = await supabase.from("custom_pages").insert(full);
  if (!insertError) return;
  if (isMissingFindability(insertError, libs)) {
    const slim = {
      id: full.id,
      user_id: full.user_id,
      title: full.title,
      content: full.content,
      created_at: full.created_at,
      updated_at: full.updated_at,
    };
    const { error: retryError } = await supabase.from("custom_pages").insert(slim);
    if (!retryError) return;
    if (isTimeoutError(retryError)) {
      await insertViaKodakStub(supabase, full, false);
      return;
    }
    throw retryError;
  }
  if (isTimeoutError(insertError)) {
    await insertViaKodakStub(supabase, full, true);
    return;
  }
  throw insertError;
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
  const result = { pages: 0, pageUpdates: 0, pageSkips: 0, pageId: page.id };
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
  await insertProductionRow(supabase, full, libs);
  result.pages += 1;
  return result;
}

async function persist(title, content, extra, libs) {
  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    title,
    content,
    sourceUrl: SOURCE_URL,
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record, markersOf(), libs);
  record.id = local.pageId;
  const production = await importProduction(record, libs);
  const pageId = production.pageId || local.pageId;
  return {
    ...extra,
    pageId,
    path: `/pages/${pageId}`,
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
  const checkOnly = process.argv.includes("--check");
  const html = await fetchHtml(SOURCE_URL);
  const prompts = await fetchJson(PROMPTS_JSON_URL);
  assertPromptList(prompts);
  const markdown = buildMarkdown(prompts, html);
  const libs = loadLibs();
  const content = JSON.stringify(libs.markdownToTiptapDoc(markdown));
  const stats = documentStats(content);
  assertIntegrity({ markdown, stats, content });
  const extra = {
    pageTitle: PAGE_TITLE,
    images: stats.images,
    attachments: stats.attachments,
    codes: stats.codes,
    hrefs: stats.hrefs,
  };
  if (checkOnly) {
    console.log(JSON.stringify(extra, null, 2));
    return;
  }
  const result = await persist(PAGE_TITLE, content, extra, libs);
  console.log(JSON.stringify(result, null, 2));
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
