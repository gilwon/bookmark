// 이력서 프롬프트 6개를 Pages 한 건으로 저장한다
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

export const PAGE_TITLE = "이력서 프롬프트 6개 — 엑스레이부터 서류 통과까지";
export const MARKER =
  "포춘 500 기업 리크루터이자 임원 이력서 전문 작성자, ATS 전문가처럼 행동해줘.";

export const PROMPTS = [
  {
    heading: "1. 이력서 엑스레이",
    body: `포춘 500 기업 리크루터이자 임원 이력서 전문 작성자, ATS 전문가처럼 행동해줘. 첨부한 내 이력서를 나를 서류 통과시킬지 말지 정하는 사람 입장에서 분석해줘. 약점, 놓친 기회, 힘 없는 항목, 빠진 키워드, 서식 문제, 신뢰가 안 가는 부분을 전부 짚어줘. 그다음 없는 사실을 지어내지 말고, 잘 읽히고 인상에 남게 다시 써줘.`,
  },
  {
    heading: "2. 면접 자석",
    body: `내 이력서랑 채용 공고를 같이 줄게. 두 개를 한 줄씩 맞대어 비교해줘. 내가 서류에서 걸러지는 이유가 뭔지 찾아내고, 이 자리에 제일 중요한 능력과 경험, 성과가 자연스럽게 드러나도록 이력서를 다시 써줘. 전부 사실인 채로.`,
  },
  {
    heading: "3. 리크루터 테스트",
    body: `첨부한 내 이력서를 한 장에 10초도 안 쓰는 리크루터처럼 읽어줘. 뭐가 눈에 들어오고, 어디서 흥미가 식고, 뭘 보면 면접을 안 잡을지 말해줘. 그다음 그 문제를 전부 고쳐줘.`,
  },
  {
    heading: "4. ATS 최적화",
    body: `첨부한 내 이력서를 요즘 ATS에 맞게 최적화해줘. 단 키워드를 억지로 밀어 넣지는 마. 구조, 표현, 관련 능력, 키워드를 다듬되 전부 자연스럽고 진짜처럼 남겨줘.`,
  },
  {
    heading: "5. 임원급 다시 쓰기",
    body: `시간당 500달러 받는 임원 이력서 전문가처럼 첨부한 내 이력서를 다시 써줘. 힘 없는 표현, 뻔한 문구, 반복되는 말, 영향력 없는 서술을 다 걷어내줘. 모든 문장이 잴 수 있는 성과와 신뢰, 성장 과정을 말하게 만들어줘.`,
  },
  {
    heading: "6. 서류 통과 최적화",
    body: `첨부한 내 이력서를 내가 목표하는 직무와 같이 봐줘. 목표 직무: [직무 입력]. 그 자리를 뽑는 리크루터가 보통 먼저 보는 경험, 능력, 성과, 키워드가 드러나게 다시 써줘. 사실에서 벗어나지 않는 선에서.`,
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

/** 6개 이력서 프롬프트를 복사 가능한 코드 블록으로 묶는다. */
export function buildMarkdown() {
  const sections = PROMPTS.map(
    (item) => `## ${item.heading}\n\n\`\`\`\n${item.body}\n\`\`\``
  );
  return [
    `# ${PAGE_TITLE}`,
    "이력서를 분석하고 다시 쓸 때 붙이는 프롬프트 6개다. 없는 경력은 만들지 말고, 사실만으로 잘 읽히게 고치는 쪽이 핵심이다.",
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
  if (PROMPTS.length !== 6) throw new Error("프롬프트가 6개가 아닙니다.");
  for (const item of PROMPTS) {
    if (!markdown.includes(item.heading)) {
      throw new Error(`헤딩이 없습니다. ${item.heading}`);
    }
    if (!markdown.includes(item.body)) {
      throw new Error(`프롬프트 원문이 없습니다. ${item.heading}`);
    }
  }
  const codes = countCodeBlocks(content);
  if (codes !== 6) throw new Error(`코드 블록이 6개가 아닙니다. ${codes}`);
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
