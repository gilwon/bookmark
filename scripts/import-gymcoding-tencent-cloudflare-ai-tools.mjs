// 짐코딩 텐센트·클라우드플레어 오픈소스 AI 도구 가이드를 Pages에만 저장한다.
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import { documentStats } from "./import-claude-eli5-page.mjs";
import {
  buildImportedPage,
  cleanGymMarkdown,
  isSkipImage,
  stripTracking,
} from "./import-gymcoding-articles.mjs";

export { cleanGymMarkdown, isSkipImage, stripTracking };

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";

export const SOURCE_URL =
  "https://www.gymcoding.co/articles/tencent-cloudflare-open-source-ai-tools-guide";
export const PAGE_TITLE =
  "무료 AI 오픈소스 3종: security-audit-skill·BrowserSkill·WeKnora 설치·사용법";
export const EXPECTED_IMAGES = 1;
export const EXPECTED_TABLES = 6;
export const EXPECTED_CODES = 19;
export const EXPECTED_LINKS = 72;
export const EXPECTED_ATTACHMENTS = 0;
export const EXPECTED_FAQ = 6;
export const LOCALHOST_HREF = "http://localhost:8088/";

export const REQUIRED_HREFS = [
  SOURCE_URL,
  LOCALHOST_HREF,
  "https://github.com/cloudflare/security-audit-skill",
  "https://github.com/Tencent/BrowserSkill",
  "https://github.com/Tencent/WeKnora",
  "https://github.com/cloudflare/security-audit-skill/blob/main/skills/security-audit/SKILL.md",
  "https://blog.cloudflare.com/build-your-own-vulnerability-harness/",
  "https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html",
  "https://nodejs.org/",
  "https://chromewebstore.google.com/detail/hhcmgoofomhgciiibhipgmgkgnoenaoi",
  "https://microsoftedge.microsoft.com/addons/detail/browserskill/emacgiaaaiojkkpkddmmdfhmokgmnikg",
  "https://docs.docker.com/get-started/get-docker/",
  "https://git-scm.com/install/",
  "https://hub.docker.com/r/wechatopenai/weknora-app/tags?name=v0.8.2",
  "https://github.com/Tencent/WeKnora/releases/tag/v0.8.2",
  "https://github.com/Tencent/BrowserSkill/releases/tag/cli-v0.3.2",
];

const REQUIRED_PHRASES = [
  "이런 분을 위한 글입니다",
  "읽고 나면 이렇게 달라집니다",
  "install.sh",
  "install.ps1",
  "http://localhost:3000/admin/courses",
  "http://host.docker.internal:11434",
  "세 도구를 모두 설치해야 하나요?",
  "회사 문서가 밖으로 나가지 않나요?",
  "security-audit 스킬로",
  "browser-skill을 사용해",
  "WEKNORA_VERSION=v0.8.2",
  "confirmed",
  "needs_validation",
];

const FORBIDDEN = [
  "fbclid",
  "utm_source",
  "inf.run",
  "인프런",
  "짐코딩 뉴스레터",
  "동의하고 구독",
  "cdn.techboost.dev",
  "opengraph-image",
  "/logo.svg",
  "coupon_code",
  "https://localhost",
];

const EXPIRED_URL_PARTS = [
  "prod-files-secure",
  "file.notion.so",
  "expirationTimestamp",
  "X-Amz",
  "blob:",
  "fbclid",
  "utm_source",
];

const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
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

/** 만료 URL 문자열이 본문에 없으면 true다. */
export function hasNoExpiredUrl(text) {
  const value = String(text ?? "");
  return EXPIRED_URL_PARTS.every((part) => !value.includes(part));
}

/** 제목 또는 원문 주소가 같으면 중복이다. */
export function isDuplicateRow(row, title, sourceUrl) {
  if (!row) return false;
  if (row.title === title) return true;
  if (!sourceUrl) return false;
  return (
    row.source_url === sourceUrl || stripTracking(row.source_url || "") === sourceUrl
  );
}

