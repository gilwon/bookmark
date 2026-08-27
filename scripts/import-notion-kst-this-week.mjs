// 한국 시간 이번 주(2026-08-24~) Notion 신규 페이지를 Pages에만 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import { pageBodies } from "./notion-kst-this-week-data.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const IMAGE_DIR = resolve(root, "public/imports/notion-kst-this-week");
const IMAGE_MIME = {
  "pipeline_flow.svg": "image/svg+xml",
  "premarket_gap_example.svg": "image/svg+xml",
  "apt-table.png": "image/png",
};
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const UNSAFE = [
  "prod-files-secure",
  "file.notion.so",
  "expirationTimestamp",
  "X-Amz",
  "blob:",
  "fbclid",
  "Security-Token",
];

export const PAGES = [
  {
    hex: "4dfb256827ac834396898144793e9b58",
    title: "🤖📈 코딩 몰라도 OK! Claude로 만드는 나만의 오르는 종목 AI 자동 분석 시스템",
    url: "https://app.notion.com/p/4dfb256827ac834396898144793e9b58",
    key: "stock",
    images: 2,
    phrases: [
      "TradingView",
      "프리마켓",
      "텔레그램",
      "github.com/tradesdontlie/tradingview-mcp",
    ],
  },
  {
    hex: "876b256827ac82309d44019cd2e0b3f7",
    title: "클로드 연동프로그램 5개 설치 가이드",
    url: "https://app.notion.com/p/876b256827ac82309d44019cd2e0b3f7",
    key: "addon",
    images: 0,
    phrases: [
      "youtube-transcript",
      "Filesystem",
      "ffmpeg-mcp",
      "5번 → 1번 → 2번 → 3번 → 4번",
    ],
  },
  {
    hex: "c75b256827ac8317a8eb8105709f5398",
    title: "🏠 한 번만 등록하면 끝 — 관심 아파트 재건축 진행상황 자동 브리핑",
    url: "https://app.notion.com/p/c75b256827ac8317a8eb8105709f5398",
    key: "apt",
    images: 1,
    phrases: [
      "관심 아파트 추적표",
      "매주 월요일 오전 9시",
      "지금 실행",
      "정비사업",
    ],
  },
  {
    hex: "4f3b256827ac82d392728151b7a1df67",
    title: "클로드 IQ 200 만드는 프롬프트",
    url: "https://app.notion.com/p/4f3b256827ac82d392728151b7a1df67",
    key: "iq",
    images: 0,
    phrases: [
      "Role Prompting",
      "XML 태그",
      "platform.claude.com/docs",
      "만능 프롬프트",
    ],
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
    )
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

function cleanTableCell(value) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\|/g, "\\|");
}

export function convertTables(value) {
  return value.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_table, body) => {
    const rows = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
      [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
        cleanTableCell(cell[1])
      )
    );
    if (!rows.length) return "";
    const width = Math.max(...rows.map((row) => row.length));
    const normalized = rows.map((row) =>
      Array.from({ length: width }, (_, index) => row[index] ?? "")
    );
    return `\n${normalized
      .flatMap((row, index) => [
        `| ${row.join(" | ")} |`,
        ...(index === 0 ? [`| ${row.map(() => "---").join(" | ")} |`] : []),
      ])
      .join("\n")}\n`;
  });
}

export function freezeImportImages(value) {
  return String(value).replace(
    /!\[([^\]]*)\]\(\/imports\/notion-kst-this-week\/([^)]+)\)/g,
    (_match, alt, file) => {
      const mime = IMAGE_MIME[file];
      const path = resolve(IMAGE_DIR, file);
      if (!mime || !existsSync(path)) {
        throw new Error(`이미지 파일이 없습니다. ${file}`);
      }
      const dataUrl = `data:${mime};base64,${readFileSync(path).toString("base64")}`;
      return `![${alt}](${dataUrl})`;
    }
  );
}

