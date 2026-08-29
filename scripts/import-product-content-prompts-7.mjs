// 상품 콘텐츠 프롬프트 7개를 Pages 한 건으로 저장한다
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

export const PAGE_TITLE = "상품 콘텐츠 프롬프트 7개 — 후킹부터 발행까지";
export const MARKER = "당신은 이커머스 카피라이터입니다.";

export const PROMPTS = [
  {
    heading: "1. 상품 후킹 문장 뽑아내는 프롬프트",
    intent: "클릭을 부르는 첫 문장을 상품마다 자동으로 뽑아내는 구조 만들기.",
    body: `당신은 이커머스 카피라이터입니다.
1) 이 상품명과 특징을 주면, 사람들이 클릭하고 싶어지는 후킹 문장 5개를 만들어 주세요.
2) 각 문장이 어떤 소비 심리(가격, 희소성, 결핍 등)를 자극하는지 설명해 주시고,
3) 내 타겟 독자층(예: 3040 주부, 2030 남성 등)에 맞게 톤을 조정해 주세요.`,
  },
  {
    heading: "2. 상품 비교글 뼈대 잡는 프롬프트",
    intent: "정보성과 판매 유도를 동시에 담은 비교글을 빠르게 완성.",
    body: `당신은 상품 비교 콘텐츠 전문 작가입니다.
1) 내가 알려주는 상품 3~4개를 가격, 기능, 후기 기준으로 비교표를 만들어 주세요.
2) 각 상품이 어떤 사람에게 가장 잘 맞는지 짚어 주시고,
3) 마지막에 자연스럽게 구매 링크로 연결되는 문단을 써 주세요.`,
  },
  {
    heading: "3. 후기형 글 생생하게 만드는 프롬프트",
    intent: "광고처럼 안 보이면서 설득력 있는 후기글 구조 만들기.",
    body: `당신은 실사용 후기 전문 블로거입니다.
1) 이 상품을 실제로 써본 것처럼, 장점과 단점을 구체적인 상황으로 묘사해 주세요.
2) 사용 전/사용 후 변화를 스토리텔링 형식으로 풀어 주시고,
3) 과장 없이 신뢰감 있는 문체로 마무리해 주세요.`,
  },
  {
    heading: "4. SEO 키워드 자연스럽게 박는 프롬프트",
    intent: "검색 유입을 늘리면서도 사람이 읽기 편한 글로 완성.",
    body: `당신은 검색 최적화 전문가입니다.
1) 이 상품과 관련해 사람들이 많이 검색할 키워드 후보를 뽑아 주세요.
2) 그 키워드를 제목, 소제목, 본문에 자연스럽게 배치한 글 구조를 짜 주시고,
3) 키워드 반복이 과해서 어색해지지 않도록 문장을 다듬어 주세요.`,
  },
  {
    heading: "5. 독자 반응 예측 & 수정 프롬프트",
    intent: "발행 전에 미리 약점을 잡아내고 완성도를 끌어올리는 단계.",
    body: `당신은 콘텐츠 반응 분석가입니다.
1) 이 초안을 읽고, 독자가 이탈할 것 같은 문장이나 지루한 구간을 짚어 주세요.
2) 왜 그 부분이 약한지 이유를 설명해 주시고,
3) 더 몰입도 높게 다시 쓴 버전을 제안해 주세요.`,
  },
  {
    heading: "6. 시리즈 콘텐츠 기획 프롬프트",
    intent: "매번 소재 고민하지 않고 콘텐츠를 지속 생산할 수 있는 구조 확보.",
    body: `당신은 콘텐츠 기획 PD입니다.
1) 내가 다루는 카테고리(예: 주방용품, 캠핑용품)로 앞으로 10개 글감을 뽑아 주세요.
2) 각 글마다 다른 후킹 각도(가격, 트렌드, 계절성 등)를 붙여 주시고,
3) 발행 순서를 어떻게 짜면 꾸준히 유입이 될지도 알려 주세요.`,
  },
  {
    heading: "7. 전체 글 다듬기 & 톤 통일 프롬프트",
    intent: "초안을 실제 발행 가능한 완성도로 마무리.",
    body: `당신은 최종 편집자입니다.
1) 이 글 전체를 자연스럽고 신뢰감 있는 톤으로 다듬어 주세요.
2) 문장이 너무 광고처럼 느껴지는 부분이 있다면 부드럽게 고쳐 주시고,
3) 마지막에 클릭을 유도하는 문장을 어색하지 않게 배치해 주세요.`,
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

/** 7개 프롬프트를 복사 가능한 코드 블록으로 묶는다. */
export function buildMarkdown() {
  const sections = PROMPTS.map(
    (item) =>
      `## ${item.heading}\n\n핵심 의도. ${item.intent}\n\n\`\`\`\n${item.body}\n\`\`\``
  );
  return [
    `# ${PAGE_TITLE}`,
    "상품 글을 쓸 때 반복해서 쓰는 프롬프트 7개다. 역할과 할 일 세 가지를 정해 두고, 상품명·특징·초안만 바꿔 넣으면 된다.",
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
  if (PROMPTS.length !== 7) throw new Error("프롬프트가 7개가 아닙니다.");
  for (const item of PROMPTS) {
    if (!markdown.includes(item.heading)) {
      throw new Error(`헤딩이 없습니다. ${item.heading}`);
    }
    if (!markdown.includes(item.body)) {
      throw new Error(`프롬프트 원문이 없습니다. ${item.heading}`);
    }
    if (!markdown.includes(item.intent)) {
      throw new Error(`핵심 의도가 없습니다. ${item.heading}`);
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
        production: { pages: production.pages, pageSkips: production.pageSkips },
      },
      null,
      2
    )
  );
}

const isDirect =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirect) await main();
