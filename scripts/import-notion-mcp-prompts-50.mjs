// 플러그인·MCP 실무 프롬프트 50개 Notion 원문을 Pages와 Prompts에 중복 없이 저장한다
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceUrl = "https://exultant-principle-9c5.notion.site/MCP-50-3b791cb23c4d81d9b3a6ca2373d61606";
const pageId = "3b791cb2-3c4d-81d9-b3a6-ca2373d61606";
const endpoint = "https://www.notion.so/api/v3/loadPageChunk";
const category = "Notion · 플러그인·MCP 실무 프롬프트 50개";
const localUser = "dev";
const productionUser = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const bookmarkLinks = new Map([
  ["https://open.kakao.com/o/gvD2nbhg", "누끼토끼 웹 빌더 커뮤니티"],
  ["https://www.instagram.com/nookitokki/", "누끼토끼(최한비) | 홈페이지 • AI 솔루션 (@nookitokki)"],
]);
const retryDelays = [15000, 30000, 60000];
let lastRequestAt = 0;

const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^("|')|("|')$/g, "");
  }
}

const require = createRequire(import.meta.url);
const tsx = require("tsx/cjs/api");
tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
const { markdownToTiptapDoc } = require(resolve(root, "src/lib/markdown-to-tiptap.ts"));

const pause = (milliseconds) => new Promise((done) => setTimeout(done, milliseconds));

function plainText(value) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map((fragment) => {
    if (typeof fragment === "string") return fragment;
    if (!Array.isArray(fragment)) return "";
    return typeof fragment[0] === "string" ? fragment[0] : plainText(fragment);
  }).join("");
}

function inlineMarkdown(value) {
  if (!Array.isArray(value)) return plainText(value);
  return value.map((fragment) => {
    if (typeof fragment === "string") return fragment;
    if (!Array.isArray(fragment)) return "";
    const text = typeof fragment[0] === "string" ? fragment[0] : plainText(fragment);
    const marks = Array.isArray(fragment[1]) ? fragment[1] : [];
    const link = marks.find((mark) => Array.isArray(mark) && mark[0] === "a" && mark[1]);
    if (link) return `[${text}](${link[1]})`;
    let result = text.replace(/https?:\/\/[^\s<>()]+/g, (url) => `[${url}](${url})`);
    for (const mark of marks) {
      if (!Array.isArray(mark)) continue;
      if (mark[0] === "b") result = `**${result}**`;
      if (mark[0] === "i") result = `*${result}*`;
      if (mark[0] === "c") result = `\`${result}\``;
      if (mark[0] === "s") result = `~~${result}~~`;
    }
    return result;
  }).join("");
}

function titleOf(block) {
  return inlineMarkdown(block?.properties?.title).trim();
}

function languageOf(block) {
  return plainText(block?.properties?.language) || block?.format?.code_language || "text";
}

function urlOf(block) {
  const propertyLink = plainText(block?.properties?.link);
  if (propertyLink) return propertyLink;
  for (const value of [block?.properties?.link, block?.format?.link, block?.format?.original_url]) {
    if (typeof value === "string" && value) return value;
  }
  return JSON.stringify(block ?? {}).match(/https?:\/\/[^"\\\s]+/)?.[0]?.replace(/[),.;]+$/, "") ?? "";
}

async function requestChunk(id) {
  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < 1200) await pause(1200 - elapsed);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "user-agent": "Mozilla/5.0" },
      body: JSON.stringify({ pageId: id, limit: 999999, cursor: { stack: [] }, chunkNumber: 0, verticalColumns: false }),
    });
    lastRequestAt = Date.now();
    if (response.ok) return response.json();
    if (![429, 503].includes(response.status)) throw new Error(`Notion HTTP ${response.status} (${id})`);
    if (attempt === retryDelays.length) throw new Error(`Notion HTTP ${response.status} 재시도 한도 초과 (${id})`);
    await pause(retryDelays[attempt]);
  }
  throw new Error(`Notion 요청 실패: ${id}`);
}

