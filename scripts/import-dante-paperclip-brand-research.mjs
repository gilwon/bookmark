// 단테랩스 Paperclip 브랜드 리서치 가이드와 재사용 프롬프트를 저장한다
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
  "https://dante-labs.com/blog/paperclip-brand-research-tutorial";
const CEO_PROMPT_URL =
  "https://raw.githubusercontent.com/dandacompany/brand-intelligence-lab/6bf58b1a129c78d21707e930661142d88035bcfa/issue-templates/ceo-bootstrap.md";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const LOCAL_USER = "dev";
const PAGE_TITLE =
  "[Paperclip × Bright Data] 시장조사 보고서 자동 생성 풀 가이드";
const CATEGORY = "Paperclip · 브랜드 리서치";
const now = new Date().toISOString();

// 로그인된 Dante Labs 원문을 2026-07-20에 표·코드 구조까지 보존해 압축한 스냅샷.
const PAGE_MARKDOWN_GZIP_BASE64 =
  "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";

const pageMarkdown = gunzipSync(
  Buffer.from(PAGE_MARKDOWN_GZIP_BASE64, "base64")
).toString("utf8");
const normalizedPageMarkdown = pageMarkdown
  .replace(`# ${PAGE_TITLE}\n\n`, "")
  .replace(/^(#{1,6}\s+\d+)\\\./gm, "$1.")
  .replace(/\\_/g, "_")
  .replace(/^\s*```/gm, "```")
  .replace(/^\s*›\s*$/gm, "")
  .replace(/^\* \* \*$/gm, "---")
  .replace(/<([^>\n]+)>/g, "[$1]");

function fenceAfter(marker) {
  const start = pageMarkdown.indexOf(marker);
  if (start < 0) throw new Error(`원문 마커 누락: ${marker}`);
  const match = /```[^\n]*\n([\s\S]*?)\n```/.exec(pageMarkdown.slice(start));
  if (!match) throw new Error(`원문 코드 블록 누락: ${marker}`);
  return match[1].replaceAll("\\*", "*").trim();
}

const response = await fetch(CEO_PROMPT_URL);
if (!response.ok) {
  throw new Error(`CEO 부트스트랩 원문 조회 실패: ${response.status}`);
}
const ceoBootstrap = (await response.text()).trim();

const prompts = [
  {
    title: "Paperclip 브랜드 인텔리전스 회사 미션",
    summary: "시장 데이터를 수집·분석해 임원 보고용 브랜드 리서치 보고서를 만드는 회사 목표입니다.",
    when: "Paperclip 온보딩의 Company Mission/goal을 입력할 때 사용하세요.",
    body: fenceAfter("Mission 본문 (옵셔널, 그대로 복사)"),
  },
  {
    title: "Paperclip 브랜드 인텔리전스 조직 부트스트랩",
    summary: "CEO에게 직원 3명 채용과 보고 라인·Goal 트리 등록을 한 번에 요청합니다.",
    when: "Brand Intelligence Lab의 첫 작업을 발행할 때 사용하세요.",
    body: fenceAfter("### 탭 3. Task — Give it something to do"),
  },
  {
    title: "Paperclip 브랜드 인텔리전스 CEO 페르소나",
    summary: "CEO의 역할·권한·응답 톤·보안 제약을 정의합니다.",
    when: "Paperclip CEO 에이전트의 Capabilities 또는 Instructions를 보강할 때 사용하세요.",
    body: fenceAfter("CEO capabilities 본문"),
  },
  {
    title: "Paperclip 브랜드 리서처 Bright Data CLI 지침",
    summary: "브랜드 리서처에게 Bright Data CLI의 허용 도구와 확인 방법을 알려줍니다.",
    when: "브랜드 리서처 AGENTS.md의 사용 도구 섹션을 작성할 때 사용하세요.",
    body: fenceAfter("브랜드 리서처 `AGENTS.md`"),
  },
  {
    title: "Paperclip 브랜드 시장조사 4단계 CEO 부트스트랩",
    summary: "무신사 조사부터 29CM 재실행까지 4단계 멀티에이전트 워크플로를 실행합니다.",
    when: "회사와 직원 설정 후 CEO에게 전체 시장조사 파이프라인을 발행할 때 사용하세요.",
    body: ceoBootstrap,
  },
  {
    title: "Paperclip 브랜드 리서치 공통 이슈 규칙",
    summary: "결과 제출·도구 표시·키 보안·출처 보존 규칙을 모든 이슈에 적용합니다.",
    when: "브랜드 리서치 이슈 본문 끝에 공통 운영 규칙을 붙일 때 사용하세요.",
    body: fenceAfter("## 6\\. 공통 규칙"),
  },
  {
    title: "Paperclip 브랜드 시장조사 Routine",
    summary: "브랜드명·공식 URL·경쟁사만 바꿔 시장조사 워크플로를 재실행합니다.",
    when: "Paperclip Routines에 반복 가능한 브랜드 조사 작업을 등록할 때 사용하세요.",
    body: fenceAfter("### 8.5.1 Routine 정의"),
  },
  {
    title: "Paperclip 활성 이슈 5개 조회",
    summary: "활성 이슈 5개의 상태와 담당자를 조회합니다.",
    when: "외부 Codex에서 Paperclip 보드의 진행 중 작업을 빠르게 확인할 때 사용하세요.",
    body: "Brand Intelligence Lab 의 활성 이슈 5개만 status·assignee 함께 보여줘.",
  },
  {
    title: "Paperclip 완료 이슈에 확인 코멘트",
    summary: "완료된 보고서 이슈를 찾아 확인 코멘트를 남깁니다.",
    when: "외부 Codex에서 완료 이슈에 검토 결과를 기록할 때 사용하세요.",
    body: '무신사 보고서 빌드 완료된 이슈에 "PDF 12장 확인" 코멘트 달아줘.',
  },
  {
    title: "Paperclip 29CM Routine 재실행",
    summary: "브랜드 시장조사 Routine을 29CM 변수로 다시 실행합니다.",
    when: "무신사 조사와 같은 구조로 29CM 보고서를 만들 때 사용하세요.",
    body: "29CM 재실행 routine 한번 돌려줘.",
  },
];

if (
  prompts.length !== 10 ||
  pageMarkdown.length < 30_000 ||
  ceoBootstrap.length < 12_000 ||
  !prompts.every((prompt) => prompt.body && prompt.summary && prompt.when)
) {
  throw new Error(
    `Page 또는 Prompt 구성이 불완전합니다. page=${pageMarkdown.length}, ceo=${ceoBootstrap.length}, prompts=${prompts.length}`
  );
}

if (process.argv.includes("--check")) {
  console.log({
    pageChars: pageMarkdown.length,
    ceoPromptChars: ceoBootstrap.length,
    prompts: prompts.length,
  });
  process.exit(0);
}

const pageContent = JSON.stringify(markdownToTiptapDoc(normalizedPageMarkdown));
const db = new Database(resolve(root, "data/mymark.db"));
const findLocalPage = db.prepare(
  "SELECT id, content FROM custom_pages WHERE user_id = ? AND (title = ? OR content LIKE ?)"
);
const existingLocalPage = findLocalPage.get(
  LOCAL_USER,
  PAGE_TITLE,
  `%${SOURCE}%`
);
const localPageId = existingLocalPage?.id ?? randomUUID();
let localPages = 0;
let localPageUpdates = 0;
let localPrompts = 0;

if (!existingLocalPage) {
  db.prepare(
    "INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(localPageId, LOCAL_USER, PAGE_TITLE, pageContent, now, now);
  localPages = 1;
} else if (existingLocalPage.content !== pageContent) {
  db.prepare(
    "UPDATE custom_pages SET title = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?"
  ).run(PAGE_TITLE, pageContent, now, localPageId, LOCAL_USER);
  localPageUpdates = 1;
}

const findLocalPrompt = db.prepare(
  "SELECT id FROM prompts WHERE user_id = ? AND title = ? AND category = ?"
);
const insertLocalPrompt = db.prepare(
  "INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (@id, @user_id, @title, @category, @summary, @when_to_use, @sections, 0, @created_at, @updated_at)"
);
for (const prompt of prompts) {
  if (findLocalPrompt.get(LOCAL_USER, prompt.title, CATEGORY)) continue;
  insertLocalPrompt.run({
    id: randomUUID(),
    user_id: LOCAL_USER,
    title: prompt.title,
    category: CATEGORY,
    summary: prompt.summary,
    when_to_use: prompt.when,
    sections: JSON.stringify([
      { title: "프롬프트", body: prompt.body },
      { title: "관련 Page", body: `/pages/${localPageId}` },
      { title: "원문", body: SOURCE },
    ]),
    created_at: now,
    updated_at: now,
  });
  localPrompts += 1;
}
db.close();

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
const { data: existingProdPages, error: prodPageLookupError } = await sb
  .from("custom_pages")
  .select("id, content")
  .eq("user_id", PROD_USER)
  .eq("title", PAGE_TITLE)
  .limit(1);
if (prodPageLookupError) throw prodPageLookupError;

const prodPageId = existingProdPages?.[0]?.id ?? randomUUID();
let prodPages = 0;
let prodPageUpdates = 0;
let prodPrompts = 0;
if (!existingProdPages?.length) {
  const { error } = await sb.from("custom_pages").insert({
    id: prodPageId,
    user_id: PROD_USER,
    title: PAGE_TITLE,
    content: pageContent,
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
  prodPages = 1;
} else if (existingProdPages[0].content !== pageContent) {
  const { error } = await sb
    .from("custom_pages")
    .update({ title: PAGE_TITLE, content: pageContent, updated_at: now })
    .eq("id", prodPageId)
    .eq("user_id", PROD_USER);
  if (error) throw error;
  prodPageUpdates = 1;
}

for (const prompt of prompts) {
  const { data, error } = await sb
    .from("prompts")
    .select("id")
    .eq("user_id", PROD_USER)
    .eq("title", prompt.title)
    .eq("category", CATEGORY)
    .limit(1);
  if (error) throw error;
  if (data?.length) continue;

  const { error: insertError } = await sb.from("prompts").insert({
    id: randomUUID(),
    user_id: PROD_USER,
    title: prompt.title,
    category: CATEGORY,
    summary: prompt.summary,
    when_to_use: prompt.when,
    sections: JSON.stringify([
      { title: "프롬프트", body: prompt.body },
      { title: "관련 Page", body: `/pages/${prodPageId}` },
      { title: "원문", body: SOURCE },
    ]),
    is_favorite: 0,
    created_at: now,
    updated_at: now,
  });
  if (insertError) throw insertError;
  prodPrompts += 1;
}

console.log({
  localPages,
  localPageUpdates,
  localPrompts,
  prodPages,
  prodPageUpdates,
  prodPrompts,
  localPage: `/pages/${localPageId}`,
  prodPage: `/pages/${prodPageId}`,
});
