// 그래프 엔지니어링 Notion 원문을 Pages와 Prompts에 중복 없이 저장한다
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const endpoint = "https://www.notion.so/api/v3/loadPageChunk";
const source = {
  id: "3b5d85dc-2875-80b4-b259-f036d6360c85",
  url: "https://app.notion.com/p/3b5d85dc287580b4b259f036d6360c85?source=copy_link",
};
const coverUrl = "https://www.notion.so/images/page-cover/usda_cherries.png";
const localUser = "dev";
const productionUser = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const requiredLinks = [source.url, "https://app.litt.ly/page", "https://open.kakao.com/o/gtvDJTFi"];
const linkLabels = new Map([
  ["https://app.litt.ly/page", "리틀리｜올인원 프로필링크"],
  ["https://open.kakao.com/o/gtvDJTFi", "AI 변화, 안하루와 함께 따라가볼까요?"],
]);

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
    if (link) return `[${linkLabels.get(link[1]) ?? text}](${link[1]})`;
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

function tableMarkdown(block, blocks) {
  const columns = block.format?.table_block_column_order ?? [];
  const rows = (block.content ?? []).map((id) => {
    const row = blocks.get(id);
    return columns.map((column) => inlineMarkdown(row?.properties?.[column]).replace(/\|/g, "\\|").replace(/\n/g, " "));
  });
  if (!rows.length) return "";
  return rows.map((cells, index) => {
    const row = `| ${cells.join(" | ")} |`;
    return index === 0 ? `${row}\n| ${cells.map(() => "---").join(" | ")} |` : row;
  }).join("\n");
}

async function loadBlocks() {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "user-agent": "Mozilla/5.0" },
    body: JSON.stringify({ pageId: source.id, limit: 999999, cursor: { stack: [] }, chunkNumber: 0, verticalColumns: false }),
  });
  if (!response.ok) throw new Error(`Notion HTTP ${response.status}`);
  const chunk = await response.json();
  const blocks = new Map(Object.entries(chunk.recordMap?.block ?? {}).flatMap(([id, record]) => {
    const block = record?.value?.value;
    return block ? [[id, block]] : [];
  }));
  const page = blocks.get(source.id);
  if (!page) throw new Error("Notion 페이지를 찾지 못했습니다.");
  const missingChildren = (page.content ?? []).filter((id) => !blocks.has(id));
  if (missingChildren.length) throw new Error(`루트 하위 블록 누락: ${missingChildren.length}개`);
  if ((page.content ?? []).length !== 35) throw new Error(`루트 하위 블록 수 불일치: ${(page.content ?? []).length}개`);
  return { blocks, page };
}

async function coverDataUrl() {
  const response = await fetch(coverUrl, {
    headers: {
      accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      referer: "https://www.notion.so/",
      "user-agent": "Mozilla/5.0",
    },
  });
  if (!response.ok) throw new Error(`Notion 커버 HTTP ${response.status}`);
  const type = response.headers.get("content-type")?.split(";")[0] || "image/png";
  if (!type.startsWith("image/")) throw new Error(`Notion 커버 형식 오류: ${type}`);
  return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
}

function documentFrom(blocks, page, cover) {
  const codeBlocks = [];
  let renderedBlocks = 1;
  function render(id, path = new Set()) {
    const block = blocks.get(id);
    if (!block || path.has(id)) return "";
    renderedBlocks += 1;
    const nextPath = new Set(path).add(id);
    const title = titleOf(block);
    const children = (block.content ?? []).map((childId) => render(childId, nextPath)).filter(Boolean).join("\n\n");
    if (block.type === "code") {
      const body = plainText(block.properties?.title).trim();
      codeBlocks.push(body);
      return `\`\`\`${languageOf(block)}\n${body}\n\`\`\``;
    }
    if (block.type === "divider") return "---";
    if (block.type === "table") return tableMarkdown(block, blocks);
    if (block.type === "table_row") return "";
    if (block.type === "header" || block.type === "header_1") return [`# ${title}`, children].filter(Boolean).join("\n\n");
    if (block.type === "sub_header") return [`## ${title}`, children].filter(Boolean).join("\n\n");
    if (block.type === "bulleted_list") return [`- ${title}`, children].filter(Boolean).join("\n");
    if (block.type === "numbered_list") return [`1. ${title}`, children].filter(Boolean).join("\n");
    if (block.type === "text" && !title && !children) return "\u200B";
    return [title, children].filter(Boolean).join("\n\n");
  }
  const title = plainText(page.properties?.title).trim();
  const body = (page.content ?? []).map((id) => render(id)).filter(Boolean).join("\n\n");
  const markdown = [`# ${title}`, `> 원문. [Notion](${source.url})`, `![Notion 커버](${cover})`, body].join("\n\n");
  if (codeBlocks.length !== 3) throw new Error(`코드 블록 수 불일치: ${codeBlocks.length}개`);
  if (renderedBlocks !== 41) throw new Error(`본문 블록 수 불일치: ${renderedBlocks}개`);
  return { title, body, content: JSON.stringify(markdownToTiptapDoc(markdown)), codeBlocks, renderedBlocks };
}

