// 한국 시간 어제·오늘 신규 Notion 2건을 Pages로 이관한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import { pageData } from "./notion-kst-20260816-17-data.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localUser = "dev";
const productionUser = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const start = "2026-08-15T15:00:00.000Z";
const end = "2026-08-17T15:00:00.000Z";
const guidebookUrl = "https://docs.google.com/document/d/1sUColJlbwCfJ7uXOrIK9T-ipsC_noPOSTL451dubgUo/edit?usp=sharing";
const downloadZipUrl = "https://github.com/rebelytics/one-skill-to-rule-them-all";
const allowedIds = new Set([
  "155b2568-27ac-82a5-b27e-81c05bb185ce",
  "78bb2568-27ac-820a-b06a-811e567fb95b",
]);
const signedUrlPattern = /prod-files-secure|X-Amz|file\.notion\.so|blob:/;

const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^("')|("')$/g, "");
  }
}

const require = createRequire(import.meta.url);
const tsx = require("tsx/cjs/api");
tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
const { markdownToTiptapDoc } = require(resolve(root, "src/lib/markdown-to-tiptap.ts"));
const { normalizePasteToMarkdown } = require(resolve(root, "src/lib/normalize-to-markdown.ts"));

export function extractNotionContent(value) {
  return String(value).match(/<content>\n([\s\S]*?)\n<\/content>/)?.[1]?.trim() ?? String(value).trim();
}

export function sourceUrl(page) {
  return String(page.url ?? page.source ?? "").split("?")[0];
}

export function filterRecentPages(pages) {
  return pages.filter((page) => {
    const createdAt = new Date(page.createdAt).toISOString();
    return allowedIds.has(page.id) && createdAt >= start && createdAt < end;
  });
}

export function pageSourceMarkers(page) {
  return [sourceUrl(page), page.id, page.id.replaceAll("-", "")];
}

export function duplicatePage(rows, page) {
  const titleMatches = rows.filter((row) => String(row.title) === page.title);
  if (titleMatches.length > 1) throw new Error(`Notion Page 제목이 중복되었습니다: ${page.title}`);
  return titleMatches.length === 1 || rows.some((row) => pageSourceMarkers(page).some((marker) => String(row.content).includes(marker)));
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
      [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cleanTableCell(cell[1]))
    );
    if (!rows.length) return "";
    const width = Math.max(...rows.map((row) => row.length));
    const normalized = rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ""));
    return "\n" + normalized
      .flatMap((row, index) => [
        "| " + row.join(" | ") + " |",
        ...(index === 0 ? ["| " + row.map(() => "---").join(" | ") + " |"] : []),
      ])
      .join("\n") + "\n";
  });
}

function replaceUnknowns(value) {
  return value.replace(/<unknown\s+([^>]*?)\s*\/?>/gi, (_tag, attrs) => {
    const url = attrs.match(/\burl="([^"]+)"/)?.[1] ?? "";
    const alt = attrs.match(/\balt="([^"]+)"/)?.[1] ?? "";
    if (url.includes("#030b256827ac8393b32681eda92ed4e0")) {
      return `[가이드북](${guidebookUrl})`;
    }
    if (alt === "bookmark") {
      return `[AINOW 네이버 카페](${url})`;
    }
    return url ? `[${url}](${url})` : "";
  });
}

function injectDownloadLink(value) {
  if (!value.includes("## 다운로드") || value.includes(`](${downloadZipUrl})`)) return value;
  return value.replace(
    /## 다운로드\n/,
    `## 다운로드\n\n[task-observer-skill.zip](${downloadZipUrl})\n\n`
  );
}

