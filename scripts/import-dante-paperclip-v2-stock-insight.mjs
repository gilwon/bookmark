// 단테랩스 Paperclip v2 Stock Insight Lab 가이드와 재사용 프롬프트를 저장한다
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
  "https://dante-labs.com/blog/paperclip-v2-stock-insight-lab";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const LOCAL_USER = "dev";
const PAGE_TITLE =
  "삼성전자 멀티에이전트 분석 라이브 가이드 (Paperclip v2)";
const CATEGORY = "Paperclip · Stock Insight Lab";
const now = new Date().toISOString();

// 로그인된 Dante Labs 원문을 2026-07-20에 표와 코드 구조까지 보존해 압축한 스냅샷.
const PAGE_MARKDOWN_GZIP_BASE64 =
  "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";
const pageMarkdown = gunzipSync(
  Buffer.from(PAGE_MARKDOWN_GZIP_BASE64, "base64")
).toString("utf8");
const promptBodies = [
  ...pageMarkdown.matchAll(/```[^\n]*\n([\s\S]*?)```/g),
].map((match) => match[1].trim());

const promptMetadata = [
  {
    title: "Stock Insight Lab 회사 설명",
    summary: "단일 종목 멀티에이전트 분석 회사의 목적과 대상을 정의합니다.",
    when: "Paperclip에서 Stock Insight Lab 회사를 만들 때 사용하세요.",
  },
  {
    title: "Stock Insight Lab CEO 페르소나",
    summary: "투자 분석 조직을 총괄하는 CEO의 미션과 운영 원칙을 정의합니다.",
    when: "Paperclip에서 Stock Insight Lab CEO 에이전트를 만들 때 사용하세요.",
  },
  {
    title: "단일 종목 투자 분석 Goal",
    summary: "정량·정성 통합 분석 시스템의 최상위 목표를 등록합니다.",
    when: "Stock Insight Lab의 최상위 Goal을 만들 때 사용하세요.",
  },
  {
    title: "삼성전자 정성 데이터 Sub-Goal",
    summary: "뉴스·공시·산업 자료 수집과 구조화 목표를 정의합니다.",
    when: "정성 데이터 수집 세부 목표를 등록할 때 사용하세요.",
  },
  {
    title: "삼성전자 정량 데이터 Sub-Goal",
    summary: "주가·거래량·재무 데이터 분석 목표를 정의합니다.",
    when: "정량 데이터 분석 세부 목표를 등록할 때 사용하세요.",
  },
  {
    title: "투자 제언 리포트 Sub-Goal",
    summary: "검증된 종합 투자 제언 리포트의 목표와 구조를 정의합니다.",
    when: "리포트 생성 세부 목표를 등록할 때 사용하세요.",
  },
  {
    title: "투자 의사결정 시각화 Sub-Goal",
    summary: "분석 결과를 한눈에 보여주는 시각화 환경의 목표를 정의합니다.",
    when: "대시보드 시각화 세부 목표를 등록할 때 사용하세요.",
  },
  {
    title: "삼성전자 정성 데이터 수집 프로젝트",
    summary: "뉴스·공시·리포트 수집과 Supabase 적재 프로젝트를 정의합니다.",
    when: "정성 데이터 수집 프로젝트를 만들 때 사용하세요.",
  },
  {
    title: "삼성전자 정량 시그널 분석 프로젝트",
    summary: "krx_daily 기반 정량 시그널 분석 프로젝트를 정의합니다.",
    when: "정량 시그널 분석 프로젝트를 만들 때 사용하세요.",
  },
  {
    title: "투자 제언 리포트 빌더 프로젝트",
    summary: "정량·정성 결과를 통합하는 리포트 프로젝트를 정의합니다.",
    when: "투자 제언 리포트 프로젝트를 만들 때 사용하세요.",
  },
  {
    title: "Stock Insight Dashboard 프로젝트",
    summary: "분석 대시보드의 기술 스택·디자인·데이터를 정의합니다.",
    when: "Stock Insight Dashboard 프로젝트를 만들 때 사용하세요.",
  },
  {
    title: "Stock Insight Lab 6명 조직 구성",
    summary: "6명의 에이전트를 채용하고 보고 라인을 설정합니다.",
    when: "CEO에게 Stock Insight Lab 조직 구성을 맡길 때 사용하세요.",
  },
  {
    title: "Vintage Letterpress DESIGN.md 참조",
    summary: "디자이너가 사용할 디자인 시스템 원문을 단일 진실 소스로 지정합니다.",
    when: "디자이너 페르소나에 DESIGN.md 참조 자료를 추가할 때 사용하세요.",
  },
  {
    title: "삼성전자 정성 데이터 수집 이슈",
    summary: "최근 14일 뉴스 10건을 수집·검증·적재하도록 지시합니다.",
    when: "종목 리서처에게 삼성전자 정성 데이터 수집을 맡길 때 사용하세요.",
  },
  {
    title: "삼성전자 정량 시그널 산출 이슈",
    summary: "30영업일 데이터에서 6개 정량 시그널을 계산하도록 지시합니다.",
    when: "퀀트에게 삼성전자 정량 분석을 맡길 때 사용하세요.",
  },
  {
    title: "삼성전자 사실성 검증 이슈",
    summary: "정성 자료와 정량 시그널을 원문·DB로 교차 검증합니다.",
    when: "팩트 체커에게 분석 산출물 검증을 맡길 때 사용하세요.",
  },
  {
    title: "삼성전자 투자 리포트 작성 이슈",
    summary: "검증된 자료로 단기·중기 투자 제언 리포트를 작성합니다.",
    when: "리포트 작성자에게 최종 투자 제언 작성을 맡길 때 사용하세요.",
  },
  {
    title: "Stock Insight Dashboard 디자인 사양 이슈",
    summary: "대시보드 8개 영역의 시각 사양을 명문화하도록 지시합니다.",
    when: "디자이너에게 구현 가능한 대시보드 사양을 맡길 때 사용하세요.",
  },
  {
    title: "Stock Insight Dashboard 구현·배포 이슈",
    summary: "Next.js 대시보드를 구현하고 Vercel에 배포하도록 지시합니다.",
    when: "대시보드 엔지니어에게 구현과 운영 배포를 맡길 때 사용하세요.",
  },
  {
    title: "Paperclip Stock Insight 공통 규칙",
    summary: "코멘트 보고·DB 보호·비밀값 마스킹 등 공통 규칙을 지정합니다.",
    when: "각 Stock Insight 이슈 본문 끝에 공통 운영 규칙을 붙일 때 사용하세요.",
  },
];

const prompts = promptMetadata.map((metadata, index) => ({
  ...metadata,
  body: promptBodies[index],
}));

if (
  pageMarkdown.length < 15_000 ||
  promptBodies.length !== 21 ||
  prompts.length !== 20 ||
  !prompts.every((prompt) => prompt.body && prompt.summary && prompt.when)
) {
  throw new Error(
    `Page 또는 Prompt 구성이 불완전합니다. page=${pageMarkdown.length}, blocks=${promptBodies.length}, prompts=${prompts.length}`
  );
}

if (process.argv.includes("--check")) {
  console.log({
    pageChars: pageMarkdown.length,
    codeBlocks: promptBodies.length,
    prompts: prompts.length,
  });
  process.exit(0);
}

const pageContent = JSON.stringify(markdownToTiptapDoc(pageMarkdown));
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
