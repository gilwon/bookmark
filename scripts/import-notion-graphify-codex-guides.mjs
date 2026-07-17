// 공개 Notion 가이드 전문과 확인된 재사용 프롬프트를 Pages·Prompts에 저장한다
import { randomUUID } from "crypto";
import { execFileSync } from "child_process";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envPath = resolve(root, ".env.local");
const playwright = "/Users/gilwon/.codex/skills/playwright/scripts/playwright_cli.sh";
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2]
      .trim()
      .replace(/^(["'])|(["'])$/g, "");
  }
}

const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const LOCAL_USER = "dev";
const now = new Date().toISOString();
const guides = [
  {
    title: "클로드 코드가 파일부터 뒤지지 않게 만드는 Graphify 가이드",
    url: "https://app.notion.com/p/Graphify-3a028466a54e81bc9546d92506bd9b22",
  },
  {
    title: "코덱스 제대로 뽕 뽑자! - 이미지 스튜디오 & 가상 미용실 세팅 가이드",
    url: "https://app.notion.com/p/39ffd99f0e5f81b0992fe0a8b99f9950",
  },
];

function fetchNotionText(url) {
  execFileSync(playwright, ["open", url], { encoding: "utf8" });
  const output = execFileSync(
    playwright,
    ["eval", "document.querySelector('main').innerText"],
    { encoding: "utf8" }
  );
  const match = /### Result\s*\n([\s\S]*?)\n### Ran Playwright code/.exec(output);
  if (!match) throw new Error("Notion 본문을 추출하지 못했습니다.");
  return JSON.parse(match[1]);
}

function toPage(title, url, text) {
  const paragraph = (value) => ({
    type: "paragraph",
    content: value ? [{ type: "text", text: value }] : undefined,
  });
  const content = [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: title }] },
    { type: "blockquote", content: [paragraph(`원문. ${url}`)] },
    ...text
      .replace(/^📘\n|^📁\n/, "")
      .replace(/\n​\n/g, "\n")
      .split(/\n{2,}/)
      .map((block) => paragraph(block.replace(/\n/g, " ").trim())),
  ];
  return { title, content: JSON.stringify({ type: "doc", content }) };
}

