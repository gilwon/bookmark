// 워프센스 클로드 AI 에이전트 팀 글을 Pages와 Prompts에 저장한다
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
const sourceUrl = "https://worpsense.com/%ED%81%B4%EB%A1%9C%EB%93%9C%EB%A1%9C-%EB%82%98%EB%A7%8C%EC%9D%98-ai-%EC%97%90%EC%9D%B4%EC%A0%84%ED%8A%B8-%ED%8C%80-%EB%A7%8C%EB%93%A4%EA%B8%B0%EF%BD%9C%EC%8B%A4%EC%A0%9C-%ED%94%84%EB%A1%AC%ED%94%84/";
const pageTitle = "클로드로 나만의 AI 에이전트 팀 만들기｜실제 프롬프트와 설정 방법";
const category = "워프센스 · AI 에이전트 팀";
const now = new Date().toISOString();

const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^(['"])|(['"])$/g, "");
  }
}

const require = createRequire(import.meta.url);
const tsx = require("tsx/cjs/api");
tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
const { markdownToTiptapDoc } = require(resolve(root, "src/lib/markdown-to-tiptap.ts"));
const { extractPageMediaReferences, normalizedNotionWeekTitle } = require(
  resolve(root, "src/lib/page-attachment-storage.ts"),
);

function imageMime(bytes, header) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (Buffer.from(bytes.subarray(0, 6)).toString("ascii").match(/^GIF8[79]a$/)) return "image/gif";
  if (Buffer.from(bytes.subarray(0, 12)).toString("ascii").match(/^RIFF....WEBP$/)) return "image/webp";
  if (header?.startsWith("image/")) return header.split(";")[0];
  throw new Error("이미지 형식을 판별하지 못했습니다.");
}

