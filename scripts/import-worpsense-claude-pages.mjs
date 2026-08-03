// 워프센스의 클로드 마케팅·스킬 글을 이미지와 함께 저장한다
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
const sources = [
  {
    url: "https://worpsense.com/%ED%81%B4%EB%A1%9C%EB%93%9C-%EC%BD%94%EB%93%9C-%EB%A7%88%EC%BC%80%ED%8C%85-%EC%9E%90%EB%8F%99%ED%99%94-ai%EB%A5%BC-%EB%A7%88%EC%BC%80%ED%8C%85-%EC%A7%81%EC%9B%90%EC%B2%98%EB%9F%BC-%ED%99%9C%EC%9A%A9/",
    title: "클로드 코드 마케팅 자동화: AI를 마케팅 직원처럼 활용하는 방법",
    category: "클로드 코드 마케팅 자동화",
  },
  {
    url: "https://worpsense.com/%ED%81%B4%EB%A1%9C%EB%93%9C-%ED%94%84%EB%A1%AC%ED%94%84%ED%8A%B8-%EC%A7%81%EC%A0%91-%EC%93%B0%EC%A7%80-%EB%A7%88%EC%84%B8%EC%9A%94-claude-skills-9%EA%B0%80%EC%A7%80-%EC%82%AC%EC%9A%A9%EB%B2%95/",
    title: "클로드 프롬프트 직접 쓰지 마세요: Claude Skills 9가지 사용법",
    category: "Claude Skills 9가지",
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
const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });

async function readSource(source) {
  const response = await fetch(source.url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error("원문 HTTP " + response.status + ": " + source.url);
  const $ = cheerio.load(await response.text());
  const content = $(".elementor-widget-theme-post-content").first();
  if (!content.length) throw new Error("본문 영역을 찾지 못했습니다: " + source.url);
  content.find("script, style, noscript").remove();

  const imageSources = [];
  content.find("img").each((_, image) => {
    let imageUrl = $(image).attr("src") || $(image).attr("data-src") || "";
    if (!imageUrl) return;
    imageUrl = new URL(imageUrl, source.url).href.replace(/^http:\/\//, "https://");
    $(image).attr("src", imageUrl);
    imageSources.push(imageUrl);
  });

  const articleMarkdown = turndown.turndown(content.html() || "").trim();
  const prompts = [];
  if (source.category === "클로드 코드 마케팅 자동화") {
    const code = content.find("pre").map((_, pre) => $(pre).text().trim()).get().find((value) => !value.startsWith("npx ") && !value.startsWith("/plugin "));
    if (code) prompts.push({
      title: "텀블러 신제품 사전예약 랜딩페이지",
      body: code,
      summary: "클로드 코드 마케팅 스킬로 신제품 랜딩페이지를 만드는 프롬프트입니다.",
    });
  } else {
    content.find("h3").each((_, heading) => {
      const headingText = $(heading).text().trim();
      const command = headingText.match(/(\/[^\s]+)$/)?.[1];
      if (!command) return;
      prompts.push({
        title: headingText.replace(/^\d+\.\s*/, ""),
        body: command,
        summary: headingText.replace(/^\d+\.\s*/, "") + " 스킬을 실행하는 프롬프트입니다.",
      });
    });
  }
  return { ...source, articleMarkdown, imageSources, prompts };
}

const documents = await Promise.all(sources.map(readSource));
if (documents.some((document) => document.articleMarkdown.length < 1000 || document.imageSources.length < 4 || !document.prompts.length)) {
  throw new Error("원문 검증 실패");
}

const pages = documents.map((document) => ({
  title: document.title,
  content: JSON.stringify(markdownToTiptapDoc([
    "# " + document.title,
    "> 원문. [Worpsense](" + document.url + ")",
    document.articleMarkdown.replace(/\[(!\[[^\]]*\]\([^)]+\))\]\([^)]+\)/g, "$1"),
    ...document.imageSources
      .filter((imageUrl) => ![...document.articleMarkdown.replace(/\[(!\[[^\]]*\]\([^)]+\))\]\([^)]+\)/g, "$1").matchAll(/^!\[[^\]]*\]\(([^)]+)\)\s*$/gm)].map((match) => match[1]).includes(imageUrl))
      .map((imageUrl) => "![원문 이미지](" + imageUrl + ")"),
  ].join("\n\n"))),
}));
const promptRows = documents.flatMap((document) => document.prompts.map((prompt, index) => ({
  title: document.category + " " + String(index + 1).padStart(2, "0") + " · " + prompt.title,
  category: document.category,
  summary: prompt.summary,
  when_to_use: "클로드에서 해당 스킬이나 마케팅 작업을 실행할 때 사용하세요.",
  sections: JSON.stringify([
    { title: "프롬프트", body: prompt.body },
    { title: "관련 Page", body: document.title },
    { title: "원문", body: document.url },
  ]),
  body: prompt.body,
})));

if (process.argv.includes("--check")) {
  console.log({
    pages: documents.map(({ title, articleMarkdown, imageSources }) => ({ title, characters: articleMarkdown.length, imageCount: imageSources.length, imageSources })),
    prompts: promptRows.map(({ title, body }) => ({ title, characters: body.length })),
  });
  process.exit(0);
}

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[key]) throw new Error("필수 환경변수 누락: " + key);
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
  for (const page of pages) {
    const { data, error } = await supabase.from("custom_pages").select("id, content").eq("user_id", productionUser).eq("title", page.title).limit(1);
    if (error) throw error;
    const existing = data?.[0];
    if (!existing) { const { error: insertError } = await supabase.from("custom_pages").insert({ id: randomUUID(), user_id: productionUser, title: page.title, content: page.content, created_at: now, updated_at: now }); if (insertError) throw insertError; result.pages += 1; }
    else if (existing.content !== page.content) { const { error: updateError } = await supabase.from("custom_pages").update({ content: page.content, updated_at: now }).eq("id", existing.id).eq("user_id", productionUser); if (updateError) throw updateError; result.pageUpdates += 1; }
    else result.pageSkips += 1;
  }
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
