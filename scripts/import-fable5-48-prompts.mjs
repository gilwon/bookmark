// 워프센스 Fable 5 기사 전문과 48개 프롬프트를 Pages·Prompts에 저장한다
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(resolve(root, ".env.local"))) for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split("\n")) { const match = line.match(/^([^#=]+)=(.*)$/); if (match && !process.env[match[1].trim()]) process.env[match[1].trim()] = match[2].trim().replace(/^("|')|("|')$/g, ""); }

const SOURCE = "https://worpsense.com/%ED%81%B4%EB%A1%9C%EB%93%9C-fable-5-%ED%94%84%EB%A1%AC%ED%94%84%ED%8A%B8-48%EA%B0%9C-%EC%9E%A5%EA%B8%B0-%EC%9E%91%EC%97%85%C2%B7%EC%97%90%EC%9D%B4%EC%A0%84%ED%8A%B8-%EC%9E%90%EB%8F%99%ED%99%94/";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const LOCAL_USER = "dev";
const CATEGORY = "Claude · Fable 5 프롬프트 48개";
const PAGE_TITLE = "클로드 Fable 5 프롬프트 48개, 장기 작업·에이전트 자동화 실전 모음";
const now = new Date().toISOString();

function decode(value) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-6]|li|pre|figure|ul|ol|div)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`원문을 가져오지 못했습니다. ${response.status}`);
const html = await response.text();
const start = html.indexOf("클로드 Fable 5를 일반");
const lastCode = html.lastIndexOf('<pre class="wp-block-code">');
const lastCodeEnd = html.indexOf("</pre>", lastCode) + "</pre>".length;
const end = html.indexOf("</div>", lastCodeEnd);
if (start < 0 || lastCode < 0 || end < 0) throw new Error("원문 본문 경계를 찾지 못했습니다.");
const articleHtml = html.slice(start, end);
const articleText = decode(articleHtml);
const codeBlocks = [...articleHtml.matchAll(/<pre class="wp-block-code"><code>([\s\S]*?)<\/code><\/pre>/g)]
  .map((match) => decode(match[1]))
  .filter((block) => /^\d+\.\s/m.test(block));
const entries = codeBlocks.flatMap((block) => {
  const matches = [...block.matchAll(/^(\d+)\.\s+(.+)$/gm)];
  return matches.map((match, index) => ({
    number: Number(match[1]),
    name: match[2].trim(),
    body: block.slice(match.index + match[0].length, matches[index + 1]?.index).trim(),
  }));
});
if (entries.length !== 48 || entries.some((entry, index) => entry.number !== index + 1)) throw new Error(`프롬프트 48개를 정상 분리하지 못했습니다. ${entries.length}`);

const textNode = (text) => ({ type: "text", text });
const page = {
  title: PAGE_TITLE,
  content: JSON.stringify({
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [textNode(PAGE_TITLE)] },
      { type: "blockquote", content: [{ type: "paragraph", content: [textNode(`원문. ${SOURCE}`)] }] },
      { type: "heading", attrs: { level: 2 }, content: [textNode("전체 내용")] },
      ...articleText.split(/\n{2,}/).map((block) => ({ type: "paragraph", content: [textNode(block.replace(/\n/g, " "))] })),
    ],
  }),
};
const prompts = entries.map((entry) => ({
  id: randomUUID(), user_id: LOCAL_USER,
  title: `Fable 5 · ${String(entry.number).padStart(2, "0")} ${entry.name}`,
  category: CATEGORY,
  summary: `장기 작업·에이전트 자동화에 쓰는 ${entry.name} 프롬프트입니다.`,
  when_to_use: "대괄호 안의 항목을 현재 작업에 맞게 바꿔 사용하세요.",
  sections: JSON.stringify([{ title: "프롬프트", body: entry.body }]),
  is_favorite: 0, created_at: now, updated_at: now,
}));

const db = new Database(resolve(root, "data/mymark.db"));
const findPage = db.prepare("SELECT id FROM custom_pages WHERE user_id = ? AND title = ?");
const findPrompt = db.prepare("SELECT id FROM prompts WHERE user_id = ? AND title = ? AND category = ?");
const insertPage = db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
const insertPrompt = db.prepare("INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (@id, @user_id, @title, @category, @summary, @when_to_use, @sections, @is_favorite, @created_at, @updated_at)");
let localPages = 0;
let localPrompts = 0;
if (!findPage.get(LOCAL_USER, page.title)) { insertPage.run(randomUUID(), LOCAL_USER, page.title, page.content, now, now); localPages += 1; }
for (const prompt of prompts) if (!findPrompt.get(LOCAL_USER, prompt.title, CATEGORY)) { insertPrompt.run(prompt); localPrompts += 1; }
db.close();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let prodPages = 0;
let prodPrompts = 0;
const { data: existingPage, error: pageError } = await sb.from("custom_pages").select("id").eq("user_id", PROD_USER).eq("title", page.title).limit(1);
if (pageError) throw pageError;
if (!existingPage?.length) { const { error } = await sb.from("custom_pages").insert({ id: randomUUID(), user_id: PROD_USER, ...page, created_at: now, updated_at: now }); if (error) throw error; prodPages += 1; }
for (const prompt of prompts) { const { data, error } = await sb.from("prompts").select("id").eq("user_id", PROD_USER).eq("title", prompt.title).eq("category", CATEGORY).limit(1); if (error) throw error; if (data?.length) continue; const { id, user_id, ...row } = prompt; const { error: insertError } = await sb.from("prompts").insert({ id: randomUUID(), user_id: PROD_USER, ...row }); if (insertError) throw insertError; prodPrompts += 1; }
console.log({ parsedPrompts: prompts.length, localPages, localPrompts, prodPages, prodPrompts });