async function collectBlocks() {
  const blocks = new Map();
  const queue = [pageId];
  const requested = new Set();
  while (queue.length) {
    const id = queue.shift();
    if (requested.has(id)) continue;
    const chunk = await requestChunk(id);
    requested.add(id);
    for (const [blockId, record] of Object.entries(chunk.recordMap?.block ?? {})) {
      if (record.value?.value) blocks.set(blockId, record.value.value);
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
  const rendered = new Set([pageId]);
  const prompts = [];
  let currentPromptTitle = "";
  function render(id, path = new Set()) {
    const block = blocks.get(id);
    if (!block || path.has(id)) return "";
    rendered.add(id);
    const nextPath = new Set(path).add(id);
    const title = titleOf(block);
    const children = (block.content ?? []).map((childId) => render(childId, nextPath)).filter(Boolean).join("\n\n");
    if (block.type === "code") {
      const body = plainText(block.properties?.title).replace(/\r\n/g, "\n").trim();
      if (!currentPromptTitle || !body) throw new Error("sub_header 뒤의 프롬프트 코드가 비어 있습니다.");
      prompts.push({ heading: currentPromptTitle, body });
      return `\`\`\`${languageOf(block)}\n${body}\n\`\`\``;
    }
    if (block.type === "divider") return "---";
    if (block.type === "table_of_contents") return "";
    if (block.type === "bookmark") {
      const url = urlOf(block);
      return url ? `[${title || bookmarkLinks.get(url) || "Notion 북마크"}](${url})` : title;
    }
    if (block.type === "callout") return `:::callout\n${[title, children].filter(Boolean).join("\n\n")}\n:::`;
    if (block.type === "header" || block.type === "header_1") return [`# ${title}`, children].filter(Boolean).join("\n\n");
    if (block.type === "sub_header") return [`## ${title}`, children].filter(Boolean).join("\n\n");
    if (block.type === "sub_sub_header") return [`### ${title}`, children].filter(Boolean).join("\n\n");
    if (block.type === "bulleted_list") return [`- ${title}`, children].filter(Boolean).join("\n");
    if (block.type === "numbered_list") return [`1. ${title}`, children].filter(Boolean).join("\n");
    if (block.type === "text" && !title && !children) return "\u200B";
    return [title, children].filter(Boolean).join("\n\n");
  }
  const body = [];
  for (const id of page.content ?? []) {
    const block = blocks.get(id);
    if (block?.type === "sub_header") currentPromptTitle = plainText(block.properties?.title).trim();
    body.push(render(id));
  }
  const title = plainText(page.properties?.title).trim();
  const markdown = [`# ${title}`, `> 원문. [Notion](${sourceUrl})`, body.filter(Boolean).join("\n\n")].join("\n\n");
  return { title, body: body.filter(Boolean).join("\n\n"), content: JSON.stringify(markdownToTiptapDoc(markdown)), prompts, renderedBlocks: rendered.size };
}

function promptRows(document) {
  return document.prompts.map((prompt, index) => ({
    title: `${String(index + 1).padStart(2, "0")}. ${prompt.heading}`,
    category,
    summary: `${prompt.heading}에 쓰는 재사용 프롬프트입니다.`,
    when_to_use: `${prompt.heading} 작업이 필요할 때 사용하세요.`,
    sections: JSON.stringify([
      { title: "프롬프트", body: prompt.body },
      { title: "관련 Page", body: document.title },
      { title: "원본 Notion", body: sourceUrl },
    ]),
  }));
}

function fingerprint(content) {
  return createHash("sha256").update(content).digest("hex");
}

function promptBody(sections) {
  try { return JSON.parse(sections).find((section) => section.title === "프롬프트")?.body ?? ""; } catch { return ""; }
}

function normalize(value) {
  return value.replace(/\s+/g, " ").trim();
}

function pageExists(rows, record) {
  return rows.some((row) => row.title === record.title || fingerprint(row.content) === record.fingerprint);
}

function promptExists(rows, prompt) {
  const body = normalize(promptBody(prompt.sections));
  return rows.some((row) => (row.title === prompt.title && row.category === prompt.category) || (body && normalize(promptBody(row.sections)) === body));
}

function documentStats(content) {
  const stats = { images: 0, links: [] };
  function visit(node) {
    if (node.type === "image") stats.images += 1;
    for (const mark of node.marks ?? []) if (mark.type === "link" && mark.attrs?.href) stats.links.push({ href: mark.attrs.href, text: node.text ?? "" });
    for (const child of node.content ?? []) visit(child);
  }
  visit(JSON.parse(content));
  return stats;
}

function verifyRows(pages, prompts, record) {
  const page = pages.find((row) => row.title === record.title);
  const stats = page ? documentStats(page.content) : null;
  const matching = record.prompts.filter((prompt) => promptExists(prompts, prompt));
  const uniqueBodies = new Set(matching.map((prompt) => normalize(promptBody(prompt.sections))));
  const labelsPreserved = [...bookmarkLinks].every(([href, text]) => stats?.links.some((link) => link.href === href && link.text === text));
  if (!page || page.content !== record.content || !stats || stats.images !== 0 || stats.links.length !== 3 || !stats.links.some((link) => link.href === sourceUrl) || !labelsPreserved || matching.length !== 50 || uniqueBodies.size !== 50) throw new Error("저장 데이터 무결성 검증에 실패했습니다.");
  return { pages: 1, prompts: matching.length, images: stats.images, bookmarks: 2, links: stats.links.length, toggles: 0, sources: 1 };
}

function importLocal(record) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pagesInserted: 0, pagesSkipped: 0, promptsInserted: 0, promptsSkipped: 0 };
  db.transaction(() => {
    const pages = db.prepare("SELECT title, content FROM custom_pages WHERE user_id = ?").all(localUser);
    const prompts = db.prepare("SELECT title, category, sections FROM prompts WHERE user_id = ?").all(localUser);
    const insertPage = db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
    const insertPrompt = db.prepare("INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)");
    const now = new Date().toISOString();
    if (pageExists(pages, record)) result.pagesSkipped += 1;
    else { insertPage.run(randomUUID(), localUser, record.title, record.content, now, now); pages.push(record); result.pagesInserted += 1; }
    for (const prompt of record.prompts) {
      if (promptExists(prompts, prompt)) result.promptsSkipped += 1;
      else { insertPrompt.run(randomUUID(), localUser, prompt.title, prompt.category, prompt.summary, prompt.when_to_use, prompt.sections, now, now); prompts.push(prompt); result.promptsInserted += 1; }
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

async function importProduction(record, supabase) {
  const result = { pagesInserted: 0, pagesSkipped: 0, promptsInserted: 0, promptsSkipped: 0 };
  const pages = await allRows(supabase.from("custom_pages").select("title, content").eq("user_id", productionUser));
  const prompts = await allRows(supabase.from("prompts").select("title, category, sections").eq("user_id", productionUser));
  const now = new Date().toISOString();
  if (pageExists(pages, record)) result.pagesSkipped += 1;
  else {
    const { error } = await supabase.from("custom_pages").insert({ id: randomUUID(), user_id: productionUser, title: record.title, content: record.content, created_at: now, updated_at: now });
    if (error) throw error;
    result.pagesInserted += 1;
  }
  for (const prompt of record.prompts) {
    if (promptExists(prompts, prompt)) result.promptsSkipped += 1;
    else {
      const { error } = await supabase.from("prompts").insert({ id: randomUUID(), user_id: productionUser, title: prompt.title, category: prompt.category, summary: prompt.summary, when_to_use: prompt.when_to_use, sections: prompt.sections, is_favorite: 0, created_at: now, updated_at: now });
      if (error) throw error;
      result.promptsInserted += 1;
    }
  }
  return result;
}

const { blocks, page, requestCount } = await collectBlocks();
const document = documentFrom(blocks, page);
const record = { ...document, fingerprint: fingerprint(document.content), prompts: promptRows(document) };
const sourceStats = documentStats(record.content);
const toggleCount = [...blocks.values()].filter((block) => block.type === "toggle" || block.format?.toggleable).length;
const typeCounts = Object.fromEntries(Object.entries(Object.groupBy([...blocks.values()], (block) => block.type)).map(([type, values]) => [type, values.length]));
const labelsPreserved = [...bookmarkLinks].every(([href, text]) => sourceStats.links.some((link) => link.href === href && link.text === text));
if (blocks.size !== 122 || page.content.length !== 118 || document.renderedBlocks !== 122 || record.title !== "플러그인·MCP 실무 프롬프트 50개" || typeCounts.callout !== 3 || typeCounts.header !== 9 || typeCounts.sub_header !== 50 || typeCounts.code !== 50 || typeCounts.bookmark !== 2 || record.prompts.length !== 50 || new Set(record.prompts.map((prompt) => normalize(promptBody(prompt.sections)))).size !== 50 || toggleCount !== 0 || sourceStats.images !== 0 || sourceStats.links.length !== 3 || !sourceStats.links.some((link) => link.href === sourceUrl) || !labelsPreserved) throw new Error("원문 변환 무결성 검증에 실패했습니다.");

if (process.argv.includes("--check")) {
  console.log(JSON.stringify({ title: record.title, blocks: blocks.size, rootChildren: page.content.length, renderedBlocks: document.renderedBlocks, prompts: record.prompts.length, bookmarks: 2, links: sourceStats.links.length, images: sourceStats.images, toggles: toggleCount, sources: 1, requestCount }, null, 2));
  process.exit(0);
}

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) if (!process.env[key]) throw new Error(`필수 환경변수 누락: ${key}`);
const local = importLocal(record);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const production = await importProduction(record, supabase);
const localDb = new Database(resolve(root, "data/mymark.db"), { readonly: true });
const localVerification = verifyRows(localDb.prepare("SELECT title, content FROM custom_pages WHERE user_id = ?").all(localUser), localDb.prepare("SELECT title, category, sections FROM prompts WHERE user_id = ?").all(localUser), record);
localDb.close();
const productionVerification = verifyRows(await allRows(supabase.from("custom_pages").select("title, content").eq("user_id", productionUser)), await allRows(supabase.from("prompts").select("title, category, sections").eq("user_id", productionUser)), record);
console.log(JSON.stringify({ local, production, verify: { local: localVerification, production: productionVerification } }, null, 2));
