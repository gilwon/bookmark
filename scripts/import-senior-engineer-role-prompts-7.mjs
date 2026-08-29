// 시니어 엔지니어 역할 프롬프트 7개를 Pages 한 건으로 저장한다
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

export const PAGE_TITLE =
  "시니어 엔지니어 역할 프롬프트 7개 — 제로베이스 앱부터 UI까지";
export const MARKER =
  "완전한 프로덕션 레디 애플리케이션을 개발하는 시니어 풀스택 엔지니어처럼 생각하라.";
export const EXISTING_TITLE = "시니어 엔지니어 모드 프롬프트 7가지";

export const PROMPTS = [
  {
    heading: "1. 제로베이스에서 완성형 앱 만들기",
    body: `완전한 프로덕션 레디 애플리케이션을 개발하는 시니어 풀스택 엔지니어처럼 생각하라. 먼저 시스템 아키텍처를 설계하고, 그다음 최소한이지만 확장 가능한 버전을 개발하라.

결과물에 포함할 것: • 아키텍처 • 파일 구조 • 데이터베이스 스키마 • API 엔드포인트 • UI 구조 • 전체 코드

실제 스타트업 MVP처럼 설계하고, 확장 가능하게 만들 것.`,
  },
  {
    heading: "2. 코드베이스 이해 및 리팩터링",
    body: `낯선 대규모 코드베이스에 막 합류한 시니어 엔지니어처럼 생각하라. 먼저 아키텍처와 데이터 흐름을 파악하라. 그다음 다음을 식별하라: • 구조적 문제 • 중복 코드 • 성능 병목 • 유지보수 리스크

결과물: • 아키텍처 요약 • 문제 영역 • 리팩터링 전략 • 개선된 코드

기능은 그대로 유지하고, 품질만 끌어올릴 것.`,
  },
  {
    heading: "3. 시니어 디버깅 엔지니어",
    body: `프로덕션 환경의 버그를 조사하는 시니어 디버깅 엔지니어처럼 생각하라. • 코드를 꼼꼼히 분석하고 • 단계별로 사고하고 • 근본 원인을 찾고 • 견고한 해결책을 제안하라

결과물: • 코드가 하는 일 • 무엇이 문제인지 • 왜 실패하는지 • 엣지 케이스 • 수정된 프로덕션 레디 코드`,
  },
  {
    heading: "4. 시스템 설계 + 구현",
    body: `시니어 시스템 아키텍트처럼 생각하라. 해당 제품을 위한 확장 가능한 시스템을 설계한 뒤, 최소 프로덕션 버전을 개발하라. 포함할 것: • 아키텍처 • 컴포넌트 구조 • 데이터 흐름 • API 설계 • 데이터베이스 스키마 • 캐싱 전략 • 구현 코드`,
  },
  {
    heading: "5. 성능 최적화",
    body: `코드를 최적화하는 퍼포먼스 엔지니어처럼 생각하라. 목표: • 속도 • 메모리 사용량 • 확장성

찾을 것: • 병목 지점 • 비효율적 로직 • 불필요한 렌더링

결과물: • 성능 이슈 • 최적화 전략 • 개선된 코드`,
  },
  {
    heading: "6. Claude 멀티 에이전트 워크플로",
    body: `너는 협업하는 4명의 에이전트다: • 아키텍트 • 엔지니어 • 리뷰어 • 옵티마이저

역할: • 아키텍트 → 시스템 설계 • 엔지니어 → 개발 • 리뷰어 → 품질 관리 • 옵티마이저 → 성능 개선

결과물: • 아키텍처 • 구현 • 리뷰 피드백 • 최종 최적화 버전`,
  },
  {
    heading: "7. 프로덕션급 UI 컴포넌트 빌더",
    body: `시니어 프론트엔드 엔지니어처럼 생각하고 다음을 만들어라: • 재사용 가능한 UI 컴포넌트 • 접근성 준수 • 프로덕션 레디

고려할 것: • 로딩 상태 • 엣지 케이스 • 반응형 디자인 • 접근성

결과물: • 컴포넌트 구조 • Props 설계 • 구현 • 사용 예시`,
  },
];

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
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

