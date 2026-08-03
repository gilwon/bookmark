// 비블 유튜브 자료 3개를 Pages에 저장하고 프롬프트 자료 2개를 Prompts에 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localUser = "dev";
const productionUser = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const sources = [
  {
    id: "34c0b198-7de9-808d-a3f5-db88539100d6",
    source: "https://app.notion.com/p/34c0b1987de9808da3f5db88539100d6",
    category: "비블 유튜브 전략",
    summary: "유튜브 경쟁 채널의 제목·썸네일 패턴을 분석하는 프롬프트입니다.",
    whenToUse: "경쟁 채널의 영상 제목과 썸네일 패턴을 분석할 때 사용하세요.",
  },
  {
    id: "34c0b198-7de9-80f1-86e6-faadb56e19b5",
    source: "https://app.notion.com/p/34c0b1987de980f186e6faadb56e19b5",
    category: "비블 유튜브 대본",
    summary: "스토리브랜드 7단계로 몰입형 유튜브 대본을 작성하는 프롬프트입니다.",
    whenToUse: "유튜브 영상 주제와 타깃에 맞는 대본을 작성할 때 사용하세요.",
  },
  {
    id: "34c0b198-7de9-8088-8734-dfe500e6f8df",
    source: "https://app.notion.com/p/34c0b1987de980888734dfe500e6f8df",
  },
];

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

function richText(value) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((fragment) => {
      if (typeof fragment === "string") return fragment;
      if (!Array.isArray(fragment)) return "";
      return typeof fragment[0] === "string" ? fragment[0] : richText(fragment);
    })
    .join("");
}

function titleOf(block) {
  return richText(block?.properties?.title);
}

function linkOf(block) {
  return block?.format?.display_source || block?.properties?.source?.[0]?.[0] || "";
}

function tableMarkdown(block, getBlock) {
  const rows = (block.content ?? []).map((rowId) => getBlock(rowId)).filter(Boolean).map((row) =>
    (row.content ?? []).map((cellId) => {
      const cell = getBlock(cellId);
      return (titleOf(cell) || titleOf(getBlock(cell?.content?.[0])) || "")
        .replace(/\|/g, "\\|")
        .replace(/\n/g, " ")
        .trim();
    })
  );
  if (!rows.length) return "";
  const width = Math.max(...rows.map((row) => row.length), 1);
  return rows.map((row, rowIndex) => {
    const cells = Array.from({ length: width }, (_, index) => row[index] ?? "");
    return `| ${cells.join(" | ")} |${rowIndex === 0 ? `\n| ${cells.map(() => "---").join(" | ")} |` : ""}`;
  }).join("\n");
}

async function fetchDocument(source) {
  const response = await fetch("https://www.notion.so/api/v3/loadPageChunk", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "user-agent": "Mozilla/5.0" },
    body: JSON.stringify({
      pageId: source.id,
      limit: 999999,
      cursor: { stack: [] },
      chunkNumber: 0,
      verticalColumns: false,
    }),
  });
  if (!response.ok) throw new Error(`Notion HTTP ${response.status}: ${source.id}`);
  const chunk = await response.json();
  const blocks = new Map(
    Object.values(chunk.recordMap?.block ?? {})
      .map((record) => record.value?.value)
      .filter(Boolean)
      .map((block) => [block.id, block])
  );
  const page = blocks.get(source.id);
  if (!page) throw new Error(`Notion 페이지를 찾지 못했습니다: ${source.id}`);

  function render(id, path = new Set()) {
    const block = blocks.get(id);
    if (!block || path.has(id)) return "";
    const nextPath = new Set(path).add(id);
    const children = (block.content ?? [])
      .map((childId) => render(childId, nextPath))
      .filter(Boolean)
      .join("\n\n");
    const title = titleOf(block);
    const type = block.type;
    if (type === "divider") return "---";
    if (type === "quote") return `> ${[title, children].filter(Boolean).join("\n")}`;
    if (["bulleted_list", "bulleted_list_item"].includes(type)) return `- ${title}${children ? `\n${children}` : ""}`.trim();
    if (["numbered_list", "numbered_list_item"].includes(type)) return `1. ${title}${children ? `\n${children}` : ""}`.trim();
    if (["header", "header_1"].includes(type)) return [`# ${title}`, children].filter(Boolean).join("\n\n");
    if (type === "header_2") return [`## ${title}`, children].filter(Boolean).join("\n\n");
    if (type === "sub_header") return [`### ${title}`, children].filter(Boolean).join("\n\n");
    if (type === "sub_sub_header") return [`#### ${title}`, children].filter(Boolean).join("\n\n");
    if (type === "table") return tableMarkdown(block, blocks.get.bind(blocks));
    if (type === "code") return `\`\`\`${richText(block.properties?.language)}\n${title}\n\`\`\``;
    if (["image", "file", "bookmark", "video", "embed", "link_preview"].includes(type)) {
      const url = linkOf(block);
      return [url ? `[${title || "Notion 첨부"}](${url})` : title, children].filter(Boolean).join("\n\n");
    }
    return [title, children].filter(Boolean).join("\n\n");
  }

  const body = (page.content ?? []).map((id) => render(id)).filter(Boolean).join("\n\n");
  return {
    ...source,
    title: titleOf(page),
    body,
    markdown: [`# ${titleOf(page)}`, `> 원문. [Notion](${source.source})`, body].join("\n\n"),
  };
}