async function downloadImage(url) {
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0", referer: sourceUrl } });
  if (!response.ok) throw new Error(`이미지 HTTP ${response.status}: ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return `data:${imageMime(bytes, response.headers.get("content-type"))};base64,${Buffer.from(bytes).toString("base64")}`;
}

function isSkipImage(url) {
  return /gravatar|merlin_banner|뉴스레터|HE00\d|300x158|shapes\//i.test(url);
}

const response = await fetch(sourceUrl, { headers: { "user-agent": "Mozilla/5.0" } });
if (!response.ok) throw new Error(`원문 HTTP ${response.status}`);
const $ = cheerio.load(await response.text());
const content = $(".elementor-widget-theme-post-content").first();
if (!content.length) throw new Error("본문 영역을 찾지 못했습니다.");
content.find("script, style, noscript, form").remove();
content.find("a[href*='/merlin/']").each((_, link) => {
  const wrap = $(link).closest("figure, p");
  if (wrap.length) wrap.remove();
  else $(link).remove();
});

const imageMap = new Map();
const imageUrls = [];
content.find("img").each((_, image) => {
  let imageUrl = $(image).attr("src") || $(image).attr("data-src") || $(image).attr("data-lazy-src") || "";
  if (!imageUrl) return;
  imageUrl = new URL(imageUrl, sourceUrl).href.replace(/^http:\/\//, "https://");
  if (isSkipImage(imageUrl)) {
    $(image).remove();
    return;
  }
  imageUrls.push(imageUrl);
  $(image).attr("src", imageUrl);
});

for (const url of [...new Set(imageUrls)]) {
  imageMap.set(url, await downloadImage(url));
}
content.find("img").each((_, image) => {
  const src = $(image).attr("src");
  if (src && imageMap.has(src)) $(image).attr("src", imageMap.get(src));
});

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
let articleMarkdown = turndown.turndown(content.html() || "").trim();
articleMarkdown = articleMarkdown
  .replace(/\[(!\[[^\]]*\]\([^)]+\))\]\([^)]+\)/g, "$1")
  .replace(/##### 워프센스 뉴스레터 구독하기[\s\S]*?(?=\n# )/m, "")
  .replace(/구독하기[\s\S]*?구독은 언제든지 해지할 수 있습니다\.\s*/g, "")
  .trim();

const codeBlocks = [...articleMarkdown.matchAll(/```(?:\w+)?\n([\s\S]*?)```/g)].map((match) => match[1].trim());
const planner = codeBlocks.find((body) => body.includes("name: planner"));
const coder = codeBlocks.find((body) => body.includes("name: coder"));
const tester = codeBlocks.find((body) => body.includes("name: tester"));
const reviewer = codeBlocks.find((body) => body.includes("name: reviewer"));
const ship = codeBlocks.find((body) => body.includes("name: ship") && body.includes("STEP 1"));
const shipRun = codeBlocks.find((body) => body.startsWith("/ship 부모님과 제주도"));
const shipFix = codeBlocks.find((body) => body.startsWith("/ship 기존 테스트 결과"));
if (!planner || !coder || !tester || !reviewer || !ship || !shipRun || !shipFix) {
  throw new Error(`프롬프트 추출 실패. codes=${codeBlocks.length}`);
}

const prompts = [
  { title: "Planner 서브에이전트", body: planner, summary: "요청을 구현 계획과 완료 기준으로 바꾸는 planner.md입니다." },
  { title: "Coder 서브에이전트", body: coder, summary: "spec.md만 구현하는 coder.md입니다." },
  { title: "Tester 서브에이전트", body: tester, summary: "요구사항 충족 여부만 검사하는 tester.md입니다." },
  { title: "Reviewer 서브에이전트", body: reviewer, summary: "SHIP/NEEDS WORK/BLOCK을 판정하는 reviewer.md입니다." },
  { title: "/ship 오케스트레이터 스킬", body: ship, summary: "Planner부터 Reviewer까지 순서대로 실행하는 SKILL.md입니다." },
  { title: "/ship 제주 여행 HTML 예시", body: shipRun, summary: "4단계 에이전트 팀을 실행하는 첫 요청 예시입니다." },
  { title: "/ship 테스트 실패 수정", body: shipFix, summary: "FAIL이 난 뒤 같은 파이프라인으로 고치는 요청입니다." },
];

const markdown = [
  `# ${pageTitle}`,
  `> 원문. [Worpsense](${sourceUrl})`,
  articleMarkdown,
].join("\n\n");
const pageContent = JSON.stringify(markdownToTiptapDoc(markdown));
const media = extractPageMediaReferences(pageContent);
if (!pageContent.includes(sourceUrl)) throw new Error("원문 주소가 없습니다.");
if (media.imageSources.some((src) => !src.startsWith("data:image/"))) throw new Error("이미지가 data URL이 아닙니다.");
if (media.imageSources.length < 5) throw new Error(`본문 이미지가 부족합니다. ${media.imageSources.length}`);
if (pageContent.includes("merlin_banner") || pageContent.includes("동의하고 구독")) {
  throw new Error("광고·구독 문구가 남아 있습니다.");
}

function isSamePage(rows) {
  const normalized = normalizedNotionWeekTitle(pageTitle);
  return rows.some((row) => (
    normalizedNotionWeekTitle(row.title) === normalized
    || (row.content != null && String(row.content).includes(sourceUrl))
  ));
}

function promptRows() {
  return prompts.map((item) => ({
    title: item.title,
    category,
    summary: item.summary,
    when_to_use: "Claude Code에서 역할이 나뉜 에이전트 팀을 만들 때 사용하세요.",
    sections: JSON.stringify([
      { title: "프롬프트", body: item.body },
      { title: "관련 Page", body: pageTitle },
      { title: "원문", body: sourceUrl },
    ]),
  }));
}

if (process.argv.includes("--check")) {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  const pages = db.prepare("SELECT title, content FROM custom_pages WHERE user_id = ?").all(localUser);
  db.close();
  console.log(JSON.stringify({
    writes: 0,
    pageTitle,
    images: media.imageSources.length,
    prompts: prompts.length,
    localPage: isSamePage(pages) ? "skip" : "insert",
  }, null, 2));
  process.exit(0);
}

function importLocal() {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { page: "skipped", promptsInserted: 0, promptsSkipped: 0 };
  const transaction = db.transaction(() => {
    const pages = db.prepare("SELECT title, content FROM custom_pages WHERE user_id = ?").all(localUser);
    if (!isSamePage(pages)) {
      db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(randomUUID(), localUser, pageTitle, pageContent, now, now);
      result.page = "inserted";
    }
    const existing = db.prepare("SELECT title, category FROM prompts WHERE user_id = ?").all(localUser);
    const insert = db.prepare("INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)");
    for (const prompt of promptRows()) {
      if (existing.some((row) => row.title === prompt.title && row.category === prompt.category)) {
        result.promptsSkipped += 1;
      } else {
        insert.run(randomUUID(), localUser, prompt.title, prompt.category, prompt.summary, prompt.when_to_use, prompt.sections, now, now);
        existing.push(prompt);
        result.promptsInserted += 1;
      }
    }
  });
  transaction();
  db.close();
  return result;
}

async function importProduction() {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const result = { page: "skipped", promptsInserted: 0, promptsSkipped: 0 };
  const { data: pages, error: pageError } = await supabase.from("custom_pages").select("id, title").eq("user_id", productionUser);
  if (pageError) throw pageError;
  if (!isSamePage(pages ?? [])) {
    const { error } = await supabase.from("custom_pages").insert({
      id: randomUUID(),
      user_id: productionUser,
      title: pageTitle,
      content: pageContent,
      created_at: now,
      updated_at: now,
    });
    if (error) throw error;
    result.page = "inserted";
  }
  const { data: existingPrompts, error: promptError } = await supabase
    .from("prompts")
    .select("title, category")
    .eq("user_id", productionUser)
    .eq("category", category);
  if (promptError) throw promptError;
  const stored = existingPrompts ?? [];
  for (const prompt of promptRows()) {
    if (stored.some((row) => row.title === prompt.title && row.category === prompt.category)) {
      result.promptsSkipped += 1;
    } else {
      const { error } = await supabase.from("prompts").insert({
        id: randomUUID(),
        user_id: productionUser,
        title: prompt.title,
        category: prompt.category,
        summary: prompt.summary,
        when_to_use: prompt.when_to_use,
        sections: prompt.sections,
        is_favorite: 0,
        created_at: now,
        updated_at: now,
      });
      if (error) throw error;
      stored.push(prompt);
      result.promptsInserted += 1;
    }
  }
  return result;
}

const local = importLocal();
const production = await importProduction();
console.log(JSON.stringify({
  pageTitle,
  images: media.imageSources.length,
  prompts: prompts.map((item) => item.title),
  local,
  production,
}, null, 2));
