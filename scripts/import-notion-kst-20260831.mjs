// 한국 시간 이번 주 Notion 신규 페이지 2건을 Pages에만 저장한다
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
export const COVER_JPEG_BYTES = 57604;
const EXPIRED_URL_PARTS = [
  "prod-files-secure",
  "file.notion.so",
  "expirationTimestamp",
  "X-Amz",
  "blob:",
  "fbclid",
  "utm_source",
];

export const TARGETS = [
  {
    key: "miro",
    title: "[미로] 클로드 프롬프트 공유",
    hex: "67ab256827ac83e4b31b017c7d19d2c3",
    pageId: "67ab2568-27ac-83e4-b31b-017c7d19d2c3",
    sourceUrl: "https://app.notion.com/p/67ab256827ac83e4b31b017c7d19d2c3",
    body: "tmp/notion-kst-20260831/miro.md",
    cover: "tmp/notion-kst-20260831/miro-cover.jpg",
    images: 1,
    attachments: 0,
    phrases: [
      "15년 경력의 프롬프트 엔지니어링",
      "역할부여(Persona)",
      "instagram.com/frommir0",
    ],
  },
  {
    key: "adhd",
    title: "성인 ADHD 선생님들을 위한 프롬프트 7개",
    hex: "eefb256827ac83fb8a158161c30c3dd6",
    pageId: "eefb2568-27ac-83fb-8a15-8161c30c3dd6",
    sourceUrl: "https://app.notion.com/p/eefb256827ac83fb8a158161c30c3dd6",
    body: "tmp/notion-kst-20260831/adhd.md",
    images: 0,
    attachments: 0,
    codes: 7,
    phrases: ["작업 마비 풀기", "도파민 메뉴", "07. 생각 비우고 정리"],
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

/** 유입 추적 쿼리를 빼고 절대 주소로 바꾼다. */
export function stripTracking(url, base) {
  if (!url) return url;
  try {
    const parsed = new URL(url, base);
    for (const key of [...parsed.searchParams.keys()]) {
      const value = parsed.searchParams.get(key);
      if (
        key.startsWith("utm_") ||
        key === "fbclid" ||
        key === "pvs" ||
        key === "igsh" ||
        key === "mcp_token" ||
        (key === "source" && value === "copy_link")
      ) {
        parsed.searchParams.delete(key);
      }
    }
    if ([...parsed.searchParams.keys()].length === 0) parsed.search = "";
    return parsed.href;
  } catch {
    return url
      .replace(/[?&](?:utm_[^=&#]*|fbclid|pvs|igsh|mcp_token)=[^&\s)#]*/g, "")
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

/** 제목 또는 원문 식별자가 있으면 중복이다. */
export function isDuplicateRow(row, title, markers) {
  if (!row) return false;
  if (row.title === title) return true;
  const hay = `${row.source_url ?? ""}\n${row.content ?? ""}`;
  return markers.some((marker) => marker && hay.includes(marker));
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

function linkHrefsOf(tiptapJsonString) {
  const hrefs = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    for (const mark of node.marks ?? []) {
      if (mark?.type === "link" && mark.attrs?.href) {
        hrefs.push(String(mark.attrs.href));
      }
    }
    for (const child of node.content ?? []) visit(child);
  }
  visit(JSON.parse(tiptapJsonString));
  return hrefs;
}

function restoreProtected(node) {
  if (typeof node.text === "string") {
    node.text = node.text
      .replace(/%%NOTION_LT%%/g, "<")
      .replace(/%%NOTION_GT%%/g, ">");
  }
  for (const child of node.content ?? []) restoreProtected(child);
}

function stripNodeHrefs(node) {
  if (!node || typeof node !== "object") return;
  for (const mark of node.marks ?? []) {
    if (mark?.type === "link" && mark.attrs?.href) {
      mark.attrs.href = stripTracking(mark.attrs.href);
    }
  }
  if (node.type === "image" && node.attrs?.src) {
    const src = String(node.attrs.src);
    if (!src.startsWith("data:")) node.attrs.src = stripTracking(src);
  }
  for (const child of node.content ?? []) stripNodeHrefs(child);
}

function rewriteMarkdownHrefs(markdown) {
  return String(markdown)
    .replace(
      /\]\((https?:\/\/[^)\s]+)\)/g,
      (_match, url) => `](${stripTracking(url)})`
    )
    .replace(/https?:\/\/[^\s)]+/g, (url) => stripTracking(url));
}

function coverDataUrl(spec) {
  if (!spec.cover) return "";
  const file = resolve(root, spec.cover);
  if (!existsSync(file)) throw new Error(`커버 파일이 없습니다. ${spec.cover}`);
  const bytes = readFileSync(file);
  if (bytes.length !== COVER_JPEG_BYTES) {
    throw new Error(`커버 크기가 다릅니다. ${bytes.length}`);
  }
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("커버가 JPEG가 아닙니다.");
  }
  const dataUrl = `data:image/jpeg;base64,${bytes.toString("base64")}`;
  if (!dataUrl.startsWith("data:image/jpeg;base64,")) {
    throw new Error("커버가 JPEG data URL이 아닙니다.");
  }
  if (!hasNoExpiredUrl(dataUrl)) {
    throw new Error("커버 data URL에 만료 문자열이 있습니다.");
  }
  return dataUrl;
}

function cleanBody(spec) {
  const bodyFile = resolve(root, spec.body);
  if (!existsSync(bodyFile)) throw new Error(`본문 파일이 없습니다. ${spec.body}`);
  const body = rewriteMarkdownHrefs(readFileSync(bodyFile, "utf8").trim());
  if (!hasNoExpiredUrl(body)) {
    throw new Error("만료 URL이 본문에 남아 있습니다.");
  }
  if (
    /prod-files-secure|X-Amz|file\.notion\.so|blob:|fbclid|utm_source/.test(body)
  ) {
    throw new Error("금지된 URL 조각이 본문에 남아 있습니다.");
  }
  return body;
}

function buildPageMarkdown(spec, body, cover) {
  const sourceUrl = stripTracking(spec.sourceUrl);
  return rewriteMarkdownHrefs(
    [`# ${spec.title}`, `> 원문. [Notion](${sourceUrl})`, cover, body]
      .filter(Boolean)
      .join("\n\n")
      .replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, "\n\n![$1]($2)\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function assertRecord(spec, markdown, content, stats) {
  const sourceUrl = stripTracking(spec.sourceUrl);
  if (!markdown.startsWith(`# ${spec.title}`)) {
    throw new Error("마크다운 첫 헤딩이 저장 제목과 다릅니다.");
  }
  if (!markdown.includes(`> 원문. [Notion](${sourceUrl})`)) {
    throw new Error("원문 인용이 없습니다.");
  }
  if (!content.includes(sourceUrl) && !content.includes(spec.hex)) {
    throw new Error(`원문 주소가 없습니다. ${spec.title}`);
  }
  for (const phrase of spec.phrases ?? []) {
    if (!markdown.includes(phrase)) {
      throw new Error(`문구가 없습니다. ${phrase}`);
    }
  }
  if (!hasNoExpiredUrl(markdown) || !hasNoExpiredUrl(content)) {
    throw new Error("만료 URL이 본문에 남아 있습니다.");
  }
  if (
    /prod-files-secure|X-Amz|file\.notion\.so|blob:|fbclid|utm_source/.test(
      markdown
    ) ||
    /prod-files-secure|X-Amz|file\.notion\.so|blob:|fbclid|utm_source/.test(
      content
    )
  ) {
    throw new Error("금지된 URL 조각이 저장 본문에 남아 있습니다.");
  }
  if (stats.images !== spec.images) {
    throw new Error(`TipTap 이미지 수가 다릅니다. ${stats.images}`);
  }
  if (stats.attachments !== spec.attachments) {
    throw new Error(`TipTap 첨부 수가 다릅니다. ${stats.attachments}`);
  }
  if (spec.codes != null && stats.codes !== spec.codes) {
    throw new Error(`TipTap 코드 수가 다릅니다. ${stats.codes}`);
  }
  const sources = imageSourcesOf(content);
  if (sources.length !== spec.images) {
    throw new Error(`본문 이미지 수가 다릅니다. ${sources.length}`);
  }
  for (const src of sources) {
    if (!src.startsWith("data:image")) {
      throw new Error("이미지가 data URL이 아닙니다.");
    }
    if (!hasNoExpiredUrl(src)) {
      throw new Error("이미지에 만료 URL이 남아 있습니다.");
    }
  }
  if (spec.key === "miro") {
    if (sources.length !== 1 || !sources[0].startsWith("data:image/jpeg")) {
      throw new Error("미로 커버가 JPEG data URL이 아닙니다.");
    }
    if (!markdown.includes("![커버](data:image/jpeg;base64,")) {
      throw new Error("미로 커버 마크다운이 없습니다.");
    }
    const instagram = linkHrefsOf(content).filter((href) =>
      href.includes("instagram.com/frommir0")
    );
    if (instagram.length === 0) {
      throw new Error("Instagram 주소가 없습니다.");
    }
    for (const href of instagram) {
      if (href !== "https://www.instagram.com/frommir0") {
        throw new Error(`Instagram href가 다릅니다. ${href}`);
      }
    }
  }
}

function buildRecord(spec, markdownToTiptapDoc) {
  const cover = spec.cover ? `![커버](${coverDataUrl(spec)})` : "";
  const markdown = buildPageMarkdown(spec, cleanBody(spec), cover);
  const protectedMarkdown = markdown.replace(
    /```([^\n]*)\n([\s\S]*?)\n```/g,
    (_block, language, code) =>
      `\`\`\`${language}\n${code
        .replace(/</g, "%%NOTION_LT%%")
        .replace(/>/g, "%%NOTION_GT%%")}\n\`\`\``
  );
  const doc = markdownToTiptapDoc(protectedMarkdown);
  restoreProtected(doc);
  stripNodeHrefs(doc);
  const content = JSON.stringify(doc);
  const stats = documentStats(content);
  assertRecord(spec, markdown, content, stats);
  return {
    spec,
    title: spec.title,
    sourceUrl: stripTracking(spec.sourceUrl),
    content,
    stats,
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

function markersOf(spec, sourceUrl) {
  return [sourceUrl, spec.pageId, spec.hex].filter(Boolean);
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

async function persist(title, content, markers, extra, libs, sourceUrl) {
  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    title,
    content,
    sourceUrl,
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record, markers, libs);
  record.id = local.pageId;
  const production = await importProduction(record, libs);
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

async function importTarget(spec, markdownToTiptapDoc, checkOnly, libs) {
  const record = buildRecord(spec, markdownToTiptapDoc);
  const extra = {
    key: spec.key,
    pageTitle: record.title,
    images: record.stats.images,
    attachments: record.stats.attachments,
    tables: record.stats.tables,
    codes: record.stats.codes,
  };
  if (checkOnly) return extra;
  return persist(
    record.title,
    record.content,
    markersOf(spec, record.sourceUrl),
    extra,
    libs,
    record.sourceUrl
  );
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const libs = loadLibs();
  const results = [];
  for (const target of TARGETS) {
    results.push(
      await importTarget(target, libs.markdownToTiptapDoc, checkOnly, libs)
    );
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