const documents = await Promise.all(sources.map(fetchDocument));
const pages = documents.map((document) => ({
  title: document.title,
  content: JSON.stringify(markdownToTiptapDoc(document.markdown)),
}));
const prompts = documents.filter((document) => document.category).map((document) => ({
  title: document.title,
  category: document.category,
  summary: document.summary,
  when_to_use: document.whenToUse,
  sections: JSON.stringify([
    { title: "프롬프트", body: document.body },
    { title: "관련 Page", body: document.title },
    { title: "원문 Notion", body: document.source },
  ]),
  body: document.body,
}));

if (pages.length !== 3 || prompts.length !== 2 || pages.some((page) => !page.title || !page.content) || prompts.some((prompt) => prompt.body.length < 100)) {
  throw new Error(`가져올 자료가 올바르지 않습니다. pages=${pages.length}, prompts=${prompts.length}`);
}

if (process.argv.includes("--check")) {
  console.log({
    pages: documents.map(({ title, body }) => ({ title, characters: body.length })),
    prompts: prompts.map(({ title, body }) => ({ title, characters: body.length })),
  });
  process.exit(0);
}

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[key]) throw new Error(`필수 환경변수 누락: ${key}`);
}

const now = new Date().toISOString();
function importLocal() {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pages: 0, pageUpdates: 0, pageSkips: 0, prompts: 0, promptUpdates: 0, promptSkips: 0 };
  const transaction = db.transaction(() => {
    const findPage = db.prepare("SELECT id, content FROM custom_pages WHERE user_id = ? AND title = ?");
    const insertPage = db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
    const updatePage = db.prepare("UPDATE custom_pages SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?");
    const findPrompt = db.prepare("SELECT id, summary, when_to_use, sections FROM prompts WHERE user_id = ? AND title = ? AND category = ?");
    const insertPrompt = db.prepare("INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)");
    const updatePrompt = db.prepare("UPDATE prompts SET summary = ?, when_to_use = ?, sections = ?, updated_at = ? WHERE id = ? AND user_id = ?");
    for (const page of pages) {
      const existing = findPage.get(localUser, page.title);
      if (!existing) { insertPage.run(randomUUID(), localUser, page.title, page.content, now, now); result.pages += 1; }
      else if (existing.content !== page.content) { updatePage.run(page.content, now, existing.id, localUser); result.pageUpdates += 1; }
      else result.pageSkips += 1;
    }
    for (const prompt of prompts) {
      const existing = findPrompt.get(localUser, prompt.title, prompt.category);
      if (!existing) { insertPrompt.run(randomUUID(), localUser, prompt.title, prompt.category, prompt.summary, prompt.when_to_use, prompt.sections, now, now); result.prompts += 1; }
      else if (existing.summary !== prompt.summary || existing.when_to_use !== prompt.when_to_use || existing.sections !== prompt.sections) { updatePrompt.run(prompt.summary, prompt.when_to_use, prompt.sections, now, existing.id, localUser); result.promptUpdates += 1; }
      else result.promptSkips += 1;
    }
  });
  transaction();
  db.close();
  return result;
}

async function importProduction() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const result = { pages: 0, pageUpdates: 0, pageSkips: 0, prompts: 0, promptUpdates: 0, promptSkips: 0 };
  for (const page of pages) {
    const { data, error } = await supabase.from("custom_pages").select("id, content").eq("user_id", productionUser).eq("title", page.title).limit(1);
    if (error) throw error;
    const existing = data?.[0];
    if (!existing) { const { error: insertError } = await supabase.from("custom_pages").insert({ id: randomUUID(), user_id: productionUser, title: page.title, content: page.content, created_at: now, updated_at: now }); if (insertError) throw insertError; result.pages += 1; }
    else if (existing.content !== page.content) { const { error: updateError } = await supabase.from("custom_pages").update({ content: page.content, updated_at: now }).eq("id", existing.id).eq("user_id", productionUser); if (updateError) throw updateError; result.pageUpdates += 1; }
    else result.pageSkips += 1;
  }
  for (const prompt of prompts) {
    const { data, error } = await supabase.from("prompts").select("id, summary, when_to_use, sections").eq("user_id", productionUser).eq("title", prompt.title).eq("category", prompt.category).limit(1);
    if (error) throw error;
    const existing = data?.[0];
    if (!existing) { const { error: insertError } = await supabase.from("prompts").insert({ id: randomUUID(), user_id: productionUser, title: prompt.title, category: prompt.category, summary: prompt.summary, when_to_use: prompt.when_to_use, sections: prompt.sections, is_favorite: 0, created_at: now, updated_at: now }); if (insertError) throw insertError; result.prompts += 1; }
    else if (existing.summary !== prompt.summary || existing.when_to_use !== prompt.when_to_use || existing.sections !== prompt.sections) { const { error: updateError } = await supabase.from("prompts").update({ summary: prompt.summary, when_to_use: prompt.when_to_use, sections: prompt.sections, updated_at: now }).eq("id", existing.id).eq("user_id", productionUser); if (updateError) throw updateError; result.promptUpdates += 1; }
    else result.promptSkips += 1;
  }
  return result;
}

console.log({ local: importLocal(), production: await importProduction() });
