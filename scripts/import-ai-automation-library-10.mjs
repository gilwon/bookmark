// AI 자동화 PDF 10건의 전문과 명시된 복사용 지시문을 번호순으로 저장한다
import { randomUUID } from "crypto";
import { execFileSync } from "child_process";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import { basename, dirname, resolve } from "path";
import { existsSync, readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const downloads = "/Users/gilwon/Downloads";
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^("|')|("|')$/g, "");
  }
}

const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const LOCAL_USER = "dev";
const baseTime = Date.now();
const documentNames = [
  ["3-01", "인스타그램 자동 발행 플레이북"],
  ["3-02", "스레드 자동화 플레이북"],
  ["3-03", "세금계산서 발행 자동화 플레이북"],
  ["3-04", "BYOK · 내 키로 만드는 원가 0 AI 앱"],
  ["3-05", "AI 세컨드브레인 플레이북"],
  ["3-06", "클로드 코드 완전 레퍼런스 (상) · 기초"],
  ["3-07", "클로드 코드 완전 레퍼런스 (하) · 심화"],
  ["3-08", "AI-Native 세계관"],
  ["3-09", "AI와 일하는 법 · 대화와 디버깅"],
  ["3-10", "SaaS 6블럭 커리큘럼"],
];
const expectedPrompts = { "3-01": 12, "3-02": 8, "3-03": 16, "3-04": 14, "3-05": 2, "3-06": 0, "3-07": 6, "3-08": 0, "3-09": 4, "3-10": 12 };
const documents = documentNames.map(([number, name], index) => {
  const filename = readdirSync(downloads).find((entry) => entry.startsWith(`${number}.`) && entry.endsWith(".pdf"));
  if (!filename) throw new Error(`${number} PDF를 찾지 못했습니다.`);
  return {
    number,
    title: `${number}. ${name}`,
    path: resolve(downloads, filename),
    createdAt: new Date(baseTime - index * 1000).toISOString(),
  };
});
const extracted = new Map(documents.map((document) => [document.number, execFileSync("pdftotext", ["-layout", document.path, "-"], { encoding: "utf8" })]));

const textNode = (text) => ({ type: "text", text });
const paragraph = (text) => ({ type: "paragraph", content: text ? [textNode(text)] : undefined });
function pageContent(document) {
  const pdfPages = extracted.get(document.number).split("\f").map((page) => page.trim()).filter(Boolean);
  const content = [
    { type: "heading", attrs: { level: 1 }, content: [textNode(document.title)] },
    { type: "blockquote", content: [paragraph(`원본 PDF. ${basename(document.path).normalize("NFC")}`)] },
  ];
  for (const [index, pdfPage] of pdfPages.entries()) {
    content.push({ type: "heading", attrs: { level: 2 }, content: [textNode(`${index + 1}쪽`)] });
    for (const block of pdfPage.split(/\n\s*\n/)) {
      const text = block.split("\n").map((line) => line.trim()).filter(Boolean).join(" ").replace(/\s{2,}/g, " ");
      if (text) content.push(paragraph(text));
    }
    if (index < pdfPages.length - 1) content.push({ type: "horizontalRule" });
  }
  return JSON.stringify({ type: "doc", content });
}

function extractPrompts(document) {
  const pattern = /AI에게 이렇게 시키세요\s+(?:베비투스랩\s+)?"([\s\S]*?)"\s*(?=\n(?:\s*\n|\f))/g;
  return [...extracted.get(document.number).matchAll(pattern)].map((match, index) => {
    const body = match[1].replace(/\f/g, " ").replace(/\s*베비투스랩\s*/g, " ").replace(/\s+/g, " ").trim();
    const label = body.replace(/[\n\r]/g, " ").slice(0, 42).trim();
    return {
      number: document.number,
      title: `${document.number}. ${String(index + 1).padStart(2, "0")} · ${label}`,
      category: `AI 자동화 · ${document.number}`,
      summary: `${body.slice(0, 110).trim()}${body.length > 110 ? "…" : ""}`,
      when: "해당 업무를 AI에 맡길 때 원문의 값과 경로를 내 환경에 맞게 바꿔 사용하세요.",
      body,
      createdAt: new Date(baseTime - index * 1000).toISOString(),
    };
  });
}

const pages = documents.map((document) => ({ ...document, content: pageContent(document) }));
const prompts = documents.flatMap(extractPrompts);
const promptCounts = Object.fromEntries(documents.map(({ number }) => [number, prompts.filter((prompt) => prompt.number === number).length]));
const pageStats = pages.map((page) => ({ number: page.number, chars: extracted.get(page.number).replace(/\s/g, "").length }));
if (pages.length !== 10 || prompts.length !== 74 || JSON.stringify(promptCounts) !== JSON.stringify(expectedPrompts) || new Set(prompts.map((prompt) => prompt.title)).size !== prompts.length) {
  throw new Error(`Page 또는 Prompt 개수와 중복 검증에 실패했습니다. ${JSON.stringify(promptCounts)}`);
}
const invalidPages = pageStats.filter(({ chars }) => chars < 1_000);
const invalidPrompts = prompts.filter(({ body }) => body.length < 50).map(({ title, body }) => ({ title, chars: body.length }));
if (invalidPages.length || invalidPrompts.length) throw new Error(`PDF 전문 또는 Prompt 본문이 불완전합니다. ${JSON.stringify({ invalidPages, invalidPrompts })}`);
if (process.argv.includes("--check")) {
  console.log({ pages: pages.length, prompts: prompts.length, pageStats, promptsBySource: promptCounts });
  process.exit(0);
}

