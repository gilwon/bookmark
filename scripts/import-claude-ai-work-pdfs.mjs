// Claude·AI 업무 PDF 전문과 재사용 프롬프트를 Pages·Prompts에 저장한다
import { randomUUID } from "crypto";
import { execFileSync } from "child_process";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import { existsSync, readFileSync, readdirSync } from "fs";
import { basename, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const downloads = "/Users/gilwon/Downloads";
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2]
      .trim()
      .replace(/^(\"|')|(\"|')$/g, "");
  }
}

const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const LOCAL_USER = "dev";
const now = new Date().toISOString();

function findPdf(predicate) {
  const filename = readdirSync(downloads).find(
    (name) => name.endsWith(".pdf") && predicate(name.normalize("NFC")),
  );
  if (!filename) throw new Error("가져올 PDF를 찾지 못했습니다.");
  return resolve(downloads, filename);
}

const pdfs = [
  {
    title: "클로드 스킬 TOP 5 실제 적용 순서",
    path: findPdf((name) => name.includes("TOP5")),
  },
  {
    title: "업무시간을 줄이는 AI 자동화 프롬프트 50개",
    path: findPdf((name) => name.startsWith("AI_") && name.includes("50")),
  },
  {
    title: "34개 Claude Code 스킬 실행 가이드",
    path: findPdf((name) => name.startsWith("34")),
  },
  {
    title: "코딩 없이 만드는 나만의 AI 비서봇",
    path: findPdf((name) => name.startsWith("AI") && name.includes("비서봇")),
  },
];

function extractPdf(path) {
  return execFileSync("pdftotext", ["-layout", path, "-"], {
    encoding: "utf8",
  }).replace(/\f/g, "\n\n---\n\n");
}

function toPage(title, path) {
  const text = extractPdf(path)
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const textNode = (value) => ({ type: "text", text: value });
  const paragraph = (value) => ({
    type: "paragraph",
    content: value ? [textNode(value)] : undefined,
  });
  const content = [
    { type: "heading", attrs: { level: 1 }, content: [textNode(title)] },
    { type: "blockquote", content: [paragraph(`원본 PDF. ${basename(path)}`)] },
    { type: "heading", attrs: { level: 2 }, content: [textNode("전체 내용")] },
    ...text.split(/\n{2,}/).flatMap((block) =>
      block.trim() === "---"
        ? [{ type: "horizontalRule" }]
        : [paragraph(block.replace(/\n/g, " "))],
    ),
  ];
  return { title, content: JSON.stringify({ type: "doc", content }) };
}

function makePrompt({ title, category, summary, body }) {
  return {
    id: randomUUID(),
    user_id: LOCAL_USER,
    title,
    category,
    summary,
    when_to_use: "원문에 제시된 상황에서 바로 복사해 필요한 항목을 바꿔 사용하세요.",
    sections: JSON.stringify([{ title: "프롬프트", body }]),
    is_favorite: 0,
    created_at: now,
    updated_at: now,
  };
}

function parseAiAutomationPrompts(path) {
  const text = extractPdf(path)
    .replace(/\s*AI 업무 자동화 프롬프트 50개\s*$/gm, "")
    .replace(/\f/g, "\n");
  const matches = [...text.matchAll(/^\s*(\d{2})\s+(.+)$/gm)];
  if (matches.length !== 50) {
    throw new Error(`AI 자동화 프롬프트 수가 50개가 아닙니다. ${matches.length}`);
  }
  return matches.map((match, index) => {
    const body = text
      .slice(match.index + match[0].length, matches[index + 1]?.index)
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return makePrompt({
      title: `AI 업무 자동화 · ${match[1]} ${match[2].trim()}`,
      category: "AI 업무 자동화 · 50개 프롬프트",
      summary: `업무 자동화에 바로 쓰는 ${match[2].trim()} 프롬프트입니다.`,
      body,
    });
  });
}

function parseClaudeSkillsPrompts(path) {
  const text = extractPdf(path).replace(/\f/g, "\n");
  const skillMatches = [
    ...text.matchAll(/^\s*(\d{2})\s{2,}(.+)\n\s+([a-z][a-z-]+)\s*$/gm),
  ];
  if (skillMatches.length !== 33) {
    throw new Error(`Claude Code 전문 스킬 수가 33개가 아닙니다. ${skillMatches.length}`);
  }
  const ceoPrompt = text.match(/00\s+AI Operating CEO[\s\S]*?COPY PROMPT\s*\n([\s\S]*?)\n\s*1\s+목표를/);
  if (!ceoPrompt) throw new Error("AI Operating CEO 프롬프트를 찾지 못했습니다.");

  const rows = [
    makePrompt({
      title: "Claude Code 스킬 · AI Operating CEO",
      category: "Claude Code · 실행 가이드",
      summary: "목표에 맞춰 7개 전문 팀을 배정하고 하나의 실행 계획으로 통합합니다.",
      body: ceoPrompt[1].replace(/\n\s+/g, " ").trim(),
    }),
  ];
  for (const [index, match] of skillMatches.entries()) {
    const nextIndex = skillMatches[index + 1]?.index ?? text.length;
    const chunk = text.slice(match.index, nextIndex);
    const prompt = chunk.match(/COPY PROMPT\s*\n([\s\S]*?)$/);
    if (!prompt) throw new Error(`${match[2].trim()} 프롬프트를 찾지 못했습니다.`);
    rows.push(
      makePrompt({
        title: `Claude Code 스킬 · ${match[2].trim()}`,
        category: "Claude Code · 실행 가이드",
        summary: `${match[3].trim()} 역할을 호출하는 ${match[2].trim()} 실행 프롬프트입니다.`,
        body: prompt[1].replace(/\n\s+/g, " ").trim(),
      }),
    );
  }
  return rows;
}