/** FAQ 제목 아래 답 글자 수를 센다. */
export function faqAnswerLengths(markdown) {
  const section = String(markdown ?? "").split("## 자주 묻는 질문")[1] || "";
  return section
    .split(/^### /m)
    .slice(1)
    .map((part) => part.replace(/^[^\n]+\n*/, "").split(/^## /m)[0].trim().length);
}

function loadLibs() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(resolve(root, "src/lib/markdown-to-tiptap.ts"));
  const { extractPageMediaReferences } = require(
    resolve(root, "src/lib/page-attachment-storage.ts")
  );
  const { preparePageFindability, isMissingPageFindabilityColumn } = require(
    resolve(root, "src/lib/page-findability.ts")
  );
  return {
    markdownToTiptapDoc,
    extractPageMediaReferences,
    preparePageFindability,
    isMissingPageFindabilityColumn,
  };
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

function coverFacts(src) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(src || "");
  if (!match) throw new Error("표지가 data URL이 아닙니다.");
  const bytes = Buffer.from(match[2], "base64");
  return {
    mime: match[1].toLowerCase(),
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function assertImported(markdown, content, stats, media) {
  if (!markdown.startsWith(`# ${PAGE_TITLE}`)) {
    throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
  }
  if (!markdown.includes(SOURCE_URL) || !content.includes(SOURCE_URL)) {
    throw new Error("원문 주소가 없습니다.");
  }
  if (!markdown.includes("![표지](data:image/")) {
    throw new Error("표지 그림이 없습니다.");
  }
  for (const phrase of REQUIRED_PHRASES) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  if (stats.images !== EXPECTED_IMAGES || media.imageSources.length !== EXPECTED_IMAGES) {
    throw new Error(`본문 이미지가 ${EXPECTED_IMAGES}장이 아닙니다. ${stats.images}`);
  }
  if (media.imageSources.some((src) => !src.startsWith("data:image/"))) {
    throw new Error("이미지가 data URL이 아닙니다.");
  }
  if (stats.tables !== EXPECTED_TABLES) {
    throw new Error(`표가 ${EXPECTED_TABLES}개가 아닙니다. ${stats.tables}`);
  }
  if (stats.codes !== EXPECTED_CODES) {
    throw new Error(`코드가 ${EXPECTED_CODES}개가 아닙니다. ${stats.codes}`);
  }
  if (stats.links !== EXPECTED_LINKS) {
    throw new Error(`링크가 ${EXPECTED_LINKS}개가 아닙니다. ${stats.links}`);
  }
  if (stats.attachments !== EXPECTED_ATTACHMENTS) {
    throw new Error(`첨부가 ${EXPECTED_ATTACHMENTS}개가 아닙니다. ${stats.attachments}`);
  }
  const answers = faqAnswerLengths(markdown);
  if (answers.length !== EXPECTED_FAQ || answers.some((length) => length < 40)) {
    throw new Error(`FAQ 답이 비어 있습니다. ${answers.join(",")}`);
  }
  const hrefs = new Set(stats.hrefs);
  for (const href of REQUIRED_HREFS) {
    if (!hrefs.has(href)) throw new Error(`TipTap 링크가 없습니다. ${href}`);
  }
  for (const forbidden of FORBIDDEN) {
    if (markdown.includes(forbidden) || content.includes(forbidden)) {
      throw new Error(`금지 문구가 남아 있습니다. ${forbidden}`);
    }
  }
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(content)) {
    throw new Error("만료 URL이 본문에 남아 있습니다.");
  }
  if (content.length > 1_500_000) {
    throw new Error(`본문이 저장 한도를 넘습니다. ${content.length}`);
  }
}

function sqliteHasFindability(db) {
  const cols = db
    .prepare("PRAGMA table_info(custom_pages)")
    .all()
    .map((column) => column.name);
  return ["tags", "source_url", "search_text", "is_favorite"].every((name) =>
    cols.includes(name)
  );
}

function pageColumns(db) {
  return db
    .prepare("PRAGMA table_info(custom_pages)")
    .all()
    .map((column) => column.name);
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
  if (!cols.includes("source_url") || !sourceUrl) return null;
  const bySource = db
    .prepare(
      `SELECT ${select} FROM custom_pages WHERE user_id = ? AND source_url = ? LIMIT 1`
    )
    .get(LOCAL_USER, sourceUrl);
  if (isDuplicateRow(bySource, title, sourceUrl)) return bySource;
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
  const existing = findLocalPage(db, page.title, page.sourceUrl);
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

function createSupabase() {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

async function findProductionPage(supabase, title, sourceUrl) {
  const byTitle = await supabase
    .from("custom_pages")
    .select("id, title")
    .eq("user_id", PROD_USER)
    .eq("title", title)
    .limit(1);
  if (byTitle.error) throw byTitle.error;
  if (byTitle.data?.[0]) return byTitle.data[0];
  if (!sourceUrl) return null;
  const bySource = await supabase
    .from("custom_pages")
    .select("id, title")
    .eq("user_id", PROD_USER)
    .eq("source_url", sourceUrl)
    .limit(1);
  if (bySource.error) throw bySource.error;
  return bySource.data?.[0] ?? null;
}

async function importProduction(page, libs) {
  const supabase = createSupabase();
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  const existing = await findProductionPage(supabase, page.title, page.sourceUrl);
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

async function savedOnBothSides() {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  let local = null;
  try {
    local = findLocalPage(db, PAGE_TITLE, SOURCE_URL);
  } finally {
    db.close();
  }
  const production = await findProductionPage(createSupabase(), PAGE_TITLE, SOURCE_URL);
  if (!local && !production) return null;
  if (!local || !production) {
    throw new Error(`로컬과 운영 중 한쪽에만 글이 있습니다. ${SOURCE_URL}`);
  }
  if (local.id !== production.id) {
    throw new Error(`로컬과 운영의 페이지 id가 다릅니다. ${SOURCE_URL}`);
  }
  return {
    pageTitle: PAGE_TITLE,
    pageId: local.id,
    path: `/pages/${local.id}`,
    local: { action: "skip", pages: 0, pageSkips: 1 },
    production: { action: "skip", pages: 0, pageSkips: 1 },
  };
}

async function persist(content, extra, libs) {
  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    title: PAGE_TITLE,
    content,
    sourceUrl: SOURCE_URL,
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
      db.prepare("DELETE FROM custom_pages WHERE id = ? AND user_id = ?").run(
        record.id,
        LOCAL_USER
      );
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
    local: { action: pageAction(local), pages: local.pages, pageSkips: local.pageSkips },
    production: {
      action: pageAction(production),
      pages: production.pages,
      pageSkips: production.pageSkips,
    },
  };
}

function summaryOf(markdown, content, stats, media) {
  const doc = JSON.parse(content);
  const cover = coverFacts(media.imageSources[0]);
  return {
    pageTitle: PAGE_TITLE,
    sourceUrl: SOURCE_URL,
    images: stats.images,
    tables: stats.tables,
    codes: stats.codes,
    links: stats.links,
    attachments: stats.attachments,
    faq: faqAnswerLengths(markdown).length,
    dividers: countNodes(content, "horizontalRule"),
    root: Array.isArray(doc.content) ? doc.content.length : 0,
    length: content.length,
    hash: createHash("sha256").update(content).digest("hex"),
    coverMime: cover.mime,
    coverBytes: cover.bytes,
    coverSha256: cover.sha256,
    markdownLength: markdown.length,
  };
}

function emit(value) {
  const output = JSON.stringify(value, null, 2);
  if (output.includes("data:")) throw new Error("로그에 data URL이 있습니다.");
  if (!hasNoExpiredUrl(output)) throw new Error("로그에 만료 URL이 있습니다.");
  console.log(output);
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const libs = loadLibs();
  if (!checkOnly) {
    const saved = await savedOnBothSides();
    if (saved) {
      emit(saved);
      return;
    }
  }
  const built = await buildImportedPage(SOURCE_URL, libs);
  if (built.title !== PAGE_TITLE || built.sourceUrl !== SOURCE_URL) {
    throw new Error("제목 또는 원문 주소가 예상과 다릅니다.");
  }
  const stats = documentStats(built.content);
  const media = libs.extractPageMediaReferences(built.content);
  assertImported(built.markdown, built.content, stats, media);
  const extra = summaryOf(built.markdown, built.content, stats, media);
  if (checkOnly) {
    emit(extra);
    return;
  }
  emit(await persist(built.content, extra, libs));
}

const isDirect =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) await main();
