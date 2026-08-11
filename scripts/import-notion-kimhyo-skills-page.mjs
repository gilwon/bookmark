// 김효율 스킬팩 Notion 원문을 Pages에 중복 없이 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceUrl = "https://sparkly-room-cb6.notion.site/3b5003c7f7be80bbb275eda06077f238";
const pageId = "3b5003c7-f7be-80bb-b275-eda06077f238";
const sourceId = pageId.replaceAll("-", "");
const endpoint = "https://www.notion.so/api/v3/loadPageChunk";
const localUser = "dev";
const productionUser = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const externalUrl = "https://claude.com/product/claude-code";
const expectedTypeCounts = { page: 1, sub_header: 8, text: 45, divider: 8, callout: 7, sub_sub_header: 10, code: 10, file: 2, bulleted_list: 10, numbered_list: 3 };
const fileLabels = new Map([
  ["intranet-style-skill-20260807.zip", "intranet-style-skill-20260807.zip · 111.7 KiB"],
  ["ui-inspector-skill-20260807.zip", "ui-inspector-skill-20260807.zip · 11.6 KiB"],
]);
const licenseContact = "이용 범위 문의 · 팀·기업 라이선스: «lean8kim@gmail.com / 010-8110-0828»";

const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^(["'])|(["'])$/g, "");
  }
}

const require = createRequire(import.meta.url);
const tsx = require("tsx/cjs/api");
tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
const { markdownToTiptapDoc } = require(resolve(root, "src/lib/markdown-to-tiptap.ts"));

function plainText(value) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map((fragment) => {
    if (typeof fragment === "string") return fragment;
    if (!Array.isArray(fragment)) return "";
    return plainText(fragment[0]);
  }).join("");
}

function inlineMarkdown(value) {
  if (!Array.isArray(value)) return plainText(value);
  return value.map((fragment) => {
    if (typeof fragment === "string") return fragment;
    if (!Array.isArray(fragment)) return "";
    let result = typeof fragment[0] === "string" ? fragment[0] : plainText(fragment);
    const marks = Array.isArray(fragment[1]) ? fragment[1] : [];
    const link = marks.find((mark) => Array.isArray(mark) && mark[0] === "a" && mark[1]);
    for (const mark of marks) {
      if (!Array.isArray(mark)) continue;
      if (mark[0] === "b") result = `**${result}**`;
      if (mark[0] === "i") result = `*${result}*`;
      if (mark[0] === "c") result = `\`${result}\``;
      if (mark[0] === "s") result = `~~${result}~~`;
      if (mark[0] === "u") result = `<u>${result}</u>`;
    }
    return link ? `[${result}](${link[1]})` : result;
  }).join("");
}

function titleOf(block) {
  return inlineMarkdown(block?.properties?.title).trim();
}

function rawTitleOf(block) {
  return plainText(block?.properties?.title).trim();
}

function languageOf(block) {
  const language = plainText(block?.properties?.language) || block?.format?.code_language || "";
  return /^plain text$/i.test(language) ? "text" : language;
}

function unsafeStringCount(value) {
  return (String(value).match(/blob:|file\.notion\.so|expirationTimestamp/gi) ?? []).length;
}

function typeCounts(blocks) {
  return Object.fromEntries(Object.entries(Object.groupBy([...blocks.values()], (block) => block.type)).map(([type, values]) => [type, values.length]));
}

function assertSourceInvariant(blocks, page, requestCount) {
  const counts = typeCounts(blocks);
  const files = [...blocks.values()].filter((block) => block.type === "file").map(rawTitleOf);
  const codeLanguages = [...blocks.values()].filter((block) => block.type === "code").map(languageOf);
  const typesMatch = Object.keys(counts).length === Object.keys(expectedTypeCounts).length && Object.entries(expectedTypeCounts).every(([type, count]) => counts[type] === count);
  const expectedFiles = new Set(fileLabels.keys());
  const filesMatch = files.length === expectedFiles.size && new Set(files).size === expectedFiles.size && files.every((file) => expectedFiles.has(file));
  if (blocks.size !== 104 || page.content?.length !== 101 || !typesMatch || !filesMatch || codeLanguages.length !== 10 || !codeLanguages.every((language) => language === "text" || language === "")) throw new Error("원문 구조 무결성 검증에 실패했습니다.");
  return { total: blocks.size, rootChildren: page.content.length, requestCount, types: counts, files, codeLanguages };
}

