// 블로그 주제 찾기 프롬프트 8단계를 Pages에만 저장한다
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
export const PAGE_TITLE = "블로그 주제 찾기";

const PROMPT_1 = `나는 [관심 분야]에 관심이 있고 [타깃 독자]를 대상으로 블로그를 운영하려고 해.

블로그로 수익화하기 좋은 주제 5개를 추천해줘.

각 주제마다 다음을 알려줘.
• 검색 수요
• 경쟁 강도
• 지속적인 콘텐츠 제작 난이도
• 애드포스트/애드센스 수익화 가능성
• 제휴마케팅 가능성
• 상품이나 서비스로 확장 가능성

마지막으로 초보자가 오늘 하나만 시작한다면 어떤 주제가 가장 좋은지 추천해줘.

수익화 가능성이 높은 순서대로 정렬해줘.`;

const PROMPT_2 = `[주제]로 블로그를 운영하려고 해.

사람들이 실제로 검색할 가능성이 높은 키워드 30개를 추천해줘.

정보형, 문제 해결형, 비교형, 추천형, 후기형, 구매 직전 검색어를 적절히 섞어줘.

각 키워드마다 다음을 알려줘.
• 검색 의도
• 예상 독자
• 작성하면 좋은 콘텐츠 방향

마지막으로 초보자가 먼저 작성하면 좋은 키워드 TOP 10을 선정해줘.`;

const PROMPT_3 = `[키워드]를 활용해서 검색 결과에서 클릭하고 싶어지는 블로그 제목 20개를 만들어줘.

다음 유형으로 각각 5개씩 작성해줘.

1. 숫자형
2. 궁금증형
3. 문제 해결형
4. 경험/후기형

조건:
• 핵심 키워드를 자연스럽게 포함
• 과도한 광고 문구 금지
• 실제 사람이 쓴 것처럼 자연스럽게
• 검색자의 궁금증이 느껴지게 작성

마지막으로 클릭률이 가장 높을 것 같은 TOP 3도 선정해줘.`;

const PROMPT_4 = `[키워드]로 블로그 글을 작성하려고 해.

검색한 사람이 원하는 답을 빠르게 얻으면서 끝까지 읽을 수 있는 글 구조를 만들어줘.

다음 구조를 포함해줘.

• 첫 문단에서 검색자의 고민 제시
• 핵심 답변 먼저 제공
• 본문 소제목 4~6개
• 실제 사례 또는 예시
• 사람들이 자주 하는 실수
• 핵심 내용 요약
• 다음 행동을 유도하는 마무리

불필요하게 긴 서론은 제거하고 검색 의도에 맞춰 구성해줘.`;

const PROMPT_5 = `아래 정보를 바탕으로 블로그 글 초안을 작성해줘.

주제: [주제]
핵심 키워드: [키워드]
타깃 독자: [타깃]
글의 목적: [정보 제공/후기/상품 소개/제휴마케팅]

조건:
• 첫 문단에서 핵심 답변 먼저 제공
• 짧고 읽기 쉬운 문장 사용
• 소제목 적극 활용
• 어려운 내용은 쉽게 설명
• 실제 사람이 쓴 것처럼 자연스럽게
• 같은 표현 반복 금지
• 단순 정보 나열보다 사례와 예시 포함

마지막에는 핵심 내용을 3줄로 요약해줘.`;

const PROMPT_6 = `아래 블로그 글을 분석해서 새로운 콘텐츠 아이디어 10개로 만들어줘.

[블로그 글 붙여넣기]

각 콘텐츠마다 다음을 작성해줘.

• 제목
• 핵심 메시지
• 타깃 독자
• 원본과 다른 관점
• 추천 콘텐츠 형식

블로그 후속 글, 유튜브 쇼츠, Threads, 인스타그램, 뉴스레터 등 다양한 플랫폼으로 활용할 수 있게 만들어줘.

각각 원본을 보지 않아도 이해할 수 있는 독립적인 콘텐츠로 만들어줘.`;

const PROMPT_7 = `다음 블로그 또는 콘텐츠를 분석해줘.

[블로그 주소 또는 콘텐츠 붙여넣기]

다음을 찾아줘.

1. 잘되는 콘텐츠들의 공통 주제
2. 제목의 공통 패턴
3. 글 도입부 구조
4. 소제목 구성 방식
5. 독자가 오래 읽게 만드는 요소
6. 댓글이나 반응을 유도하는 방식
7. 수익화로 연결하는 방법
8. 경쟁자가 아직 제대로 다루지 않은 콘텐츠 빈틈

마지막으로 이 분석을 바탕으로 내가 작성하면 좋을 블로그 콘텐츠 아이디어 10개를 추천해줘.

단순 복제가 아니라 잘되는 구조만 벤치마킹할 수 있게 분석해줘.`;

const PROMPT_8 = `나는 [분야] 블로그를 운영하고 있고 현재 일 방문자는 [방문자 수]명, 월 조회수는 [조회수]회야.

이 블로그로 현실적으로 돈을 벌 수 있는 방법 7가지를 추천해줘.

다음 수익모델을 함께 검토해줘.

• 애드포스트/애드센스
• 제휴마케팅
• 전자책
• 강의
• 컨설팅
• 협찬
• 자체 상품/서비스

각 방법마다 다음을 알려줘.

• 예상 수익
• 시작 난이도
• 필요한 방문자 또는 조회수
• 첫 수익까지 필요한 과정
• 오늘 당장 해야 할 행동 3가지

가장 현실적으로 빠르게 수익화할 수 있는 순서대로 정렬해줘.`;

export const REQUIRED_PHRASES = [
  "[관심 분야]",
  "키워드 30개",
  "클릭하고 싶어지는 블로그 제목 20개",
  "불필요하게 긴 서론은 제거하고",
  "핵심 내용을 3줄로 요약해줘",
  "[블로그 글 붙여넣기]",
  "경쟁자가 아직 제대로 다루지 않은 콘텐츠 빈틈",
  "오늘 당장 해야 할 행동 3가지",
];

export function buildPageMarkdown() {
  return `# ${PAGE_TITLE}

주제 선정부터 키워드, 제목, 글 구조, 초안, 재활용, 경쟁 분석, 수익화까지 8단계로 정리한다.

## 1. 돈 되는 블로그 주제 찾기
\`\`\`
${PROMPT_1}
\`\`\`

## 2. 검색되는 키워드 30개 찾기
\`\`\`
${PROMPT_2}
\`\`\`

## 3. 클릭되는 블로그 제목 20개 만들기
\`\`\`
${PROMPT_3}
\`\`\`

## 4. 상위 노출을 노리는 글 구조 만들기
\`\`\`
${PROMPT_4}
\`\`\`

## 5. 블로그 글 초안 한 번에 만들기
\`\`\`
${PROMPT_5}
\`\`\`

## 6. 글 하나를 콘텐츠 10개로 재활용하기
\`\`\`
${PROMPT_6}
\`\`\`

## 7. 잘되는 경쟁 블로그 분석하기
\`\`\`
${PROMPT_7}
\`\`\`

## 8. 블로그를 실제 수익으로 연결하기
\`\`\`
${PROMPT_8}
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
  if (codeBlocks !== 8) {
    throw new Error(`코드 블록 수가 8이 아닙니다. ${codeBlocks}`);
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