function promptRows(document) {
  const bodies = document.codeBlocks;
  return bodies.map((body, index) => ({
    title: `${document.title} · 프롬프트 ${String(index + 1).padStart(2, "0")}`,
    category: `Notion · ${document.title}`,
    summary: "Notion 원문에서 복사해 재사용하는 프롬프트입니다.",
    when_to_use: "그래프 엔지니어링 방식의 작업을 AI에게 요청할 때 사용하세요.",
    sections: JSON.stringify([
      { title: "프롬프트", body },
      { title: "관련 Page", body: document.title },
      { title: "원문 Notion URL", body: source.url },
    ]),
  }));
}

function fingerprint(content) {
  return createHash("sha256").update(content).digest("hex");
}

function promptBody(sections) {
  try {
    return JSON.parse(sections).find((section) => section.title === "프롬프트")?.body ?? "";
  } catch {
    return "";
  }
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
  const document = JSON.parse(content);
  const stats = { images: 0, tables: 0, links: [] };
  function visit(node) {
    if (node.type === "image") stats.images += 1;
    if (node.type === "table") stats.tables += 1;
    for (const mark of node.marks ?? []) if (mark.type === "link" && mark.attrs?.href) stats.links.push({ href: mark.attrs.href, text: node.text ?? "" });
    for (const child of node.content ?? []) visit(child);
  }
  visit(document);
  return stats;
}

function verifyRows(pages, prompts, record) {
  const page = pages.find((row) => row.title === record.title);
  const stats = page ? documentStats(page.content) : null;
  const matchingPrompts = record.prompts.filter((prompt) => promptExists(prompts, prompt));
  const uniqueBodies = new Set(matchingPrompts.map((prompt) => normalize(promptBody(prompt.sections))));
  if (!page || page.content !== record.content || !stats || stats.images !== 1 || stats.tables !== 1 || !page.content.includes(source.url) || !page.content.includes("data:image/") || !requiredLinks.every((href) => stats.links.some((link) => link.href === href)) || ![...linkLabels].every(([href, text]) => stats.links.some((link) => link.href === href && link.text === text)) || matchingPrompts.length !== 3 || uniqueBodies.size !== 3) {
    throw new Error("저장 데이터 무결성 검증에 실패했습니다.");
  }
  return { pages: 1, prompts: matchingPrompts.length, images: stats.images, tables: stats.tables, sources: 1, links: stats.links.length, hrefs: requiredLinks, labels: Object.fromEntries(linkLabels) };
}

function importLocal(record) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pagesInserted: 0, pagesSkipped: 0, promptsInserted: 0, promptsSkipped: 0 };
  const transaction = db.transaction(() => {
    const pages = db.prepare("SELECT title, content FROM custom_pages WHERE user_id = ?").all(localUser);
    const prompts = db.prepare("SELECT title, category, sections FROM prompts WHERE user_id = ?").all(localUser);
    const insertPage = db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
    const insertPrompt = db.prepare("INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)");
    const now = new Date().toISOString();
    if (pageExists(pages, record)) result.pagesSkipped += 1;
    else {
      insertPage.run(randomUUID(), localUser, record.title, record.content, now, now);
      pages.push(record);
      result.pagesInserted += 1;
    }
    for (const prompt of record.prompts) {
      if (promptExists(prompts, prompt)) result.promptsSkipped += 1;
      else {
        insertPrompt.run(randomUUID(), localUser, prompt.title, prompt.category, prompt.summary, prompt.when_to_use, prompt.sections, now, now);
        prompts.push(prompt);
        result.promptsInserted += 1;
      }
    }
  });
  transaction();
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

const { blocks, page } = await loadBlocks();
const document = documentFrom(blocks, page, await coverDataUrl());
const record = { ...document, fingerprint: fingerprint(document.content), prompts: promptRows(document) };
const sourceStats = documentStats(record.content);
const toggles = [...blocks.values()].filter((block) => block.type === "toggle" || block.format?.toggleable).length;
if (sourceStats.images !== 1 || sourceStats.tables !== 1 || toggles !== 0 || !requiredLinks.every((href) => sourceStats.links.some((link) => link.href === href)) || ![...linkLabels].every(([href, text]) => sourceStats.links.some((link) => link.href === href && link.text === text)) || !record.content.includes("data:image/") || record.prompts.length !== 3) {
  throw new Error("원문 변환 무결성 검증에 실패했습니다.");
}

if (process.argv.includes("--check")) {
  console.log(JSON.stringify({ pages: 1, prompts: 3, images: 1, tables: 1, toggles, sources: 1, links: sourceStats.links.length, hrefs: requiredLinks, labels: Object.fromEntries(linkLabels), rootChildren: page.content.length, renderedBlocks: document.renderedBlocks, bodyCharacters: document.body.length }, null, 2));
  process.exit(0);
}

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[key]) throw new Error(`필수 환경변수 누락: ${key}`);
}

const local = importLocal(record);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const production = await importProduction(record, supabase);
const localDb = new Database(resolve(root, "data/mymark.db"), { readonly: true });
const localVerification = verifyRows(
  localDb.prepare("SELECT title, content FROM custom_pages WHERE user_id = ?").all(localUser),
  localDb.prepare("SELECT title, category, sections FROM prompts WHERE user_id = ?").all(localUser),
  record,
);
localDb.close();
const productionVerification = verifyRows(
  await allRows(supabase.from("custom_pages").select("title, content").eq("user_id", productionUser)),
  await allRows(supabase.from("prompts").select("title, category, sections").eq("user_id", productionUser)),
  record,
);
console.log(JSON.stringify({ local, production, verify: { local: localVerification, production: productionVerification } }, null, 2));