const promptRows = [
  {
    title: "Graphify .graphifyignore 후보 제안",
    category: "Claude Code · Graphify",
    summary: "생성물·캐시·외부 의존성만 골라 Graphify 제외 후보를 검토합니다.",
    when_to_use: "Graphify를 처음 실행하기 전 분석 대상에서 빼야 할 파일을 정리할 때 사용하세요.",
    body: "이 저장소에서 생성물, 캐시, 외부 의존성만 골라 .graphifyignore 후보를 제안해줘.\n실제 소스, 설정, 마이그레이션, 테스트는 임의로 제외하지 마.\n파일은 아직 수정하지 말고 후보와 이유만 보여줘.",
  },
  {
    title: "Graphify 우선 코드베이스 질문",
    category: "Claude Code · Graphify",
    summary: "파일을 열기 전 Graphify로 관련 범위와 근거를 먼저 좁힙니다.",
    when_to_use: "큰 코드베이스에서 질문의 관련 파일을 최소 범위로 찾고 싶을 때 사용하세요.",
    body: "이 질문은 먼저 Graphify로 범위를 좁혀줘.\n관련 노드와 경로를 찾은 뒤 근거가 필요한 소스 파일만 열고 파일과 줄 위치를 붙여 답해줘.\n질문: [여기에 코드베이스 질문]",
  },
  {
    title: "Graphify 온보딩 분석",
    category: "Claude Code · Graphify",
    summary: "그래프를 기반으로 프로젝트의 진입점·요청 흐름·저장 경로를 파악합니다.",
    when_to_use: "새 코드베이스를 빠르게 이해해야 할 때 사용하세요.",
    body: "Graphify에서 핵심 노드와 커뮤니티를 먼저 확인해줘.\n이 프로젝트의 진입점, 주요 요청 흐름, 데이터 저장 경로를 설명하고 각 설명에 근거 파일과 줄 위치를 붙여줘.\nINFERRED 관계는 추론이라고 표시해줘.",
  },
  {
    title: "Graphify 변경 영향 범위 분석",
    category: "Claude Code · Graphify",
    summary: "수정 전 호출자와 의존 대상을 우선순위로 정리합니다.",
    when_to_use: "클래스나 함수를 변경하기 전 영향 범위를 점검할 때 사용하세요.",
    body: "[바꾸려는 클래스나 함수]를 수정하기 전에 Graphify로 연결된 호출자와 의존 대상을 찾아줘.\n직접 연결과 간접 연결을 구분하고 실제 수정 전에 열어봐야 할 파일만 우선순위대로 보여줘.",
  },
  {
    title: "Graphify 버그 경로 추적",
    category: "Claude Code · Graphify",
    summary: "오류 증상부터 실패 지점까지의 연결 경로를 추적합니다.",
    when_to_use: "복잡한 요청 흐름에서 버그 위치를 좁힐 때 사용하세요.",
    body: "[에러 증상]과 관련된 노드를 Graphify query로 찾고 요청이 실패 지점까지 가는 경로를 추적해줘.\nEXTRACTED 엣지를 우선하고 INFERRED 엣지는 소스에서 다시 확인해줘.",
  },
  {
    title: "Graphify 설계 이유 찾기",
    category: "Claude Code · Graphify",
    summary: "기능의 구현 방식보다 설계 근거 문서를 먼저 찾습니다.",
    when_to_use: "기능·아키텍처의 의사결정 배경을 파악할 때 사용하세요.",
    body: "Graphify에서 [기능 이름]과 연결된 NOTE, WHY, ADR, RFC 근거를 찾아줘.\n무엇을 하는지보다 왜 이렇게 설계했는지 중심으로 설명하고 출처 파일을 붙여줘.",
  },
  {
    title: "Codex 이미지 스튜디오 폴더 정리",
    category: "Codex · 이미지 워크플로",
    summary: "사진 폴더를 페르소나 이미지 스튜디오용으로 분류하고 작업 규칙을 설계합니다.",
    when_to_use: "Codex에 사진 폴더를 연결해 이미지 생성 작업을 시작할 때 사용하세요.",
    body: "이 폴더를 페르소나 이미지 스튜디오로 사용하고 싶어. 현재 들어 있는 사진을 먼저 확인하고, 인물 얼굴 사진과 분위기 참고 사진이 섞이지 않게 나눠줘. 사진마다 번호를 붙이고, 새 작업방에서도 같은 방식으로 이어갈 수 있도록 필요한 폴더와 작업 규칙도 만들어줘. 아직 이미지는 생성하지 말고 먼저 어떻게 정리할지 보여줘.",
  },
].map((row) => ({
  id: randomUUID(), user_id: LOCAL_USER, sections: JSON.stringify([{ title: "프롬프트", body: row.body }]), is_favorite: 0, created_at: now, updated_at: now, ...row,
}));

const pages = guides.map((guide) => toPage(guide.title, guide.url, fetchNotionText(guide.url)));
const db = new Database(resolve(root, "data/mymark.db"));
const findPage = db.prepare("SELECT id FROM custom_pages WHERE user_id = ? AND title = ?");
const findPrompt = db.prepare("SELECT id FROM prompts WHERE user_id = ? AND title = ? AND category = ?");
const insertPage = db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
const insertPrompt = db.prepare("INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (@id, @user_id, @title, @category, @summary, @when_to_use, @sections, @is_favorite, @created_at, @updated_at)");
let localPages = 0;
let localPrompts = 0;
for (const page of pages) if (!findPage.get(LOCAL_USER, page.title)) { insertPage.run(randomUUID(), LOCAL_USER, page.title, page.content, now, now); localPages++; }
for (const prompt of promptRows) if (!findPrompt.get(LOCAL_USER, prompt.title, prompt.category)) { insertPrompt.run(prompt); localPrompts++; }
db.close();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let prodPages = 0;
let prodPrompts = 0;
for (const page of pages) {
  const { data, error } = await sb.from("custom_pages").select("id").eq("user_id", PROD_USER).eq("title", page.title);
  if (error) throw error;
  if (!data?.length) { const { error: insertError } = await sb.from("custom_pages").insert({ id: randomUUID(), user_id: PROD_USER, ...page, created_at: now, updated_at: now }); if (insertError) throw insertError; prodPages++; }
}
for (const prompt of promptRows) {
  const { data, error } = await sb.from("prompts").select("id").eq("user_id", PROD_USER).eq("title", prompt.title).eq("category", prompt.category);
  if (error) throw error;
  if (!data?.length) {
    const { body, ...row } = prompt;
    const { error: insertError } = await sb.from("prompts").insert({ ...row, id: randomUUID(), user_id: PROD_USER });
    if (insertError) throw insertError;
    prodPrompts++;
  }
}
console.log({ localPages, localPrompts, prodPages, prodPrompts });