/** 7개 역할 프롬프트를 복사 가능한 코드 블록으로 묶는다. */
export function buildMarkdown() {
  const sections = PROMPTS.map(
    (item) => `## ${item.heading}\n\n\`\`\`\n${item.body}\n\`\`\``
  );
  return [
    `# ${PAGE_TITLE}`,
    "앱을 처음부터 만들거나, 낯선 코드를 고치거나, UI를 다듬을 때 붙이는 역할 프롬프트 7개다. 기존 `시니어 엔지니어 모드 프롬프트 7가지`와 역할은 같고 문장은 다르다.",
    ...sections,
  ].join("\n\n");
}

export function isDuplicateRow(row, title, markers) {
  if (!row) return false;
  if (row.title === title) return true;
  const content = String(row.content ?? "");
  return markers.some((marker) => marker && content.includes(marker));
}

function countCodeBlocks(tiptapJsonString) {
  let count = 0;
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "codeBlock") count += 1;
    for (const child of node.content ?? []) visit(child);
  }
  visit(JSON.parse(tiptapJsonString));
  return count;
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

function findLocalPage(db, title, markers) {
  const byTitle = db
    .prepare(
      "SELECT id, title, content FROM custom_pages WHERE user_id = ? AND title = ?"
    )
    .get(LOCAL_USER, title);
  if (isDuplicateRow(byTitle, title, markers)) return byTitle;
  for (const marker of markers) {
    if (!marker) continue;
    const row = db
      .prepare(
        `SELECT id, title, content FROM custom_pages
         WHERE user_id = ? AND content LIKE ?
         LIMIT 1`
      )
      .get(LOCAL_USER, `%${marker}%`);
    if (isDuplicateRow(row, title, markers)) return row;
  }
  return null;
}

function importLocal(page, markers) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  const existing = findLocalPage(db, page.title, markers);
  if (existing) {
    result.pageSkips += 1;
    result.pageId = existing.id;
    db.close();
    return result;
  }
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
  const result = { pages: 0, pageSkips: 0, pageId: page.id };
  const { data, error } = await supabase
    .from("custom_pages")
    .select("id, title")
    .eq("user_id", PROD_USER)
    .eq("title", page.title)
    .limit(1);
  if (error) throw error;
  if (data?.[0]) {
    result.pageSkips += 1;
    result.pageId = data[0].id;
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

function assertIntegrity(markdown, content) {
  if (!markdown.includes(`# ${PAGE_TITLE}`)) {
    throw new Error("페이지 제목이 없습니다.");
  }
  if (markdown.includes(`# ${EXISTING_TITLE}`)) {
    throw new Error("기존 모드 7가지 제목을 덮었습니다.");
  }
  if (PROMPTS.length !== 7) throw new Error("프롬프트가 7개가 아닙니다.");
  for (const item of PROMPTS) {
    if (!markdown.includes(item.heading)) {
      throw new Error(`헤딩이 없습니다. ${item.heading}`);
    }
    if (!markdown.includes(item.body)) {
      throw new Error(`프롬프트 원문이 없습니다. ${item.heading}`);
    }
  }
  const codes = countCodeBlocks(content);
  if (codes !== 7) throw new Error(`코드 블록이 7개가 아닙니다. ${codes}`);
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const markdown = buildMarkdown();
  const markdownToTiptapDoc = loadMarkdownToTiptap();
  const content = JSON.stringify(markdownToTiptapDoc(markdown));
  assertIntegrity(markdown, content);
  const extra = {
    pageTitle: PAGE_TITLE,
    prompts: PROMPTS.length,
    codes: countCodeBlocks(content),
  };
  if (checkOnly) {
    console.log(JSON.stringify(extra, null, 2));
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
  const local = importLocal(record, [PAGE_TITLE, MARKER]);
  record.id = local.pageId;
  const production = await importProduction(record);
  const pageId = production.pageId || local.pageId;
  console.log(
    JSON.stringify(
      {
        ...extra,
        pageId,
        path: `/pages/${pageId}`,
        local: { pages: local.pages, pageSkips: local.pageSkips },
        production: {
          pages: production.pages,
          pageSkips: production.pageSkips,
        },
      },
      null,
      2
    )
  );
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
