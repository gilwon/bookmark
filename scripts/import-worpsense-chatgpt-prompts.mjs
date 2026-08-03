// 워프센스의 ChatGPT 프롬프트 글을 Pages와 Prompts에 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import Database from "better-sqlite3";
import TurndownService from "turndown";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localUser = "dev";
const productionUser = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const sourceUrl = "https://worpsense.com/chatgpt-%EB%B9%84%EB%B0%80-%ED%94%84%EB%A1%AC%ED%94%84%ED%8A%B8-30%EA%B0%9C-%EC%97%85%EB%AC%B4%EB%B6%80%ED%84%B0-%EC%9D%B4%EB%AF%B8%EC%A7%80-%EC%A0%9C%EC%9E%91%EA%B9%8C%EC%A7%80-%ED%95%9C-%EB%B2%88/";
const category = "ChatGPT 비밀 프롬프트 30개";
const require = createRequire(import.meta.url);
const tsx = require("tsx/cjs/api");
tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
const { markdownToTiptapDoc } = require(resolve(root, "src/lib/markdown-to-tiptap.ts"));

const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^("')|("')$/g, "");
  }
}

const response = await fetch(sourceUrl, { headers: { "user-agent": "Mozilla/5.0" } });
if (!response.ok) throw new Error(`원문 HTTP ${response.status}`);
const html = await response.text();
const $ = cheerio.load(html);
const content = $(".elementor-widget-theme-post-content").first();
if (!content.length) throw new Error("본문 영역을 찾지 못했습니다.");
content.find("script, style, noscript").remove();

const pageTitle = $("h1").first().text().trim() || "ChatGPT 비밀 프롬프트 30개, 업무부터 이미지 제작까지 한 번에";
const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});
const articleMarkdown = turndown.turndown(content.html() ?? "").trim();
const prompts = [];
content.find("h3").each((_, heading) => {
  const headingText = $(heading).text().trim();
  const number = Number(headingText.split(")")[0]);
  if (!Number.isInteger(number) || number < 1 || number > 30) return;
  let body = "";
  let node = $(heading).next();
  while (node.length && !node.is("h2, h3")) {
    if (node.is("pre")) {
      body = node.text().trim();
      break;
    }
    const pre = node.find("pre").first();
    if (pre.length) {
      body = pre.text().trim();
      break;
    }
    node = node.next();
  }
  prompts.push({ number, title: headingText.replace(/^\d+\)\s*/, ""), body });
});
prompts.sort((a, b) => a.number - b.number);

if (!pageTitle || articleMarkdown.length < 1000 || prompts.length !== 30 || prompts.some((prompt, index) => prompt.number !== index + 1 || !prompt.body)) {
  throw new Error(`원문 검증 실패. page=${articleMarkdown.length}, prompts=${prompts.length}`);
}

const page = {
  title: pageTitle,
  content: JSON.stringify(markdownToTiptapDoc([
    `# ${pageTitle}`,
    `> 원문. [Worpsense](${sourceUrl})`,
    articleMarkdown,
  ].join("\n\n"))),
};

const promptRows = prompts.map((prompt) => ({
  title: `ChatGPT 비밀 프롬프트 ${String(prompt.number).padStart(2, "0")} · ${prompt.title}`,
  category,
  summary: `${prompt.title} 작업에 사용하는 ChatGPT 프롬프트입니다.`,
  when_to_use: "ChatGPT에서 해당 작업을 빠르게 시작할 때 사용하세요.",
  sections: JSON.stringify([
    { title: "프롬프트", body: prompt.body },
    { title: "관련 Page", body: pageTitle },
    { title: "원문", body: sourceUrl },
  ]),
  body: prompt.body,
}));

if (process.argv.includes("--check")) {
  console.log({
    page: { title: page.title, characters: articleMarkdown.length },
    prompts: promptRows.map(({ title, body }) => ({ title, characters: body.length })),
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
    const existingPage = findPage.get(localUser, page.title);
    if (!existingPage) { insertPage.run(randomUUID(), localUser, page.title, page.content, now, now); result.pages += 1; }
    else if (existingPage.content !== page.content) { updatePage.run(page.content, now, existingPage.id, localUser); result.pageUpdates += 1; }
    else result.pageSkips += 1;
    for (const prompt of promptRows) {
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
  const { data: pages, error: pageError } = await supabase.from("custom_pages").select("id, content").eq("user_id", productionUser).eq("title", page.title).limit(1);
  if (pageError) throw pageError;
  const existingPage = pages?.[0];
  if (!existingPage) { const { error } = await supabase.from("custom_pages").insert({ id: randomUUID(), user_id: productionUser, title: page.title, content: page.content, created_at: now, updated_at: now }); if (error) throw error; result.pages += 1; }
  else if (existingPage.content !== page.content) { const { error } = await supabase.from("custom_pages").update({ content: page.content, updated_at: now }).eq("id", existingPage.id).eq("user_id", productionUser); if (error) throw error; result.pageUpdates += 1; }
  else result.pageSkips += 1;
  for (const prompt of promptRows) {
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
