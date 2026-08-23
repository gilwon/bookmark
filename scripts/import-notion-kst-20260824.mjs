// 한국 시간 2026-08-22 이후 Notion 신규 페이지를 Pages에만 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const snapshotDir = resolve(root, "tmp/notion-kst-20260824");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const unsafeParts = [
  "prod-files-secure",
  "file.notion.so",
  "expirationTimestamp",
  "X-Amz",
  "blob:",
  "Security-Token",
];

export const PAGES = [
  {
    hex: "c8db256827ac82b0bf8381dc928fde34",
    title: "📊 자산관리 대시보드 6가지, 클로드 코드로 직접 만들기",
    url: "https://app.notion.com/p/c8db256827ac82b0bf8381dc928fde34?pvs=204",
    source: "dashboard.json",
    images: 6,
  },
  {
    hex: "a4ab256827ac82f785e1813bd31d0687",
    title: "클로드 플러그인 7개 10분만에 설치하기",
    url: "https://app.notion.com/p/a4ab256827ac82f785e1813bd31d0687?pvs=204",
    source: "plugin.json",
    images: 3,
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

function mimeOf(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  throw new Error("이미지 MIME을 판별하지 못했습니다.");
}

const imageMap = JSON.parse(
  readFileSync(resolve(snapshotDir, "images.json"), "utf8")
);
const dataUrls = new Map(
  imageMap.map((item) => {
    const bytes = readFileSync(resolve(snapshotDir, item.path));
    return [item.id, `data:${mimeOf(bytes)};base64,${bytes.toString("base64")}`];
  })
);

export function extractNotionContent(value) {
  return (
    String(value).match(/<content>\n([\s\S]*?)\n<\/content>/)?.[1]?.trim() ??
    String(value).trim()
  );
}

// 스냅샷 PNG를 data URL로 바꿔 만료 URL을 저장하지 않는다.
export function replaceSnapshotImages(markdown) {
  return markdown.replace(
    /!\[([^\]]*)\]\((https:\/\/prod-files-secure\.s3[^)]+)\)/g,
    (_match, alt, url) => {
      const fileId = url.match(
        /amazonaws\.com\/[0-9a-f-]{36}\/([0-9a-f-]{36})\//
      )?.[1];
      const dataUrl = fileId ? dataUrls.get(fileId) : null;
      if (!dataUrl) throw new Error(`이미지 파일을 찾지 못했습니다. ${fileId || url}`);
      return `![${alt || "Notion 이미지"}](${dataUrl})`;
    }
  );
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

function stripNotionChrome(markdown) {
  return markdown
    .replace(/<database url="([^"]+)"[^>]*>([\s\S]*?)<\/database>/gi, "[$2]($1)")
    .replace(
      /<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi,
      "**$1**\n$2"
    )
    .replace(/<\/?(?:empty-block|columns|column|table_of_contents)[^>]*\/?>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\\~/g, "~")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function bodyOf(page) {
  const snapshot = JSON.parse(readFileSync(resolve(snapshotDir, page.source), "utf8"));
  let content = extractNotionContent(snapshot.text);
  content = convertTables(content);
  content = stripNotionChrome(content);
  content = replaceSnapshotImages(content);
  return content;
}

function countNodes(content, type) {
  let count = 0;
  function visit(node) {
    if (node?.type === type) count += 1;
    for (const child of node?.content ?? []) visit(child);
  }
  visit(JSON.parse(content));
  return count;
}

function extractImageSources(content) {
  const sources = [];
  function visit(node) {
    if (node?.type === "image" && typeof node.attrs?.src === "string") {
      sources.push(node.attrs.src);
    }
    for (const child of node?.content ?? []) visit(child);
  }
  visit(JSON.parse(content));
  return sources;
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

function buildRecord(page, markdownToTiptapDoc) {
  const body = bodyOf(page);
  let markdown = [`# ${page.title}`, `> 원문. [Notion](${page.url})`, body]
    .filter(Boolean)
    .join("\n\n")
    .replace(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g, "\n\n![$1]($2)\n\n");
  const protectedMarkdown = markdown.replace(
    /```([^\n]*)\n([\s\S]*?)\n```/g,
    (_block, language, code) =>
      `\`\`\`${language}\n${code.replace(/</g, "%%NOTION_LT%%").replace(/>/g, "%%NOTION_GT%%")}\n\`\`\``
  );
  const doc = markdownToTiptapDoc(protectedMarkdown);
  restoreProtected(doc);
  const content = JSON.stringify(doc);
  const images = countNodes(content, "image");
  const sources = extractImageSources(content);
  if (!content.includes(page.url.split("?")[0]) && !content.includes(page.hex)) {
    throw new Error(`원문 주소가 없습니다. ${page.title}`);
  }
  if (unsafeParts.some((part) => content.includes(part))) {
    throw new Error(`만료 URL이 남아 있습니다. ${page.title}`);
  }
  if (sources.some((src) => !src.startsWith("data:image/"))) {
    throw new Error(`이미지가 data URL이 아닙니다. ${page.title}`);
  }
  if (images !== page.images || sources.length !== page.images) {
    throw new Error(`이미지 수가 다릅니다. ${page.title} ${images}/${page.images}`);
  }
  return { page, title: page.title, content, images, markdownLength: markdown.length };
}

// 로컬은 제목·정규화 제목·원문 hex가 같으면 스킵한다.
function duplicatePage(rows, page, normalizedNotionWeekTitle) {
  const normalized = normalizedNotionWeekTitle(page.title);
  return rows.some(
    (row) =>
      row.title === page.title ||
      normalizedNotionWeekTitle(row.title) === normalized ||
      String(row.content ?? "").includes(page.hex)
  );
}

function importLocal(records, normalizedNotionWeekTitle) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pages: 0, pageSkips: 0, ids: [] };
  const now = new Date().toISOString();
  db.transaction(() => {
    const rows = db
      .prepare("SELECT title, content FROM custom_pages WHERE user_id = ?")
      .all(LOCAL_USER);
    const insert = db.prepare(
      `INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const record of records) {
      if (duplicatePage(rows, record.page, normalizedNotionWeekTitle)) {
        result.pageSkips += 1;
        continue;
      }
      const id = randomUUID();
      insert.run(id, LOCAL_USER, record.title, record.content, now, now);
      rows.push({ title: record.title, content: record.content });
      result.pages += 1;
      result.ids.push({ title: record.title, id });
    }
  })();
  db.close();
  return result;
}

// 운영은 제목 일치만 보고 본문 LIKE는 쓰지 않는다.
async function importProduction(records) {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const result = { pages: 0, pageSkips: 0, ids: [] };
  const now = new Date().toISOString();
  for (const record of records) {
    const { data, error } = await supabase
      .from("custom_pages")
      .select("id, title")
      .eq("user_id", PROD_USER)
      .eq("title", record.title)
      .limit(1);
    if (error) throw error;
    if (data?.length) {
      result.pageSkips += 1;
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
  if (dataUrls.size !== 9) {
    throw new Error(`이미지 스냅샷이 9장이 아닙니다. ${dataUrls.size}`);
  }
  const { markdownToTiptapDoc, normalizedNotionWeekTitle } = loadHelpers();
  const records = PAGES.map((page) => buildRecord(page, markdownToTiptapDoc));
  if (process.argv.includes("--check")) {
    console.log(
      records.map((record) => ({
        title: record.title,
        images: record.images,
        markdownLength: record.markdownLength,
      }))
    );
    return;
  }
  const local = importLocal(records, normalizedNotionWeekTitle);
  const production = await importProduction(records);
  console.log({ local, production });
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
