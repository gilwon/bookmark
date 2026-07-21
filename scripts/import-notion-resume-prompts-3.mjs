// 프롬프롬 자소서 가이드와 세 가지 프롬프트를 저장한다
import { randomUUID } from "crypto";
import { existsSync, readFileSync } from "fs";
import { gunzipSync } from "zlib";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^(["'])|(["'])$/g, "");
  }
}

const { markdownToTiptapDoc } = await import(resolve(root, "src/lib/markdown-to-tiptap.ts"));
const SOURCE = "https://app.notion.com/p/3-3a30024d0588800ea41ef0e8cd04b665?source=copy_link";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const LOCAL_USER = "dev";
const PAGE_TITLE = "[프롬프롬] 대기업 인턴 합격하는 자소서 프롬프트 3";
const CATEGORY = "취업 · 자기소개서";
const now = new Date().toISOString();

// 공개된 Notion 원문을 2026-07-21에 서식까지 보존해 압축한 스냅샷.
const PAGE_MARKDOWN_GZIP_BASE64 = "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";
const pageMarkdown = gunzipSync(Buffer.from(PAGE_MARKDOWN_GZIP_BASE64, "base64")).toString("utf8");

function extractPrompt(startHeading, endHeading) {
  const start = pageMarkdown.indexOf(`## ${startHeading}`);
  const bodyStart = pageMarkdown.indexOf("\n", start) + 1;
  const end = pageMarkdown.indexOf(`## ${endHeading}`, bodyStart);
  if (start < 0 || bodyStart === 0 || end < 0) throw new Error(`${startHeading} 프롬프트를 찾지 못했습니다.`);
  return pageMarkdown
    .slice(bodyStart, end)
    .trim()
    .replace(/\n✶ 빨간색 부분[^\n]*$/u, "")
    .replace(/\*\*/g, "")
    .replace(/(?<!\*)\*(?!\*)/g, "")
    .trim();
}

const prompts = [
  {
    title: "자소서 우대사항 99% 반영",
    summary: "채용공고의 우대사항과 기존 경험을 매칭해 자기소개서를 사실 기반으로 재구성합니다.",
    when: "지원 공고의 우대사항이 자기소개서에 충분히 드러나는지 보완할 때 사용하세요.",
    body: extractPrompt("✶ ‘우대사항' 99% 담아내는 프롬프트", "✶ 내 글의 부족한 점을 끌어 올리는 프롬프트"),
  },
  {
    title: "자소서 부족한 점 집중 진단",
    summary: "과정·성과 연결·근거·STAR 요소를 기준으로 자기소개서의 부족한 점을 진단합니다.",
    when: "초안의 약한 근거와 채용 담당자가 궁금해할 내용을 구체적으로 찾을 때 사용하세요.",
    body: extractPrompt("✶ 내 글의 부족한 점을 끌어 올리는 프롬프트", "✶ 모든 영혼을 끌어 담는 한 줄 정리 프롬프트"),
  },
  {
    title: "자소서 핵심 성과 한 줄 요약",
    summary: "숫자로 보강할 경험을 찾고 핵심 성과 한 가지를 중심으로 대표 문장을 만듭니다.",
    when: "자소서의 성과를 정량화하고 눈에 띄는 한 줄 요약이 필요할 때 사용하세요.",
    body: extractPrompt("✶ 모든 영혼을 끌어 담는 한 줄 정리 프롬프트", "[프롬프트 사용 방법]"),
  },
];

if (pageMarkdown.length < 3_000 || prompts.length !== 3 || prompts.some(({ body }) => body.length < 500)) {
  throw new Error("Page 또는 Prompt 구성이 불완전합니다.");
}
if (process.argv.includes("--check")) {
  console.log({ pageChars: pageMarkdown.length, prompts: prompts.length, promptChars: prompts.map(({ body }) => body.length) });
  process.exit(0);
}

const pageContent = JSON.stringify(markdownToTiptapDoc(pageMarkdown));
const db = new Database(resolve(root, "data/mymark.db"));
const existingLocalPage = db.prepare("SELECT id, content FROM custom_pages WHERE user_id = ? AND (title = ? OR content LIKE ?)")
  .get(LOCAL_USER, PAGE_TITLE, "%3a30024d0588800ea41ef0e8cd04b665%");
const localPageId = existingLocalPage?.id ?? randomUUID();
let localPages = 0;
let localPageUpdates = 0;
let localPrompts = 0;
if (!existingLocalPage) {
  db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(localPageId, LOCAL_USER, PAGE_TITLE, pageContent, now, now);
  localPages = 1;
} else if (existingLocalPage.content !== pageContent) {
  db.prepare("UPDATE custom_pages SET title = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .run(PAGE_TITLE, pageContent, now, localPageId, LOCAL_USER);
  localPageUpdates = 1;
}
const findLocalPrompt = db.prepare("SELECT id FROM prompts WHERE user_id = ? AND title = ? AND category = ?");
const insertLocalPrompt = db.prepare("INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)");
for (const prompt of prompts) {
  if (findLocalPrompt.get(LOCAL_USER, prompt.title, CATEGORY)) continue;
  insertLocalPrompt.run(randomUUID(), LOCAL_USER, prompt.title, CATEGORY, prompt.summary, prompt.when, JSON.stringify([
    { title: "프롬프트", body: prompt.body },
    { title: "관련 Page", body: `/pages/${localPageId}` },
    { title: "원문", body: SOURCE },
  ]), now, now);
  localPrompts += 1;
}
db.close();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: existingProdPages, error: pageLookupError } = await sb.from("custom_pages").select("id, content")
  .eq("user_id", PROD_USER).eq("title", PAGE_TITLE).limit(1);
if (pageLookupError) throw pageLookupError;
const prodPageId = existingProdPages?.[0]?.id ?? randomUUID();
let prodPages = 0;
let prodPageUpdates = 0;
let prodPrompts = 0;
if (!existingProdPages?.length) {
  const { error } = await sb.from("custom_pages").insert({ id: prodPageId, user_id: PROD_USER, title: PAGE_TITLE, content: pageContent, created_at: now, updated_at: now });
  if (error) throw error;
  prodPages = 1;
} else if (existingProdPages[0].content !== pageContent) {
  const { error } = await sb.from("custom_pages").update({ title: PAGE_TITLE, content: pageContent, updated_at: now }).eq("id", prodPageId).eq("user_id", PROD_USER);
  if (error) throw error;
  prodPageUpdates = 1;
}
for (const prompt of prompts) {
  const { data, error: lookupError } = await sb.from("prompts").select("id").eq("user_id", PROD_USER).eq("title", prompt.title).eq("category", CATEGORY).limit(1);
  if (lookupError) throw lookupError;
  if (data?.length) continue;
  const { error } = await sb.from("prompts").insert({
    id: randomUUID(), user_id: PROD_USER, title: prompt.title, category: CATEGORY,
    summary: prompt.summary, when_to_use: prompt.when,
    sections: JSON.stringify([
      { title: "프롬프트", body: prompt.body },
      { title: "관련 Page", body: `/pages/${prodPageId}` },
      { title: "원문", body: SOURCE },
    ]), is_favorite: 0, created_at: now, updated_at: now,
  });
  if (error) throw error;
  prodPrompts += 1;
}
console.log({ localPages, localPageUpdates, localPrompts, prodPages, prodPageUpdates, prodPrompts, localPage: `/pages/${localPageId}`, prodPage: `/pages/${prodPageId}` });
