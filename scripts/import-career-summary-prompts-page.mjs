// 경력 정리 프롬프트 5단계를 Pages에만 저장한다
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
export const PAGE_TITLE = "경력 정리 프롬프트";

const PROMPT_1 = `❌ 뭘 썼는지 모르겠어

✅ 너는 경력기술서를 돕는 컨설턴트다

내가 한 업무를
빠짐없이 꺼내게 도와줘

아래 기준으로 나눠줘

* 맡은 일
* 규모
* 기간

사소해 보여도 다 꺼내줘

내 설명이 애매하면
먼저 질문해줘

없는 걸 지어내지 말아줘

내 경력:
[여기에 쏟아내기]`;

const PROMPT_2 = `❌ 담당했다고밖에 못 쓰겠어

✅ 내가 한 일을
"담당했음"이 아니라 성과로 바꿔줘

아래 기준으로 정리해줘

* 무엇을 했는지
* 어떻게 했는지
* 결과가 어땠는지

숫자로 표현할 수 있는 건
숫자로 바꿔줘

내가 말 안 한 수치는
지어내지 말고 확인 필요로 표시해줘`;

const PROMPT_3 = `❌ 내 강점이 뭔지 모르겠어

✅ 정리한 경력에서
반복적으로 드러나는 강점을 찾아줘

아래 기준으로 정리해줘

* 핵심 역량
* 그렇게 판단한 근거

경력에 근거 없는 강점은
넣지 말아줘

내가 몰랐던 강점이 보이면
짚어줘`;

const PROMPT_4 = `❌ 어떻게 배치하지

✅ 경력기술서 구조를 잡아줘

아래 기준으로 정리해줘

* 핵심 성과 먼저
* 프로젝트별
* 강조할 순서

읽는 사람이 강점을 빨리 파악하게 배치해줘

약한 걸 앞에 두지 않게 짚어줘`;

const PROMPT_5 = `❌ 하나로 다 내면 되지

✅ 지원하는 곳에 맞게
강조할 경력을 골라줘

아래 기준으로 정리해줘

* 이 회사가 원하는 것
* 내 경력 중 맞는 것
* 순서 조정

없는 걸 만들지 말고
있는 것 중에서 재배치해줘`;

export const REQUIRED_PHRASES = [
  "너는 경력기술서를 돕는 컨설턴트다",
  "[여기에 쏟아내기]",
  "담당했음",
  "확인 필요로 표시해줘",
  "핵심 역량",
  "핵심 성과 먼저",
  "이 회사가 원하는 것",
];

export function buildPageMarkdown() {
  return `# ${PAGE_TITLE}

경력기술서를 꺼내고, 성과로 바꾸고, 강점을 찾고, 구조를 잡고, 지원처에 맞춘다.

## 1. 업무 꺼내기

**경력 정리 프롬프트**

\`\`\`
${PROMPT_1}
\`\`\`

한 일이 없는 게 아닐 수 있다.

업무를 역할, 규모, 결과로 나누지 않아서 짧게만 보였던 것일 수 있다.

## 2. 성과로 바꾸기

**성과 전환 프롬프트**

\`\`\`
${PROMPT_2}
\`\`\`

"담당했다"만 쓰면 내 역할과 기여가 잘 드러나지 않을 수 있다.

무엇을 바꾸고 어떤 결과를 냈는지 함께 보여주자.

## 3. 강점 뽑기

**역량 정리 프롬프트**

\`\`\`
${PROMPT_3}
\`\`\`

강점은 억지로 새로 만들기보다 실제로 해온 일에서 찾아야 설득력이 생긴다.

## 4. 구조 잡기

**구성 프롬프트**

\`\`\`
${PROMPT_4}
\`\`\`

읽는 사람은 앞부분에서 전체 인상을 잡을 수 있다.

강하게 보여줄 성과를 앞쪽에 배치해보자.

## 5. 맞춤 정리하기

**지원처 맞춤 프롬프트**

\`\`\`
${PROMPT_5}
\`\`\`

같은 경력이라도 지원하는 회사와 직무에 따라 강조할 부분이 달라질 수 있다.
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
  if (codeBlocks !== 5) {
    throw new Error(`코드 블록 수가 5가 아닙니다. ${codeBlocks}`);
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
