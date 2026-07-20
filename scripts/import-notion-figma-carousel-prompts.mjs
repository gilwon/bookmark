// Claude 피그마 캐러셀 가이드와 6단계 프롬프트를 저장한다
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
    process.env[match[1].trim()] = match[2]
      .trim()
      .replace(/^(["'])|(["'])$/g, "");
  }
}

const { markdownToTiptapDoc } = await import(
  resolve(root, "src/lib/markdown-to-tiptap.ts")
);

const SOURCE =
  "https://app.notion.com/p/3-zip-3a22b793a11580c5a897f7e61153f312?source=copy_link";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const LOCAL_USER = "dev";
const PAGE_TITLE = "클로드로 3배 똑똑하게 피그마 캐러셀 만드는 프롬프트.zip";
const CATEGORY = "Claude · 피그마 캐러셀";
const now = new Date().toISOString();

// 공개된 Notion 원문을 2026-07-21에 서식까지 보존해 압축한 스냅샷.
const PAGE_MARKDOWN_GZIP_BASE64 = "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";
const pageMarkdown = gunzipSync(
  Buffer.from(PAGE_MARKDOWN_GZIP_BASE64, "base64")
).toString("utf8");

function extractPrompt(step, nextStep) {
  const start = `### ${step}`;
  const startIndex = pageMarkdown.indexOf(start);
  const bodyStart = pageMarkdown.indexOf("\n", startIndex) + 1;
  const endIndex = nextStep
    ? pageMarkdown.indexOf(`### ${nextStep}`, bodyStart)
    : pageMarkdown.indexOf("**안녕하세요", bodyStart);
  if (startIndex < 0 || bodyStart === 0 || endIndex < 0) {
    throw new Error(`${step} 프롬프트를 찾지 못했습니다.`);
  }
  return pageMarkdown
    .slice(bodyStart, endIndex)
    .trim()
    .replace(/\*\*/g, "")
    .replace(/(?<!\*)\*(?!\*)/g, "");
}

const promptSpecs = [
  ["1단계 - 가이드라인", "2단계 - 본문의 항목 설계하기", "피그마 캐러셀 1단계 · 디자인 가이드라인", "캐러셀의 포지셔닝·규격·팔레트·타이포그래피·구조·출력 규칙을 Claude에 설정합니다.", "새 캐러셀 작업을 시작하며 전체 디자인 원칙을 먼저 전달할 때 사용하세요."],
  ["2단계 - 본문의 항목 설계하기", "3단계 - 표지 제목 짓기", "피그마 캐러셀 2단계 · 본문 항목 설계", "첨부 자료에 근거해 캐러셀 본문 항목과 전할 사실 후보를 설계합니다.", "가이드라인 설정 후 원문 자료에서 슬라이드 구성을 뽑을 때 사용하세요."],
  ["3단계 - 표지 제목 짓기", "4단계 - 표지 만들기", "피그마 캐러셀 3단계 · 표지 제목 후보", "서로 다른 후킹 방향의 표지 제목·카테고리·보조 문구 후보를 만듭니다.", "본문 항목을 확정한 뒤 표지 카피 후보를 비교할 때 사용하세요."],
  ["4단계 - 표지 만들기", "5단계 - 본문 슬라이드 만들기", "피그마 캐러셀 4단계 · 표지 SVG 생성", "선택한 제목 후보와 수정 사항을 반영해 편집 가능한 표지 SVG를 생성합니다.", "표지 카피를 고른 뒤 피그마에 붙여넣을 SVG를 만들 때 사용하세요."],
  ["5단계 - 본문 슬라이드 만들기", "6단계 - 마지막 장(CTA) 만들기", "피그마 캐러셀 5단계 · 본문 SVG 생성", "선택한 소제목과 사실을 바탕으로 본문 슬라이드 SVG를 최대 2장씩 생성합니다.", "확정한 본문 항목을 피그마용 슬라이드로 제작할 때 사용하세요."],
  ["6단계 - 마지막 장(CTA) 만들기", null, "피그마 캐러셀 6단계 · CTA SVG 생성", "요청 행동과 버튼 문구를 반영해 캐러셀 마지막 CTA 장을 생성합니다.", "본문 제작을 마친 뒤 저장·팔로우·댓글 등의 행동을 유도하는 마지막 장을 만들 때 사용하세요."],
];
const prompts = promptSpecs.map(([step, nextStep, title, summary, when]) => ({
  title,
  summary,
  when,
  body: extractPrompt(step, nextStep),
}));

if (pageMarkdown.length < 6_500 || prompts.some(({ body }) => body.length < 100)) {
  throw new Error("Page 또는 Prompt 구성이 불완전합니다.");
}

if (process.argv.includes("--check")) {
  console.log({
    pageChars: pageMarkdown.length,
    prompts: prompts.length,
    promptChars: prompts.map(({ body }) => body.length),
  });
  process.exit(0);
}

const pageContent = JSON.stringify(markdownToTiptapDoc(pageMarkdown));
const db = new Database(resolve(root, "data/mymark.db"));
const existingLocalPage = db
  .prepare("SELECT id, content FROM custom_pages WHERE user_id = ? AND (title = ? OR content LIKE ?)")
  .get(LOCAL_USER, PAGE_TITLE, "%3a22b793a11580c5a897f7e61153f312%");
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
  insertLocalPrompt.run(
    randomUUID(), LOCAL_USER, prompt.title, CATEGORY, prompt.summary, prompt.when,
    JSON.stringify([
      { title: "프롬프트", body: prompt.body },
      { title: "관련 Page", body: `/pages/${localPageId}` },
      { title: "원문", body: SOURCE },
    ]), now, now
  );
  localPrompts += 1;
}
db.close();

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
const { data: existingProdPages, error: pageLookupError } = await sb
  .from("custom_pages")
  .select("id, content")
  .eq("user_id", PROD_USER)
  .eq("title", PAGE_TITLE)
  .limit(1);
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

console.log({
  localPages, localPageUpdates, localPrompts,
  prodPages, prodPageUpdates, prodPrompts,
  localPage: `/pages/${localPageId}`,
  prodPage: `/pages/${prodPageId}`,
});
