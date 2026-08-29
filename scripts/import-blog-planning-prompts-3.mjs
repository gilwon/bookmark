// 블로그 기획 프롬프트 3개를 Pages 한 건으로 저장한다
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

export const PAGE_TITLE = "블로그 기획 프롬프트 3개 — 주제부터 초안까지";
export const MARKER = "당신은 블로그 기획 전문가입니다.";

export const PROMPTS = [
  {
    heading: "1. 주제 확장 프롬프트",
    intent:
      "막막한 백지 상태에서 벗어나, 검색되는 주제로 방향을 빠르게 잡는다.",
    body: `당신은 블로그 기획 전문가입니다.
1) 내가 던지는 키워드 하나를 가지고, 사람들이 실제로 검색할 만한 세부 주제 5개를 뽑아 주세요.
2) 각 주제마다 어떤 독자층이 클릭할지, 왜 궁금해할지 이유도 함께 적어 주시고,
3) 그중 지금 쓰기 가장 좋은 주제를 하나 추천하고 이유를 말해 주세요.`,
  },
  {
    heading: "2. 구조 설계 프롬프트",
    intent: "목차와 훅만 잡히면 절반은 끝난다. 이걸 클로드가 대신 짜준다.",
    body: `당신은 글 구조를 짜주는 에디터입니다.
1) 방금 정한 주제로 목차를 짜 주세요. 서론-본론-결론 형태로.
2) 각 목차마다 독자가 이탈하지 않도록 어떤 내용이 들어가야 하는지 한 줄씩 요약해 주시고,
3) 첫 문장(훅)을 3가지 버전으로 제안해 주세요.`,
  },
  {
    heading: "3. 톤앤매너 맞춤 프롬프트",
    intent: "남의 글 같지 않게, 내 말투 그대로 쓰인 글을 완성한다.",
    body: `당신은 내 글쓰기 스타일을 학습하는 카피라이터입니다.
1) 내가 붙여넣는 이전 글 샘플을 분석해서, 문장 길이·어투·자주 쓰는 표현을 파악해 주세요.
2) 그 스타일 그대로 방금 짠 목차를 채워서 초안을 써 주시고,
3) 너무 딱딱하거나 어색한 부분이 있으면 자연스럽게 다듬어 주세요.`,
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

/** 3개 기획 프롬프트를 복사 가능한 코드 블록으로 묶는다. */
export function buildMarkdown() {
  const sections = PROMPTS.map(
    (item) =>
      `## ${item.heading}\n\n핵심 의도. ${item.intent}\n\n\`\`\`\n${item.body}\n\`\`\``
  );
  return [
    `# ${PAGE_TITLE}`,
    "키워드 하나에서 주제와 목차, 내 말투 초안까지 이어 가는 프롬프트 3개다. 앞에서 정한 주제와 목차를 다음 단계에 그대로 넘겨 쓰면 된다.",
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
  if (PROMPTS.length !== 3) throw new Error("프롬프트가 3개가 아닙니다.");
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
  if (codes !== 3) throw new Error(`코드 블록이 3개가 아닙니다. ${codes}`);
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