function sections(prompt, pageId) {
  return JSON.stringify([
    { title: "프롬프트", body: prompt.body },
    { title: "관련 Page", body: `/pages/${pageId}` },
    { title: "원본 PDF", body: basename(documents.find((document) => document.number === prompt.number).path).normalize("NFC") },
  ]);
}

const db = new Database(resolve(root, "data/mymark.db"));
const findLocalPage = db.prepare("SELECT id, content FROM custom_pages WHERE user_id = ? AND title = ?");
const insertLocalPage = db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
const updateLocalPage = db.prepare("UPDATE custom_pages SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?");
const findLocalPrompt = db.prepare("SELECT id, summary, when_to_use, sections FROM prompts WHERE user_id = ? AND title = ? AND category = ?");
const insertLocalPrompt = db.prepare("INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)");
const updateLocalPrompt = db.prepare("UPDATE prompts SET summary = ?, when_to_use = ?, sections = ?, updated_at = ? WHERE id = ? AND user_id = ?");
const localPageIds = new Map();
let localPages = 0;
let localPageUpdates = 0;
let localPrompts = 0;
let localPromptUpdates = 0;
db.transaction(() => {
  for (const page of pages) {
    const existing = findLocalPage.get(LOCAL_USER, page.title);
    const id = existing?.id ?? randomUUID();
    localPageIds.set(page.number, id);
    if (!existing) {
      insertLocalPage.run(id, LOCAL_USER, page.title, page.content, page.createdAt, page.createdAt);
      localPages += 1;
    } else if (existing.content !== page.content) {
      updateLocalPage.run(page.content, new Date().toISOString(), id, LOCAL_USER);
      localPageUpdates += 1;
    }
  }
  for (const prompt of prompts) {
    const promptSections = sections(prompt, localPageIds.get(prompt.number));
    const existing = findLocalPrompt.get(LOCAL_USER, prompt.title, prompt.category);
    if (!existing) {
      insertLocalPrompt.run(randomUUID(), LOCAL_USER, prompt.title, prompt.category, prompt.summary, prompt.when, promptSections, prompt.createdAt, prompt.createdAt);
      localPrompts += 1;
    } else if (existing.summary !== prompt.summary || existing.when_to_use !== prompt.when || existing.sections !== promptSections) {
      updateLocalPrompt.run(prompt.summary, prompt.when, promptSections, new Date().toISOString(), existing.id, LOCAL_USER);
      localPromptUpdates += 1;
    }
  }
})();
db.close();

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase 운영 환경변수가 없습니다.");
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: existingProdPages, error: prodPageLookupError } = await supabase.from("custom_pages").select("id, title, content").eq("user_id", PROD_USER).in("title", pages.map((page) => page.title));
if (prodPageLookupError) throw prodPageLookupError;
const prodPageMap = new Map((existingProdPages ?? []).map((page) => [page.title, page]));
const prodPageIds = new Map();
const newProdPages = [];
const changedProdPages = [];
for (const page of pages) {
  const existing = prodPageMap.get(page.title);
  const id = existing?.id ?? randomUUID();
  prodPageIds.set(page.number, id);
  if (!existing) newProdPages.push({ id, user_id: PROD_USER, title: page.title, content: page.content, created_at: page.createdAt, updated_at: page.createdAt });
  else if (existing.content !== page.content) changedProdPages.push({ id, content: page.content });
}
if (newProdPages.length) {
  const { error } = await supabase.from("custom_pages").insert(newProdPages);
  if (error) throw error;
}
for (const page of changedProdPages) {
  const { error } = await supabase.from("custom_pages").update({ content: page.content, updated_at: new Date().toISOString() }).eq("id", page.id).eq("user_id", PROD_USER);
  if (error) throw error;
}

const { data: existingProdPrompts, error: prodPromptLookupError } = await supabase.from("prompts").select("id, title, category, summary, when_to_use, sections").eq("user_id", PROD_USER).in("title", prompts.map((prompt) => prompt.title));
if (prodPromptLookupError) throw prodPromptLookupError;
const prodPromptMap = new Map((existingProdPrompts ?? []).map((prompt) => [`${prompt.category}\n${prompt.title}`, prompt]));
const newProdPrompts = [];
const changedProdPrompts = [];
for (const prompt of prompts) {
  const promptSections = sections(prompt, prodPageIds.get(prompt.number));
  const existing = prodPromptMap.get(`${prompt.category}\n${prompt.title}`);
  const row = { summary: prompt.summary, when_to_use: prompt.when, sections: promptSections };
  if (!existing) newProdPrompts.push({ id: randomUUID(), user_id: PROD_USER, title: prompt.title, category: prompt.category, ...row, is_favorite: 0, created_at: prompt.createdAt, updated_at: prompt.createdAt });
  else if (existing.summary !== row.summary || existing.when_to_use !== row.when_to_use || existing.sections !== row.sections) changedProdPrompts.push({ id: existing.id, ...row });
}
if (newProdPrompts.length) {
  const { error } = await supabase.from("prompts").insert(newProdPrompts);
  if (error) throw error;
}
for (const prompt of changedProdPrompts) {
  const { id, ...row } = prompt;
  const { error } = await supabase.from("prompts").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", PROD_USER);
  if (error) throw error;
}

console.log({ parsedPages: pages.length, parsedPrompts: prompts.length, localPages, localPageUpdates, localPrompts, localPromptUpdates, prodPages: newProdPages.length, prodPageUpdates: changedProdPages.length, prodPrompts: newProdPrompts.length, prodPromptUpdates: changedProdPrompts.length });