export function cleanNotionFetch(value) {
  let content = String(value);
  content = content.replace(
    /!\[([^\]]*)\]\(https:\/\/prod-files-secure[^)]+\)/g,
    ""
  );
  content = convertTables(content);
  content = content.replace(
    /<callout[^>]*>\s*([\s\S]*?)<\/callout>/gi,
    (_m, body) =>
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
  if (UNSAFE.some((part) => content.includes(part))) {
    throw new Error("만료 서명 URL이 본문에 남아 있습니다.");
  }
  return content;
}

export function buildMarkdown(page, body) {
  return [`# ${page.title}`, `> 원문. [Notion](${page.url})`, body]
    .filter(Boolean)
    .join("\n\n")
    .replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, "\n\n![$1]($2)\n\n");
}

function loadHelpers() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(
    resolve(root, "src/lib/markdown-to-tiptap.ts")
  );
  const { normalizedNotionWeekTitle } = require(
    resolve(root, "src/lib/page-attachment-storage.ts")
  );
  return { markdownToTiptapDoc, normalizedNotionWeekTitle };
}

function restoreProtected(node) {
  if (typeof node.text === "string") {
    node.text = node.text
      .replace(/%%NOTION_LT%%/g, "<")
      .replace(/%%NOTION_GT%%/g, ">");
  }
  for (const child of node.content ?? []) restoreProtected(child);
}

export function documentStats(tiptapJsonString) {
  const stats = { codes: 0, tables: 0, images: 0, callouts: 0 };
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

function assertRecord(page, markdown, content, stats) {
  if (!content.includes(page.url) && !content.includes(page.hex)) {
    throw new Error(`원문 주소가 없습니다. ${page.title}`);
  }
  if (UNSAFE.some((part) => content.includes(part) || markdown.includes(part))) {
    throw new Error(`만료 URL이 남아 있습니다. ${page.title}`);
  }
  if (stats.images !== page.images) {
    throw new Error(
      `이미지 수가 다릅니다. ${page.title} ${stats.images}/${page.images}`
    );
  }
  const sources = [];
  function visit(node) {
    if (node?.type === "image" && typeof node.attrs?.src === "string") {
      sources.push(node.attrs.src);
    }
    for (const child of node?.content ?? []) visit(child);
  }
  visit(JSON.parse(content));
  for (const src of sources) {
    if (!src.startsWith("data:image/")) {
      throw new Error(`이미지가 data URL이 아닙니다. ${page.title}`);
    }
  }
  for (const phrase of page.phrases) {
    if (!markdown.includes(phrase)) {
      throw new Error(`문구가 없습니다. ${page.title} ${phrase}`);
    }
  }
}

function buildRecord(page, markdownToTiptapDoc) {
  const raw = pageBodies[page.key];
  if (!raw) throw new Error(`본문 데이터가 없습니다. ${page.key}`);
  const body = freezeImportImages(cleanNotionFetch(raw));
  const markdown = buildMarkdown(page, body);
  const protectedMarkdown = markdown.replace(
    /```([^\n]*)\n([\s\S]*?)\n```/g,
    (_block, language, code) =>
      `\`\`\`${language}\n${code.replace(/</g, "%%NOTION_LT%%").replace(/>/g, "%%NOTION_GT%%")}\n\`\`\``
  );
  const doc = markdownToTiptapDoc(protectedMarkdown);
  restoreProtected(doc);
  const content = JSON.stringify(doc);
  const stats = documentStats(content);
  assertRecord(page, markdown, content, stats);
  return { page, title: page.title, content, stats, markdownLength: markdown.length };
}

function duplicatePage(rows, page, normalizedNotionWeekTitle) {
  const normalized = normalizedNotionWeekTitle(page.title);
  return rows.find(
    (row) =>
      row.title === page.title ||
      normalizedNotionWeekTitle(row.title) === normalized ||
      String(row.content ?? "").includes(page.hex)
  );
}

function shouldRefreshImages(row, record) {
  if (!row) return false;
  const previous = String(row.content ?? "");
  if (!previous.includes(record.page.hex)) return false;
  if (record.stats.images > documentStats(previous).images) return true;
  return (
    previous.includes("/imports/notion-kst-this-week/") &&
    record.content.includes("data:image")
  );
}

function importLocal(records, normalizedNotionWeekTitle) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pages: 0, pageSkips: 0, pageUpdates: 0, ids: [] };
  const now = new Date().toISOString();
  db.transaction(() => {
    const rows = db
      .prepare(
        "SELECT id, title, content FROM custom_pages WHERE user_id = ?"
      )
      .all(LOCAL_USER);
    const insert = db.prepare(
      `INSERT INTO custom_pages (id, user_id, title, content, source_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const update = db.prepare(
      `UPDATE custom_pages
       SET content = ?, source_url = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    );
    for (const record of records) {
      const existing = duplicatePage(
        rows,
        record.page,
        normalizedNotionWeekTitle
      );
      if (existing && shouldRefreshImages(existing, record)) {
        update.run(
          record.content,
          record.page.url,
          now,
          existing.id,
          LOCAL_USER
        );
        existing.content = record.content;
        result.pageUpdates += 1;
        result.ids.push({
          title: record.title,
          id: existing.id,
          updated: true,
        });
        continue;
      }
      if (existing) {
        result.pageSkips += 1;
        result.ids.push({
          title: record.title,
          id: existing.id,
          skipped: true,
        });
        continue;
      }
      const id = randomUUID();
      insert.run(
        id,
        LOCAL_USER,
        record.title,
        record.content,
        record.page.url,
        now,
        now
      );
      rows.push({
        id,
        title: record.title,
        content: record.content,
      });
      result.pages += 1;
      result.ids.push({ title: record.title, id });
    }
  })();
  db.close();
  return result;
}