const assistantPrompts = [
  {
    title: "AI 비서봇 · 텔레그램 봇 첫 구축",
    body: `텔레그램 봇을 만들어줘.
내가 보낸 메시지를 Claude(Anthropic API)에 전달하고, 그 답을 텔레그램으로 돌려줘.
봇 토큰과 API 키는 코드에 넣지 말고 환경변수로 빼줘.
초보자도 따라할 수 있게 한 단계씩 안내해줘.`,
  },
  {
    title: "AI 비서봇 · 아침 브리핑 기능 추가",
    body: "매일 아침 8시에 관심 키워드 뉴스와 오늘 일정을 요약해서 보내줘.",
  },
  {
    title: "AI 비서봇 · Gmail 중요 메일 요약",
    body: "내 Gmail 읽어서 중요한 것만 요약해줘.",
  },
  {
    title: "AI 비서봇 · 드라이브 문서 요약",
    body: "내 드라이브 OO 문서 불러와서 요약해줘.",
  },
  {
    title: "AI 비서봇 · 오류 해결 요청",
    body: "에러는 그대로 복사해서 붙일게. 원인을 설명하고 고쳐줘.",
  },
].map(({ title, body }) =>
  makePrompt({
    title,
    category: "AI 비서봇 · 구축 가이드",
    summary: "텔레그램 기반 AI 비서봇을 만들고 기능을 확장하는 실행 프롬프트입니다.",
    body,
  }),
);

const pages = pdfs.map(({ title, path }) => toPage(title, path));
const prompts = [
  ...parseAiAutomationPrompts(pdfs[1].path),
  ...parseClaudeSkillsPrompts(pdfs[2].path),
  ...assistantPrompts,
];

const db = new Database(resolve(root, "data/mymark.db"));
const findPage = db.prepare(
  "SELECT id FROM custom_pages WHERE user_id = ? AND title = ?",
);
const findPrompt = db.prepare(
  "SELECT id FROM prompts WHERE user_id = ? AND title = ? AND category = ?",
);
const insertPage = db.prepare(
  "INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
);
const insertPrompt = db.prepare(
  "INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (@id, @user_id, @title, @category, @summary, @when_to_use, @sections, @is_favorite, @created_at, @updated_at)",
);
let localPages = 0;
let localPrompts = 0;
for (const page of pages) {
  if (findPage.get(LOCAL_USER, page.title)) continue;
  insertPage.run(randomUUID(), LOCAL_USER, page.title, page.content, now, now);
  localPages += 1;
}
for (const prompt of prompts) {
  if (findPrompt.get(LOCAL_USER, prompt.title, prompt.category)) continue;
  insertPrompt.run(prompt);
  localPrompts += 1;
}
db.close();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
let prodPages = 0;
let prodPrompts = 0;
for (const page of pages) {
  const { data, error } = await supabase
    .from("custom_pages")
    .select("id")
    .eq("user_id", PROD_USER)
    .eq("title", page.title)
    .limit(1);
  if (error) throw error;
  if (data?.length) continue;
  const { error: insertError } = await supabase.from("custom_pages").insert({
    id: randomUUID(),
    user_id: PROD_USER,
    ...page,
    created_at: now,
    updated_at: now,
  });
  if (insertError) throw insertError;
  prodPages += 1;
}
for (const prompt of prompts) {
  const { data, error } = await supabase
    .from("prompts")
    .select("id")
    .eq("user_id", PROD_USER)
    .eq("title", prompt.title)
    .eq("category", prompt.category)
    .limit(1);
  if (error) throw error;
  if (data?.length) continue;
  const { id, user_id, is_favorite, ...row } = prompt;
  const { error: insertError } = await supabase.from("prompts").insert({
    id: randomUUID(),
    user_id: PROD_USER,
    is_favorite: 0,
    ...row,
  });
  if (insertError) throw insertError;
  prodPrompts += 1;
}

console.log({
  parsedPages: pages.length,
  parsedPrompts: prompts.length,
  localPages,
  localPrompts,
  prodPages,
  prodPrompts,
});
