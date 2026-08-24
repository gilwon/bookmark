// 시니어 엔지니어 모드 프롬프트 7개를 Pages에만 저장한다
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
export const PAGE_TITLE = "시니어 엔지니어 모드 프롬프트 7가지";

const PROMPT_1 = `시니어 풀스택 엔지니어처럼 행동해.
[아이디어/서비스]를 위한 실제 출시 가능한 앱을 설계하고, 최소 기능이지만 확장 가능한 MVP까지 구현해줘.
정보가 부족하면 코드를 작성하기 전에 꼭 필요한 질문부터 해줘.
그다음 시스템 아키텍처를 먼저 설계하고 구현해줘.
결과에는 아래를 포함해줘.
- 핵심 기능과 기술 선택 이유
- 시스템 아키텍처
- 파일 구조
- 데이터베이스 스키마
- API 엔드포인트
- UI 구조
- 실행 가능한 코드
실제 스타트업 MVP처럼 현실적으로 설계해줘.`;

const PROMPT_2 = `처음 합류한 시니어 엔지니어처럼 [코드베이스/파일]를 분석해줘.
먼저 전체 아키텍처와 데이터 흐름을 이해하고, 정보가 부족하면 어떤 파일이나 맥락이 더 필요한지 질문해줘.
그다음 아래를 찾아줘.
- 구조적 문제
- 중복 코드
- 성능 병목
- 유지보수 위험
결과물에는 아키텍처 요약, 문제 구간, 리팩터링 전략, 개선 코드를 포함해줘.
단, 기존 기능은 바꾸지 말고 품질만 높여줘.`;

const PROMPT_3 = `실서비스 버그를 조사하는 시니어 디버깅 엔지니어처럼 행동해.
[에러 메시지/코드/재현 상황]을 분석해줘.
정보가 부족하면 원인을 추측하지 말고, 먼저 필요한 로그·코드·재현 조건을 질문해줘.
그다음 아래 순서로 진행해줘.
- 문제 현상 정리
- 근본 원인 분석
- 왜 오류가 발생하는지 설명
- 엣지 케이스 확인
- 안정적인 해결책 제안
마지막에는 수정된 프로덕션 수준의 코드를 제공해줘.`;

const PROMPT_4 = `시니어 시스템 아키텍트처럼 행동해.
[제품/기능]을 위한 확장 가능한 시스템을 설계하고, 필요한 최소 구현까지 만들어줘.
먼저 요구사항에서 불명확한 부분을 질문하고, 과한 설계는 피하면서 현재 단계에 맞는 구조를 제안해줘.
결과에는 아래를 포함해줘.
- 전체 아키텍처
- 컴포넌트 구조와 데이터 흐름
- API 설계
- 데이터베이스 스키마
- 캐싱 전략
- 구현 우선순위
- 핵심 구현 코드`;

const PROMPT_5 = `성능 엔지니어처럼 [코드/컴포넌트]를 분석해줘.
목표는 속도, 메모리 사용량, 확장성 개선이야.
먼저 현재 성능을 판단하려면 어떤 지표나 환경 정보가 필요한지 질문해줘.
그다음 아래를 찾아줘.
- 병목 구간
- 비효율적인 로직
- 불필요한 렌더링·연산
- 확장 시 문제가 될 부분
결과에는 문제의 우선순위, 개선 전략, 개선 코드, 기대 효과를 포함해줘.`;

const PROMPT_6 = `하나의 답변 안에서 아래 4개 역할을 순서대로 수행해줘.
1. Architect: 요구사항과 시스템 설계
2. Engineer: 설계를 바탕으로 구현
3. Reviewer: 누락, 버그, 품질 문제 검토
4. Optimizer: 구조와 성능 개선
[작업 내용]을 진행해줘.
각 역할의 결과를 섞지 말고 구분해서 보여줘.
마지막에는 리뷰와 최적화까지 반영한 최종안을 제공해줘.`;

const PROMPT_7 = `시니어 프론트엔드 엔지니어처럼 [만들 컴포넌트]를 구현해줘.
먼저 사용 중인 프레임워크, 스타일 방식, 디자인 조건이 부족하면 필요한 정보부터 질문해줘.
컴포넌트는 재사용 가능하고, 접근성과 반응형까지 고려해서 만들어줘.
아래 상황도 반드시 포함해줘.
- 로딩 상태
- 빈 상태
- 에러 상태
- 엣지 케이스
- 모바일 화면
결과에는 컴포넌트 구조, Props 설계, 구현 코드, 사용 예시를 포함해줘.`;

export const REQUIRED_PHRASES = [
  "[아이디어/서비스]",
  "[코드베이스/파일]",
  "[에러 메시지/코드/재현 상황]",
  "[제품/기능]",
  "[코드/컴포넌트]",
  "[작업 내용]",
  "[만들 컴포넌트]",
];

export const SECTIONS = [
  { heading: "1. 앱 처음부터 만들기", prompt: PROMPT_1 },
  { heading: "2. 코드베이스 분석·리팩터링", prompt: PROMPT_2 },
  { heading: "3. 시니어 디버깅 모드", prompt: PROMPT_3 },
  { heading: "4. 시스템 설계 + 구현", prompt: PROMPT_4 },
  { heading: "5. 성능 최적화", prompt: PROMPT_5 },
  { heading: "6. Claude 멀티 에이전트 워크플로우", prompt: PROMPT_6 },
  { heading: "7. 프로덕션급 UI 컴포넌트 만들기", prompt: PROMPT_7 },
];

export function buildPageMarkdown() {
  const sections = SECTIONS.map(
    (section) => `## ${section.heading}

\`\`\`
${section.prompt}
\`\`\``
  ).join("\n\n");
  return `# ${PAGE_TITLE}

앱 설계부터 디버깅·성능·UI까지 붙여 넣는 프롬프트 7개다.

${sections}
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
  if (codeBlocks !== 7) {
    throw new Error(`코드 블록 수가 7이 아닙니다. ${codeBlocks}`);
  }
  const fences = [...markdown.matchAll(/```(?:\w+)?\n([\s\S]*?)```/g)].map(
    (match) => match[1]
  );
  for (const section of SECTIONS) {
    if (!fences.some((body) => body.trim() === section.prompt)) {
      throw new Error(`펜스 원문이 없습니다. ${section.heading}`);
    }
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