async function importProduction(records) {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const result = { pages: 0, pageSkips: 0, pageUpdates: 0, ids: [] };
  const now = new Date().toISOString();
  for (const record of records) {
    const { data, error } = await supabase
      .from("custom_pages")
      .select("id, title, content")
      .eq("user_id", PROD_USER)
      .eq("title", record.title)
      .limit(1);
    if (error) throw error;
    const existing = data?.[0];
    if (existing && shouldRefreshImages(existing, record)) {
      const { error: updateError } = await supabase
        .from("custom_pages")
        .update({
          content: record.content,
          updated_at: now,
        })
        .eq("id", existing.id)
        .eq("user_id", PROD_USER);
      if (updateError) throw updateError;
      result.pageUpdates += 1;
      result.ids.push({
        title: record.title,
        id: existing.id,
        updated: true,
      });
      continue;
    }
    if (existing) {
      result.pageSkips += 1;
      result.ids.push({ title: record.title, id: existing.id, skipped: true });
      continue;
    }
    const id = randomUUID();
    const { error: insertError } = await supabase.from("custom_pages").insert({
      id,
      user_id: PROD_USER,
      title: record.title,
      content: record.content,
      created_at: now,
      updated_at: now,
    });
    if (insertError) throw insertError;
    result.pages += 1;
    result.ids.push({ title: record.title, id });
  }
  return result;
}

async function main() {
  const { markdownToTiptapDoc, normalizedNotionWeekTitle } = loadHelpers();
  const records = PAGES.map((page) => buildRecord(page, markdownToTiptapDoc));
  if (process.argv.includes("--check")) {
    console.log(
      records.map((record) => ({
        title: record.title,
        ...record.stats,
        markdownLength: record.markdownLength,
      }))
    );
    return;
  }
  const local = importLocal(records, normalizedNotionWeekTitle);
  const production = await importProduction(records);
  console.log(JSON.stringify({ local, production }, null, 2));
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