export function normalizeNotionMarkdown(page) {
  const source = sourceUrl(page);
  let content = convertTables(extractNotionContent(page.notionContent ?? page.body ?? ""));
  content = replaceUnknowns(content);
  content = content.replace(/<callout[^>]*>\n?([\s\S]*?)\n?<\/callout>/gi, (_callout, body) =>
    "\n\n:::callout\n" + body.replace(/<br\s*\/?>/gi, "\n").replace(/^\t/gm, "").trim() + "\n:::\n\n"
  );
  content = injectDownloadLink(content)
    .replace(/<empty-block\s*\/>/gi, "")
    .replace(/^\t/gm, "")
    .replace(/\\~/g, "~")
    .replace(/\s+\{color="[^"]+"\}$/gm, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
  return [`# ${page.title}`, `> 원문. [Notion](${source})`, content].join("\n\n");
}

function restoreProtected(node) {
  if (typeof node.text === "string") {
    node.text = node.text.replace(/%%NOTION_LT%%/g, "<").replace(/%%NOTION_GT%%/g, ">");
  }
  for (const child of node.content ?? []) restoreProtected(child);
}

export function buildPageContent(page) {
  const source = sourceUrl(page);
  const protectedMarkdown = normalizeNotionMarkdown(page).replace(
    /```([^\n]*)\n([\s\S]*?)\n```/g,
    (_block, language, body) =>
      "```" + language + "\n" + body.replace(/</g, "%%NOTION_LT%%").replace(/>/g, "%%NOTION_GT%%") + "\n```"
  );
  const markdown = normalizePasteToMarkdown(protectedMarkdown);
  const doc = markdownToTiptapDoc(markdown);
  restoreProtected(doc);
  const content = JSON.stringify(doc);
  if (!content.includes(source)) throw new Error(`원문 source URL이 변환 결과에 없습니다: ${page.title}`);
  if (signedUrlPattern.test(content)) throw new Error(`만료 서명 URL이 변환 결과에 남아 있습니다: ${page.title}`);
  return content;
}

function buildRecord(page) {
  return { ...page, source: sourceUrl(page), content: buildPageContent(page) };
}

function localRows() {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  const rows = db.prepare("SELECT id, title, content FROM custom_pages WHERE user_id = ?").all(localUser);
  db.close();
  return rows;
}

function importLocal(records) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { inserted: 0, skipped: 0 };
  db.transaction(() => {
    const rows = localRows();
    const insert = db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
    for (const record of records) {
      if (duplicatePage(rows, record)) { result.skipped += 1; continue; }
      const now = new Date().toISOString();
      insert.run(randomUUID(), localUser, record.title, record.content, now, now);
      rows.push(record);
      result.inserted += 1;
    }
  })();
  db.close();
  return result;
}

async function importProduction(records, supabase) {
  const result = { inserted: 0, skipped: 0 };
  for (const record of records) {
    const { data: rows, error } = await supabase.from("custom_pages").select("id, title, content").eq("user_id", productionUser).eq("title", record.title);
    if (error) throw error;
    if (duplicatePage(rows ?? [], record)) { result.skipped += 1; continue; }
    const now = new Date().toISOString();
    const { error: insertError } = await supabase.from("custom_pages").insert({ id: randomUUID(), user_id: productionUser, title: record.title, content: record.content, created_at: now, updated_at: now });
    if (insertError) throw insertError;
    result.inserted += 1;
  }
  return result;
}

export async function runImport(pages, { checkOnly = false } = {}) {
  const candidates = filterRecentPages(pages);
  if (candidates.length !== 2) throw new Error(`예상한 Notion Page 2건이 아닙니다: ${candidates.length}`);
  const records = candidates.map(buildRecord);
  const local = localRows();
  if (checkOnly) {
    return {
      candidates: records.map((record) => ({
        id: record.id,
        title: record.title,
        createdAt: record.createdAt,
        duplicate: duplicatePage(local, record),
      })),
      writes: 0,
    };
  }
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락: ${key}`);
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  return { candidates: records.length, local: importLocal(records), production: await importProduction(records, supabase) };
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const result = await runImport(pageData, { checkOnly: process.argv.includes("--check") });
  console.log(JSON.stringify(result, null, 2));
}
