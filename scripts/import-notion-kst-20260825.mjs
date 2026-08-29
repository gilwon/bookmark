// 한국 시간 2026-08-25 00:00 이후 Notion 페이지를 Pages에만 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import { convertTables } from "./import-notion-kst-this-week.mjs";

export { convertTables };

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const IMPORT_PREFIX = "/imports/notion-kst-20260825/";
const EXPIRED_URL_PARTS = [
  "prod-files-secure",
  "file.notion.so",
  "expirationTimestamp",
  "X-Amz",
];

export const TARGETS = [
  {
    key: "addon",
    title: "클로드 연동프로그램 5개 설치 가이드",
    hex: "876b256827ac82309d44019cd2e0b3f7",
    url: "https://app.notion.com/p/876b256827ac82309d44019cd2e0b3f7",
    skip: true,
  },
  {
    key: "apt",
    title: "🏠 한 번만 등록하면 끝 — 관심 아파트 재건축 진행상황 자동 브리핑",
    hex: "c75b256827ac8317a8eb8105709f5398",
    url: "https://app.notion.com/p/c75b256827ac8317a8eb8105709f5398",
    skip: true,
  },
  {
    key: "iq",
    title: "클로드 IQ 200 만드는 프롬프트",
    hex: "4f3b256827ac82d392728151b7a1df67",
    url: "https://app.notion.com/p/4f3b256827ac82d392728151b7a1df67",
    skip: true,
  },
  {
    key: "sticker",
    title:
      "[trenddalkak] 스티커로 부업도 한다던데..챗GPT 스티커공장 돌리기 가이드",
    hex: "de9b256827ac82a2a2a801c9069a90ae",
    url: "https://app.notion.com/p/de9b256827ac82a2a2a801c9069a90ae",
    body: "tmp/notion-kst-20260825/sticker-clean.md",
    images: 31,
    attachments: 0,
    phrases: [
      "참고 프롬프트",
      "instagram.com/trenddalkak.ai",
      "아이메시지",
    ],
    skip: false,
  },
  {
    key: "license",
    title: "디자인 시스템 가져다 쓸 때, 그냥 써도 되는 것과 아닌 것",
    hex: "754b256827ac83c69ac401191f3118ab",
    url: "https://app.notion.com/p/754b256827ac83c69ac401191f3118ab",
    body: "tmp/notion-kst-20260825/license.md",
    images: 1,
    attachments: 0,
    phrases: ["SEED", "앱인토스", "Polaris", "Fluent UI"],
    table: 1,
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

/** `/imports/notion-kst-20260825/` 이미지 경로 개수를 센다. */
export function countImportImages(value) {
  return (
    String(value).match(
      /!\[[^\]]*\]\(\/imports\/notion-kst-20260825\/[^)]+\)/g
    ) || []
  ).length;
}

/** Notion 본문 태그를 마크다운으로 정리한다. */
export function cleanNotionBody(value) {
  let content = convertTables(String(value));
  content = content.replace(
    /<callout[^>]*>\s*([\s\S]*?)<\/callout>/gi,
    (_match, body) =>
      `\n:::callout\n${String(body).replace(/^\t/gm, "").trim()}\n:::\n`
  );
  content = content
    .replace(/\{color="[^"]*"\}/g, "")
    .replace(/<span color="[^"]*">([\s\S]*?)<\/span>/gi, "$1")
    .replace(/<\/?(?:empty-block|columns|column)[^>]*\/?>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\\~/g, "~")
    .replace(/\\\$/g, "$")
    .replace(/\\\[/g, "[")
    .replace(/\\\]/g, "]")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  if (!hasNoExpiredUrl(content)) {
    throw new Error("만료 서명 URL이 본문에 남아 있습니다.");
  }
  if (content.includes("data:image")) {
    throw new Error("data URL 이미지는 저장하지 않습니다.");
  }
  return content;
}

/** 로컬 import 이미지를 독립 줄로 두고 만료 URL이 있으면 중단한다. */
export function rewriteImportImages(value) {
  let content = String(value).replace(
    /[ \t]*!\[([^\]]*)\]\((\/imports\/notion-kst-20260825\/[^)]+)\)[ \t]*/g,
    "\n\n![$1]($2)\n\n"
  );
  content = content.replace(/\n{4,}/g, "\n\n\n").trim();
  if (!hasNoExpiredUrl(content)) {
    throw new Error("만료 서명 URL이 본문에 남아 있습니다.");
  }
  if (content.includes("data:image")) {
    throw new Error("data URL 이미지는 저장하지 않습니다.");
  }
  return content;
}