async function collectBlocks() {
  const blocks = new Map();
  const queue = [pageId];
  const requested = new Set();
  while (queue.length) {
    const id = queue.shift();
    if (requested.has(id)) continue;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "user-agent": "Mozilla/5.0" },
      body: JSON.stringify({ pageId: id, limit: 999999, cursor: { stack: [] }, chunkNumber: 0, verticalColumns: false }),
    });
    if (!response.ok) throw new Error(`Notion HTTP ${response.status} (${id})`);
    requested.add(id);
    const chunk = await response.json();
    for (const [blockId, record] of Object.entries(chunk.recordMap?.block ?? {})) {
      if (record?.value?.value) blocks.set(blockId, record.value.value);
    }
    for (const block of blocks.values()) {
      for (const childId of block.content ?? []) if (!blocks.has(childId) && !requested.has(childId)) queue.push(childId);
    }
  }
  const page = blocks.get(pageId);
  if (!page) throw new Error("Notion 루트 블록을 찾지 못했습니다.");
  const missing = [...blocks.values()].flatMap((block) => block.content ?? []).filter((id) => !blocks.has(id));
  if (missing.length) throw new Error(`Notion 블록 수집 누락: ${[...new Set(missing)].join(", ")}`);
  return { blocks, page, requestCount: requested.size };
}

function documentFrom(blocks, page) {
  const codeLanguages = [];
  const zipLabels = [];
  function render(id, path = new Set()) {
    const block = blocks.get(id);
    if (!block || path.has(id)) return "";
    const nextPath = new Set(path).add(id);
    const title = titleOf(block);
    const rawTitle = rawTitleOf(block);
    const children = (block.content ?? []).map((childId) => render(childId, nextPath)).filter(Boolean).join("\n\n");
    if (block.type === "code") {
      const language = languageOf(block);
      codeLanguages.push(language);
      return `\`\`\`${language}\n${plainText(block.properties?.title)}\n\`\`\``;
    }
    if (block.type === "file") {
      const label = fileLabels.get(rawTitle);
      if (!label) throw new Error(`예상하지 못한 첨부 파일: ${rawTitle}`);
      zipLabels.push(label);
      return `[${label}](${sourceUrl})`;
    }
    if (block.type === "divider") return "---";
    if (block.type === "callout") return `:::callout\n${[title, children].filter(Boolean).join("\n\n")}\n:::`;
    if (block.type === "sub_header") return [`## ${title}`, children].filter(Boolean).join("\n\n");
    if (block.type === "sub_sub_header") return [`### ${title}`, children].filter(Boolean).join("\n\n");
    if (block.type === "bulleted_list") return [`- ${title}`, children].filter(Boolean).join("\n");
    if (block.type === "numbered_list") return [`1. ${title}`, children].filter(Boolean).join("\n");
    if (block.type === "text" && !title && !children) return "\u200B";
    return [title, children].filter(Boolean).join("\n\n");
  }
  const title = rawTitleOf(page);
  const body = (page.content ?? []).map((id) => render(id)).filter(Boolean).join("\n\n");
  const markdown = [`# ${title}`, `> 원문. [Notion](${sourceUrl})`, body].join("\n\n");
  return { title, body, markdown, content: JSON.stringify(restoreLinkMarks(markdownToTiptapDoc(markdown))), codeLanguages, zipLabels };
}

function restoreLinkMarks(document) {
  function visit(node) {
    const link = node.marks?.find((mark) => mark.type === "link" && mark.attrs?.href === externalUrl);
    if (link && typeof node.text === "string" && node.text.startsWith("**") && node.text.endsWith("**")) {
      node.text = node.text.slice(2, -2);
      node.marks = [{ type: "bold" }, link];
    }
    for (const child of node.content ?? []) visit(child);
  }
  visit(document);
  return document;
}

function documentStats(content) {
  const stats = { links: [], codeBlocks: [], images: 0, callouts: 0, externalBoldLinks: 0 };
  function visit(node) {
    if (node.type === "codeBlock") stats.codeBlocks.push(node.attrs?.language ?? "");
    if (node.type === "image") stats.images += 1;
    if (node.type === "callout") stats.callouts += 1;
    for (const mark of node.marks ?? []) if (mark.type === "link" && mark.attrs?.href) {
      stats.links.push({ href: mark.attrs.href, text: node.text ?? "" });
      if (mark.attrs.href === externalUrl && node.marks?.some((candidate) => candidate.type === "bold")) stats.externalBoldLinks += 1;
    }
    for (const child of node.content ?? []) visit(child);
  }
  visit(JSON.parse(content));
  return stats;
}

function hasSource(content) {
  const value = String(content);
  return value.includes(sourceId) || value.includes(pageId);
}

function pageExists(rows, page) {
  return rows.some((row) => row.title === page.title || hasSource(row.content));
}

