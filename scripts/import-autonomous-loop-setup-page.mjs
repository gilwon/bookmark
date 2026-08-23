// 자율루프 세팅 프롬프트를 Pages에만 저장한다
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
export const PAGE_TITLE = "자율루프 세팅, 프롬프트";

const SETUP_PROMPT = `자율 개발 루프를 처음부터 끝까지 셋업해줘. 아래를 순서대로 전부 해줘.

[0] 준비
- 지금 폴더가 git 저장소가 아니면 git init 하고, .gitignore 를 만들고
  (로그·빌드 산출물 제외), 첫 커밋을 남겨줘.
- 없는 폴더는 만들어줘: loop/ , docs/ , docs/feedback/ , logs/

[1] 루프 본체 (loop/loop.sh)
- 무한 반복. 한 바퀴마다 헤드리스 세션을 "새로" 연다.
  대화를 이어 붙이지 않는다. 이게 핵심이다.
- 세션에는 loop/PROMPT.md 를 읽고 일하라고 준다.
- 한 바퀴마다 logs/ 에 날짜별 로그를 남긴다.
- loop/STOP 파일이 있으면 현재 바퀴를 마치고 멈춘다.
- 설정은 loop/env.sh 로 분리해줘.
  (모델 / 한 바퀴 최대 턴 수 / 바퀴 사이 대기 / 최대 바퀴 수)

[2] 기억은 대화가 아니라 파일로
아래 세 개를 빈 틀로 만들어줘. 내용은 내가 채운다.
- docs/DESIGN.md          무엇을 만드는가 (초기 기획서, 거의 안 고침)
- docs/STATUS.md          어디까지 했고 다음은 뭔가 (한 바퀴마다 갱신)
- docs/feedback/INBOX.md  내가 던지는 지시 (가장 먼저 처리)

[3] 지시서 틀 (loop/PROMPT.md)
다섯 절짜리 틀로 만들어줘.
 ① 합격 기준 (한 문장)   ← 비워 둬
 ② 먼저 읽을 문서        ← 위 세 파일을 번호로 적어줘
 ③ 규칙과 근거           ← 비워 두되, 규칙마다 "왜"를 적는 자리를 만들어줘
 ④ 한 바퀴 도는 순서     ← 아래로 채워줘
      읽기 → 하나만 만들기 → 실행해서 눈으로 확인 → 커밋 → STATUS.md 갱신
 ⑤ 커밋 순서 규칙        ← 아래로 채워줘
      검사를 통과하면, 화면을 보기 "전에" 일단 커밋한다.
      한 바퀴는 도중에 멈춘다. 멈춘 자리에 커밋이 없으면 그 작업은 사라진다.

[4] 자동 실행 등록
- 내 OS를 확인해서 맞는 방식으로 등록해줘 (맥이면 launchd, 리눅스면 systemd).
- 로그인하면 시작. 비정상 종료면 재시작. 정상 종료면 그대로 둔다.
- PATH 를 반드시 명시해줘. 자동 실행은 평소 터미널 환경을 물려받지 않아서
  빠뜨리면 실행 파일을 못 찾고 조용히 죽는다.

[5] 확인하고 정리
- 등록만 하고 아직 켜지는 마. 먼저 두 바퀴만 돌려서 로그를 보여줘.
- 마지막에 만든 파일 목록과, 켜는 법 / 끄는 법 / 상태 보는 법을
  README.md 에 정리해줘.`;

export const REQUIRED_PHRASES = [
  "대화를 이어 붙이지 않는다",
  "docs/feedback/INBOX.md",
  "loop/PROMPT.md",
  "loop/STOP",
  "launchd",
  "규칙마다 \"왜\"를 적는 자리",
  "화면을 보기 \"전에\" 일단 커밋한다",
  "금지만 적으면 빠져나갈 길을 찾고",
];

export function buildPageMarkdown() {
  return `# ${PAGE_TITLE}

아래를 통째로 붙여넣으세요. git 초기화부터 알아서 합니다.

\`\`\`
${SETUP_PROMPT}
\`\`\`

여기까지 하면 "굴러가기만" 합니다.

## 2단계 · 지시서에서 내가 채울 것

위에서 ④⑤는 미리 채워집니다. ①②③은 직접 쓰셔야 합니다.

**① 합격 기준을 한 문장으로**

없으면 AI는 "돌아가기만 하면 완료"로 판단합니다.

예) "이걸 다른 사람이 봤을 때도 퀄리티가 떨어지지 않는가?"

→ 통과 못 하면 커밋하지 말라고 같이 적으세요.

**② 먼저 읽을 문서**

새로 시작한 세션이 아는 건 이 목록이 전부입니다.

※ 파일이 커지면 끝까지 못 읽습니다. 읽을 범위도 같이 적으세요.

**③ 규칙에는 근거를 붙인다** ← 이거 하나만 가져가셔도 됩니다

(X) "그림은 도구로 처리해라"

(O) "그림은 도구로 처리해라. 손으로 그리면 외곽선이 뭉개지고 선이 떨린다"

금지만 적으면 빠져나갈 길을 찾고, 이유를 적으면 그 이유를 지킵니다.
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
  if (codeBlocks !== 1) {
    throw new Error(`코드 블록 수가 1이 아닙니다. ${codeBlocks}`);
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