function markersOf(spec) {
  return [spec.hex, spec.url].filter(Boolean);
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

function restoreProtected(node) {
  if (typeof node.text === "string") {
    node.text = node.text
      .replace(/%%NOTION_LT%%/g, "<")
      .replace(/%%NOTION_GT%%/g, ">");
  }
  for (const child of node.content ?? []) restoreProtected(child);
}

function documentStats(tiptapJsonString) {
  const stats = { codes: 0, tables: 0, images: 0, callouts: 0, attachments: 0 };
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "codeBlock") stats.codes += 1;
    if (node.type === "table") stats.tables += 1;
    if (node.type === "image") stats.images += 1;
    if (node.type === "callout") stats.callouts += 1;
    for (const child of node.content ?? []) visit(child);
  }
  visit(JSON.parse(tiptapJsonString));
  return stats;
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

function publicPathOf(src) {
  return resolve(root, "public", src.replace(/^\//, ""));
}

function assertImportFiles(sources) {
  for (const src of sources) {
    if (!src.startsWith(IMPORT_PREFIX)) {
      throw new Error(`이미지 src가 ${IMPORT_PREFIX}가 아닙니다. ${src}`);
    }
    if (!existsSync(publicPathOf(src))) {
      throw new Error(`이미지 파일이 없습니다. ${src}`);
    }
  }
}

function buildMarkdown(spec, body) {
  return rewriteImportImages(
    [`# ${spec.title}`, `> 원문. [Notion](${spec.url})`, body]
      .filter(Boolean)
      .join("\n\n")
  );
}

function assertRecord(spec, markdown, content, stats) {
  if (!content.includes(spec.url) && !content.includes(spec.hex)) {
    throw new Error(`원문 주소가 없습니다. ${spec.title}`);
  }
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(content)) {
    throw new Error(`만료 URL이 남아 있습니다. ${spec.title}`);
  }
  if (markdown.includes("data:image") || content.includes("data:image")) {
    throw new Error(`data URL 이미지는 저장하지 않습니다. ${spec.title}`);
  }
  if (stats.images !== spec.images) {
    throw new Error(
      `이미지 수가 다릅니다. ${spec.title} ${stats.images}/${spec.images}`
    );
  }
  if (spec.table != null && stats.tables !== spec.table) {
    throw new Error(
      `표 수가 다릅니다. ${spec.title} ${stats.tables}/${spec.table}`
    );
  }
  if (spec.attachments != null && stats.attachments !== spec.attachments) {
    throw new Error(
      `첨부 수가 다릅니다. ${spec.title} ${stats.attachments}/${spec.attachments}`
    );
  }
  const sources = imageSourcesOf(content);
  if (sources.length !== spec.images) {
    throw new Error(
      `본문 이미지 수가 다릅니다. ${spec.title} ${sources.length}/${spec.images}`
    );
  }
  assertImportFiles(sources);
  for (const phrase of spec.phrases ?? []) {
    if (!markdown.includes(phrase)) {
      throw new Error(`문구가 없습니다. ${spec.title} ${phrase}`);
    }
  }
}

function buildRecord(spec, markdownToTiptapDoc) {
  const bodyFile = resolve(root, spec.body);
  if (!existsSync(bodyFile)) {
    throw new Error(`본문 파일이 없습니다. ${spec.body}`);
  }
  const body = rewriteImportImages(
    cleanNotionBody(readFileSync(bodyFile, "utf8"))
  );
  const markdown = buildMarkdown(spec, body);
  const protectedMarkdown = markdown.replace(
    /```([^\n]*)\n([\s\S]*?)\n```/g,
    (_block, language, code) =>
      `\`\`\`${language}\n${code
        .replace(/</g, "%%NOTION_LT%%")
        .replace(/>/g, "%%NOTION_GT%%")}\n\`\`\``
  );
  const doc = markdownToTiptapDoc(protectedMarkdown);
  restoreProtected(doc);
  const content = JSON.stringify(doc);
  const stats = documentStats(content);
  assertRecord(spec, markdown, content, stats);
  return {
    spec,
    title: spec.title,
    content,
    stats,
    markdownLength: markdown.length,
  };
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
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
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
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
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

function extraOf(spec, record) {
  return {
    key: spec.key,
    pageTitle: spec.title,
    images: record.stats.images,
    attachments: record.stats.attachments,
    tables: record.stats.tables,
    codes: record.stats.codes,
    callouts: record.stats.callouts,
    markdownLength: record.markdownLength,
  };
}

async function importTarget(spec, markdownToTiptapDoc, checkOnly) {
  const record = buildRecord(spec, markdownToTiptapDoc);
  const extra = extraOf(spec, record);
  if (checkOnly) return extra;
  return persist(record.title, record.content, markersOf(spec), extra);
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