function verifyRows(rows, page) {
  const exactTitle = rows.filter((row) => row.title === page.title);
  const sourceMatches = rows.filter((row) => hasSource(row.content));
  const matching = rows.filter((row) => row.title === page.title || hasSource(row.content));
  const saved = exactTitle[0] ?? sourceMatches[0];
  const stats = saved ? documentStats(saved.content) : null;
  const fileLabelsPresent = [...fileLabels.values()].every((label) => String(saved?.content).includes(label));
  if (matching.length !== 1 || !saved || !stats || saved.content !== page.content || !String(saved.content).includes(sourceUrl) || !fileLabelsPresent || stats.codeBlocks.length !== 10 || !stats.codeBlocks.every((language) => language === "text" || language === "") || stats.images !== 0 || stats.callouts < 7 || unsafeStringCount(saved.content) !== 0 || stats.links.filter((link) => link.href === externalUrl).length !== 1 || stats.links.filter((link) => link.href === sourceUrl).length !== 3) throw new Error("저장 데이터 무결성 검증에 실패했습니다.");
  return { pages: matching.length, codes: stats.codeBlocks.length, images: stats.images, callouts: stats.callouts, zipLinks: 2, externalLinks: 1, sources: 1, unsafeStrings: 0 };
}

function importLocal(page) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pagesInserted: 0, pagesSkipped: 0 };
  db.transaction(() => {
    const rows = db.prepare("SELECT title, content FROM custom_pages WHERE user_id = ?").all(localUser);
    if (pageExists(rows, page)) result.pagesSkipped += 1;
    else {
      const now = new Date().toISOString();
      db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run(randomUUID(), localUser, page.title, page.content, now, now);
      result.pagesInserted += 1;
    }
  })();
  db.close();
  return result;
}

async function allRows(query) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query.range(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

async function importProduction(page, supabase) {
  const result = { pagesInserted: 0, pagesSkipped: 0 };
  const rows = await allRows(supabase.from("custom_pages").select("title, content").eq("user_id", productionUser));
  if (pageExists(rows, page)) result.pagesSkipped += 1;
  else {
    const now = new Date().toISOString();
    const { error } = await supabase.from("custom_pages").insert({ id: randomUUID(), user_id: productionUser, title: page.title, content: page.content, created_at: now, updated_at: now });
    if (error) throw error;
    result.pagesInserted += 1;
  }
  return result;
}

const { blocks, page: sourcePage, requestCount } = await collectBlocks();
const sourceInvariant = assertSourceInvariant(blocks, sourcePage, requestCount);
const page = documentFrom(blocks, sourcePage);
const sourceStats = documentStats(page.content);
const fileLabelsPresent = [...fileLabels.values()].every((label) => page.markdown.includes(label) && page.content.includes(label));
const expectedZipLabels = new Set(fileLabels.values());
const zipLabelsMatch = page.zipLabels.length === expectedZipLabels.size && new Set(page.zipLabels).size === expectedZipLabels.size && page.zipLabels.every((label) => expectedZipLabels.has(label));
if (page.title !== "김효율 스킬팩" || page.codeLanguages.length !== 10 || !page.codeLanguages.every((language) => language === "text" || language === "") || !zipLabelsMatch || sourceStats.codeBlocks.length !== 10 || !sourceStats.codeBlocks.every((language) => language === "text" || language === "") || sourceStats.images !== 0 || sourceStats.callouts < 7 || sourceStats.links.filter((link) => link.href === externalUrl).length !== 1 || sourceStats.externalBoldLinks !== 1 || sourceStats.links.filter((link) => link.href === sourceUrl).length !== 3 || !page.markdown.includes(licenseContact) || !page.content.includes(licenseContact) || !page.content.includes(sourceUrl) || !fileLabelsPresent || unsafeStringCount(page.markdown) !== 0 || unsafeStringCount(page.content) !== 0) throw new Error("원문 변환 무결성 검증에 실패했습니다.");

if (process.argv.includes("--check")) {
  console.log(JSON.stringify({ title: page.title, total: sourceInvariant.total, rootDirectChildren: sourceInvariant.rootChildren, typeCounts: sourceInvariant.types, requestCount: sourceInvariant.requestCount, codeBlocks: sourceStats.codeBlocks.length, codeLanguages: sourceStats.codeBlocks, images: sourceStats.images, callouts: sourceStats.callouts, zipLinks: page.zipLabels, externalLinks: sourceStats.links.filter((link) => link.href === externalUrl).length, externalBoldLinks: sourceStats.externalBoldLinks, sourceLinks: sourceStats.links.filter((link) => link.href === sourceUrl).length, licenseContact: page.content.includes(licenseContact), unsafeStrings: unsafeStringCount(page.content), writes: 0 }, null, 2));
  process.exit(0);
}

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) if (!process.env[key]) throw new Error(`필수 환경변수 누락: ${key}`);
const local = importLocal(page);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const production = await importProduction(page, supabase);
const localDb = new Database(resolve(root, "data/mymark.db"), { readonly: true });
const localVerification = verifyRows(localDb.prepare("SELECT title, content FROM custom_pages WHERE user_id = ?").all(localUser), page);
localDb.close();
const productionVerification = verifyRows(await allRows(supabase.from("custom_pages").select("title, content").eq("user_id", productionUser)), page);
console.log(JSON.stringify({ local, production, verify: { local: localVerification, production: productionVerification } }, null, 2));
