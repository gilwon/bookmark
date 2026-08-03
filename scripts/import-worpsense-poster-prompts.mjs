// 워프센스의 ChatGPT 포스터 프롬프트 글을 이미지와 함께 저장한다
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
const sourceUrl = "https://worpsense.com/chatgpt-%EA%B3%A0%EA%B8%89-%ED%8F%AC%EC%8A%A4%ED%84%B0-%ED%94%84%EB%A1%AC%ED%94%84%ED%8A%B8-5%EA%B0%80%EC%A7%80-%EC%9D%8C%EC%8B%9D%EC%A0%90%EB%B6%80%ED%84%B0-%EB%B7%B0%ED%8B%B0%EA%B9%8C%EC%A7%80/";
const pageTitle = "ChatGPT 고급 포스터 프롬프트 5가지: 음식점부터 뷰티까지";
const category = "ChatGPT 고급 포스터 프롬프트";

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

const response = await fetch(sourceUrl, { headers: { "user-agent": "Mozilla/5.0" } });
if (!response.ok) throw new Error(`원문 HTTP ${response.status}`);
const $ = cheerio.load(await response.text());
const content = $(".elementor-widget-theme-post-content").first();
if (!content.length) throw new Error("본문 영역을 찾지 못했습니다.");
content.find("script, style, noscript").remove();

const imageSources = [];
content.find("img").each((_, image) => {
  let src = $(image).attr("src") || $(image).attr("data-src") || "";
  if (!src) return;
  src = new URL(src, sourceUrl).href.replace(/^http:\/\//, "https://");
  $(image).attr("src", src);
  imageSources.push(src);
});

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
const articleMarkdown = turndown.turndown(content.html() ?? "").trim();
const promptSections = [];
content.find("h2, h3").each((_, heading) => {
  const headingText = $(heading).text().trim();
  if (!/^\d+\./.test(headingText) && !headingText.includes("원하는 결과가 나오지 않을 때")) return;
  let body = "";
  let node = $(heading).next();
  while (node.length && !node.is("h2, h3")) {
    const pre = node.is("pre") ? node : node.find("pre").first();
    if (pre.length) { body = pre.text().trim(); break; }
    node = node.next();
  }
  if (body) promptSections.push({ title: headingText.replace(/^\d+\.\s*/, ""), body });
});

if (articleMarkdown.length < 1000 || imageSources.length < 7 || promptSections.length !== 6 || promptSections.some((prompt) => prompt.body.length < 100)) {
  throw new Error(`원문 검증 실패. page=${articleMarkdown.length}, images=${imageSources.length}, prompts=${promptSections.length}`);
}

const page = {
  title: pageTitle,
  content: JSON.stringify(markdownToTiptapDoc([
    `# ${pageTitle}`,
    `> 원문. [Worpsense](${sourceUrl})`,
    articleMarkdown.replace(/\[(!\[[^\]]*\]\([^)]+\))\]\([^)]+\)/g, "$1"),
    ...imageSources
      .filter((imageUrl) => ![...articleMarkdown.replace(/\[(!\[[^\]]*\]\([^)]+\))\]\([^)]+\)/g, "$1").matchAll(/^!\[[^\]]*\]\(([^)]+)\)\s*$/gm)].map((match) => match[1]).includes(imageUrl))
      .map((imageUrl) => `![원문 이미지](${imageUrl})`),
  ].join("\n\n"))),
};
const promptRows = promptSections.map((prompt, index) => ({
  title: `ChatGPT 고급 포스터 ${String(index + 1).padStart(2, "0")} · ${prompt.title}`,
  category,
  summary: `${prompt.title}에 사용하는 포스터 제작 프롬프트입니다.`,
  when_to_use: "음식점·부동산·인테리어·카페·뷰티 포스터를 만들거나 기존 포스터를 수정할 때 사용하세요.",
  sections: JSON.stringify([
    { title: "프롬프트", body: prompt.body },
    { title: "관련 Page", body: pageTitle },
    { title: "원문", body: sourceUrl },
  ]),
  body: prompt.body,
}));

if (process.argv.includes("--check")) {
  console.log({
    page: { title: page.title, characters: articleMarkdown.length, imageCount: imageSources.length, imageSources },
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
