// 네이버 블로그 클로드 세팅 핵심 프롬프트 4개를 Pages에만 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
export const PAGE_TITLE = "네이버 블로그를 클로드 세팅법 핵심 프롬프트";

const PROMPT_TOPIC = `최근 30일 동안 네이버블로그, 인스타, 유튜브 쇼츠, 커뮤니티에서 [분야] 상위 성과 콘텐츠를 찾아줘.

반복적으로 터지는 제목, 키워드, 정보 구조를 찾아줘.

여러 플랫폼에서 공통으로 반응이 높은 포인트를 교차 분석해서

블로그에 바로 쓸 수 있는 고수요 콘텐츠 각도 5개를 뽑아줘.`;

const PROMPT_TITLE = `네이버블로그 [분야] 상위 글 10개를 분석해.

클릭을 부르는 제목 패턴, 도입부 흐름, 감정 트리거를 찾아줘.

그리고 제목 5개와 첫 3문장 도입부 5개를 새로 만들어줘.

놀라움, 공감, 불안, 욕망 같은 심리 트리거 중심으로.`;

const PROMPT_STRUCTURE = `네이버블로그 [주제] 포스팅을 써줘.

첫 3문장에 강한 훅을 넣고

중간에는 공감 – 정보 – 사례 – 정리 흐름으로 구성해줘.

문단은 짧고 쉽게, 스크롤이 끊기지 않게.

마지막에는 체크리스트와 부드러운 CTA도 넣어줘.`;

const PROMPT_AUTOMATION = `매일 [분야]에서 검색량이 오르는 주제를 찾고,

클릭 잘 나오는 제목, 체류시간 높은 원고, 썸네일 문구, 발행 체크리스트까지 자동으로 만드는 블로그 시스템을 설계해줘.

이 과정을 매일 반복 가능한 워크플로우로 정리해줘.`;

export const REQUIRED_PHRASES = [
  "고수요 콘텐츠 각도 5개",
  "심리 트리거 중심으로",
  "체류형 포스팅",
  "매일 반복 가능한 워크플로우",
];

export function buildPageMarkdown() {
  return `# ${PAGE_TITLE}

[분야]와 [주제]만 바꿔서 클로드에 붙여 넣습니다.

## 1. 주제 & 콘텐츠 검증

\`\`\`
${PROMPT_TOPIC}
\`\`\`

## 2. 제목 + 체류 설계

\`\`\`
${PROMPT_TITLE}
\`\`\`

## 3. 글 구조 설계 (체류형 포스팅)

\`\`\`
${PROMPT_STRUCTURE}
\`\`\`

## 4. AI로 만드는 블로그 자동화

\`\`\`
${PROMPT_AUTOMATION}
\`\`\`
`;
}

export function countCodeBlocks(tiptapJsonString) {
  let count = 0;
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "codeBlock") count += 1;
    for (const child of node.content ?? []) visit(child);
  }
  visit(JSON.parse(tiptapJsonString));
  return count;
}

const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const k = match[1].trim();
    let v = match[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

function loadMarkdownToTiptap() {
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(
    resolve(root, "src/lib/markdown-to-tiptap.ts")
  );
  return markdownToTiptapDoc;
}

function assertIntegrity(markdown, content) {
  if (!markdown.includes(`# ${PAGE_TITLE}`)) {
    throw new Error("페이지 제목이 없습니다.");
  }
  for (const phrase of REQUIRED_PHRASES) {
    if (!markdown.includes(phrase)) throw new Error(`문구가 없습니다. ${phrase}`);
  }
  const codeBlocks = countCodeBlocks(content);
  if (codeBlocks !== 4) {
    throw new Error(`코드 블록 수가 4가 아닙니다. ${codeBlocks}`);
  }
}

function importLocal(page) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pages: 0, pageUpdates: 0, pageSkips: 0, pageId: page.id };
  const existing = db
    .prepare(
      "SELECT id, content FROM custom_pages WHERE user_id = ? AND title = ?"
    )
    .get(LOCAL_USER, page.title);
  if (existing && existing.content === page.content) {
    result.pageSkips += 1;
    result.pageId = existing.id;
  } else if (existing) {
    db.prepare(
      "UPDATE custom_pages SET content = ?, updated_at = ? WHERE id = ? AND user_id = ?"
    ).run(page.content, page.updated_at, existing.id, LOCAL_USER);
    result.pageUpdates += 1;
    result.pageId = existing.id;
  } else {
    db.prepare(
      `INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      page.id,
      LOCAL_USER,
      page.title,
      page.content,
      page.created_at,
      page.updated_at
    );
    result.pages += 1;
  }
  db.close();
  return result;
}

async function importProduction(page) {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const result = { pages: 0, pageUpdates: 0, pageSkips: 0, pageId: page.id };
  const { data, error } = await supabase
    .from("custom_pages")
    .select("id, content")
    .eq("user_id", PROD_USER)
    .eq("title", page.title)
    .limit(1);
  if (error) throw error;
  const existing = data?.[0];
  if (existing && existing.content === page.content) {
    result.pageSkips += 1;
    result.pageId = existing.id;
    return result;
  }
  if (existing) {
    const { error: updateError } = await supabase
      .from("custom_pages")
      .update({ content: page.content, updated_at: page.updated_at })
      .eq("id", existing.id)
      .eq("user_id", PROD_USER);
    if (updateError) throw updateError;
    result.pageUpdates += 1;
    result.pageId = existing.id;
    return result;
  }
  const { error: insertError } = await supabase.from("custom_pages").insert({
    id: page.id,
    user_id: PROD_USER,
    title: page.title,
    content: page.content,
    created_at: page.created_at,
    updated_at: page.updated_at,
  });
  if (insertError) throw insertError;
  result.pages += 1;
  return result;
}

async function main() {
  const markdown = buildPageMarkdown();
  const markdownToTiptapDoc = loadMarkdownToTiptap();
  const content = JSON.stringify(markdownToTiptapDoc(markdown));
  assertIntegrity(markdown, content);

  if (process.argv.includes("--check")) {
    console.log({
      pageTitle: PAGE_TITLE,
      markdownLength: markdown.length,
      codeBlocks: countCodeBlocks(content),
    });
    return;
  }

  const now = new Date().toISOString();
  const record = {
    id: randomUUID(),
    title: PAGE_TITLE,
    content,
    created_at: now,
    updated_at: now,
  };
  const local = importLocal(record);
  record.id = local.pageId;
  const production = await importProduction(record);
  const pageId = production.pageId || local.pageId;
  console.log({
    local: {
      pages: local.pages,
      pageUpdates: local.pageUpdates,
      pageSkips: local.pageSkips,
    },
    production: {
      pages: production.pages,
      pageUpdates: production.pageUpdates,
      pageSkips: production.pageSkips,
    },
    pageId,
    path: `/pages/${pageId}`,
  });
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
