// 전략 조언자 모드 프롬프트 10개를 Pages에만 저장한다
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
export const PAGE_TITLE = "전략 조언자 모드 프롬프트 10가지";

const PROMPT_1 = `내 고급 전략 조언자처럼 행동해.
[목표/상황]을 보고 내가 당연하게 생각하는 부분을 의심해줘.
내가 놓치고 있는 약점, 기회, 위험 요소를 솔직하게 알려줘.
듣기 좋은 말보다 현실적인 피드백을 주고, 가장 먼저 할 행동 3가지를 정해줘.`;

const PROMPT_2 = `이 아이디어를 냉정하게 뜯어봐.
[아이디어]가 실제 시장에서 실패할 수 있는 이유를 찾아줘.
고객, 돈, 경쟁, 실행 난이도 관점에서 가장 위험한 부분을 정리해줘.
문제별 해결 방법과 우선순위도 알려줘.`;

const PROMPT_3 = `[시장/고객층]이 구매를 결정할 때 어떤 감정과 고민을 하는지 분석해줘.
사고 싶어지는 이유, 망설이는 이유, 불안해하는 부분, 신뢰하게 되는 요소를 정리해줘.
그 내용을 바탕으로 고객에게 더 잘 전달할 메시지도 제안해줘.`;

const PROMPT_4 = `현재 [상품/서비스]를 훨씬 비싼 프리미엄 상품으로 만든다면 어떻게 바뀌어야 할까?
고객, 제공 가치, 구성, 가격, 경험, 브랜딩 관점에서 분석해줘.
단순히 가격만 올리는 방식 말고, 사람들이 기꺼이 더 내고 싶어질 구조를 만들어줘.`;

const PROMPT_5 = `[시장/아이디어]에서 대부분이 놓치고 있는 기회가 뭔지 찾아줘.
고객 불만, 경쟁이 약한 부분, 아직 제대로 해결되지 않은 문제를 중심으로 분석해줘.
바로 테스트해볼 수 있는 기회 3개와 실행 방법을 알려줘.`;

const PROMPT_6 = `[목표]를 이루기 위해 가장 적은 노력으로 가장 큰 결과를 만들 수 있는 행동이 뭔지 찾아줘.
지금 하고 있는 일 중 줄이거나 멈춰야 할 것도 알려줘.
결국 내가 집중해야 할 한 가지와, 오늘 바로 할 행동을 정해줘.`;

const PROMPT_7 = `[경쟁자/경쟁 브랜드]가 잘되는 이유를 분석해줘.
상품, 고객, 가격, 콘텐츠, 브랜딩, 판매 방식 관점에서 정리해줘.
그대로 따라 하기보다, 내가 더 잘할 수 있는 차별점과 실행 전략을 알려줘.`;

const PROMPT_8 = `내가 [목표/사업/프로젝트]에 실패한다면, 진짜 이유는 뭘까?
변명 말고 현실적인 실패 원인을 찾아줘.
내 판단 오류, 실행 부족, 시장 문제, 돈 문제, 경쟁 문제를 나눠서 분석해줘.
지금 막을 수 있는 위험부터 알려줘.`;

const PROMPT_9 = `지금 내가 하고 있는 [업무/작업]을 반복 가능하고 확장 가능한 시스템으로 바꿔줘.
매번 내가 직접 판단해야 하는 부분은 줄이고, 자동화하거나 템플릿으로 만들 수 있는 부분을 찾아줘.
단계별 프로세스와 필요한 도구를 정리해줘.`;

const PROMPT_10 = `내가 [목표/전략]를 12개월 동안 꾸준히 실행하면 현실적으로 어떤 결과가 나올까?
좋은 경우, 보통인 경우, 잘 안 풀리는 경우를 나눠서 예상해줘.
각 상황에서 봐야 할 지표와, 결과를 더 좋게 만들기 위해 지금 해야 할 행동을 알려줘.`;

export const REQUIRED_PHRASES = [
  "[목표/상황]",
  "[아이디어]",
  "[시장/고객층]",
  "[상품/서비스]",
  "[시장/아이디어]",
  "[목표]",
  "[경쟁자/경쟁 브랜드]",
  "[목표/사업/프로젝트]",
  "[업무/작업]",
  "[목표/전략]",
];

export const SECTIONS = [
  { heading: "1. 전략 조언자 모드", prompt: PROMPT_1 },
  { heading: "2. 아이디어 약점 찾기", prompt: PROMPT_2 },
  { heading: "3. 고객 심리 파악하기", prompt: PROMPT_3 },
  { heading: "4. 프리미엄 상품으로 바꾸기", prompt: PROMPT_4 },
  { heading: "5. 시장의 빈틈 찾기", prompt: PROMPT_5 },
  { heading: "6. 가장 효율적인 한 가지 찾기", prompt: PROMPT_6 },
  { heading: "7. 경쟁자 분석하기", prompt: PROMPT_7 },
  { heading: "8. 실패 원인 미리 보기", prompt: PROMPT_8 },
  { heading: "9. 반복 가능한 시스템 만들기", prompt: PROMPT_9 },
  { heading: "10. 1년 뒤 결과 예상하기", prompt: PROMPT_10 },
];

export function buildPageMarkdown() {
  const sections = SECTIONS.map(
    (section) => `## ${section.heading}

\`\`\`
${section.prompt}
\`\`\``
  ).join("\n\n");
  return `# ${PAGE_TITLE}

목표·아이디어·고객·상품·경쟁을 점검할 때 붙여 넣는 프롬프트 10개다.

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
  if (codeBlocks !== 10) {
    throw new Error(`코드 블록 수가 10이 아닙니다. ${codeBlocks}`);
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
