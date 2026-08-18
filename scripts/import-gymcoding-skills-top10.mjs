// 짐코딩 클로드 코드 스킬·도구 10개 글을 토글 본문까지 Pages와 Prompts에 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const here = dirname(fileURLToPath(import.meta.url));
const localUser = "dev";
const productionUser = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const sourceUrl = "https://www.gymcoding.co/articles/claude-code-skills-top-10-install-prompts";
const pageTitle = "클로드 코드 스킬·도구 추천 10개: 설치법과 실전 프롬프트";
const category = "짐코딩 · 클로드 코드 스킬 10개";
const ogUrl = "https://www.gymcoding.co/articles/claude-code-skills-top-10-install-prompts/opengraph-image-1ya3q7?052be9e71b4cd640";
const now = new Date().toISOString();

const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^(['"])|(['"])$/g, "");
  }
}

const require = createRequire(import.meta.url);
const tsx = require("tsx/cjs/api");
tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
const { markdownToTiptapDoc } = require(resolve(root, "src/lib/markdown-to-tiptap.ts"));
const { extractPageMediaReferences, normalizedNotionWeekTitle } = require(
  resolve(root, "src/lib/page-attachment-storage.ts"),
);

const raw = readFileSync(resolve(here, "import-gymcoding-skills-top10-source.txt"), "utf8");
const faqs = JSON.parse(readFileSync(resolve(here, "import-gymcoding-skills-top10-faq.json"), "utf8"));

function isCommandLine(line) {
  return /^(npx |git clone |npm |cq |cp |bash |# |\/plugin |start\.bat|\.\/)/.test(line);
}

function fenceCommands(text) {
  const lines = text.split("\n");
  const out = [];
  let buffer = [];
  const flush = () => {
    if (!buffer.length) return;
    out.push("```bash", ...buffer, "```");
    buffer = [];
  };
  for (const line of lines) {
    if (isCommandLine(line) || (buffer.length && line === "")) {
      if (line === "" && buffer.length) {
        flush();
      } else if (isCommandLine(line)) {
        buffer.push(line);
      }
    } else {
      flush();
      out.push(line);
    }
  }
  flush();
  return out.join("\n");
}

function buildMarkdown() {
  let text = raw.replace(/\r\n/g, "\n");
  const start = text.indexOf("이런 분을 위한 글입니다");
  if (start > 0) text = text.slice(start);
  text = text.replace(/\n짐코딩 뉴스레터[\s\S]*$/, "\n");
  text = text.replace(/\n자주 묻는 질문\n[\s\S]*$/, "\n");
  const faqBlock = [
    "## 자주 묻는 질문",
    "",
    ...faqs.flatMap((item) => [`### ${item.q}`, "", item.text, ""]),
  ].join("\n");
  const headinged = text
    .split("\n")
    .map((line) => {
      if (/^\d+\. [a-z0-9-]+/.test(line)) return `## ${line}`;
      if (["설치", "설치와 실행", "설치 전 준비물", "설치 프롬프트", "첫 작업 프롬프트", "바로 써볼 프롬프트", "학습용 프롬프트", "설계용 프롬프트", "플러그인으로 설치", "설치 없이 먼저 시험할 프롬프트", "준비 환경", "이렇게 활용해 보세요", "현재 설치 상태", "저장소가 복구되면 확인할 항목", "설치 전 검토 프롬프트", "한계", "마무리", "설치가 막힐 때 가장 잘 통하는 프롬프트", "마지막 정리", "먼저 결론: 무엇부터 설치할까?"].includes(line)) {
        return line === "마무리" || line === "마지막 정리" || line.startsWith("먼저 결론") ? `## ${line}` : `### ${line}`;
      }
      if (line === "하고 싶은 일\t먼저 볼 도구" || line === "하고 싶은 일	먼저 볼 도구") return "";
      return line;
    })
    .join("\n");
  const table = [
    "| 하고 싶은 일 | 먼저 볼 도구 |",
    "| --- | --- |",
    "| Claude Code의 과한 구현을 줄이고 싶다 | andrej-karpathy-skills |",
    "| 이미지 생성 참고 자료를 찾고 싶다 | open-image-prompts |",
    "| 손글씨를 폰트로 만들고 싶다 | draw-your-font |",
    "| 개발 작업을 기획·구현·검수로 나누고 싶다 | Finn-loop |",
    "| 여러 AI의 의견을 비교하고 싶다 | agents-council (현재 링크 확인 필요) |",
    "| AI가 쓴 영어 글을 다듬고 싶다 | humanizer-stack |",
    "| 글을 손그림 영상으로 만들고 싶다 | story-to-handdrawn-video |",
    "| 지식그래프와 작업그래프를 배우고 싶다 | graph-engineering |",
    "| Claude Code 작업 화면을 재미있게 보고 싶다 | claude-quest |",
    "| Pi 코딩 에이전트 환경을 한 번에 구성하고 싶다 | pi-config |",
  ].join("\n");
  let body = headinged
    .replace(/먼저 결론: 무엇부터 설치할까\?[\s\S]*?처음이라면 한 번에 하나만 설치하세요/, `## 먼저 결론: 무엇부터 설치할까?\n\n${table}\n\n처음이라면 한 번에 하나만 설치하세요`);
  body = fenceCommands(body);
  return [
    `# ${pageTitle}`,
    "",
    `> 원문. [짐코딩](${sourceUrl})`,
    "",
    "![표지](OG_IMAGE)",
    "",
    "2026년 클로드 코드 스킬·도구 10개를 비교합니다. GitHub 설치 명령어, 바로 쓰는 프롬프트, 요구사항, 한계와 추천 순서를 정리했습니다.",
    "",
    body.trim(),
    "",
    faqBlock,
  ].join("\n");
}

const prompts = [
  {
    title: "draw-your-font · 손글씨 폰트 만들기",
    body: `/draw-your-font
첨부한 손글씨 사진으로 "My Hand"라는 폰트를 만들어줘.
먼저 글자 인식 결과와 미리보기를 보여주고,
문제가 있는 글자는 다시 촬영해야 하는지 알려줘.
최종 결과는 TTF, WOFF2, CSS 형식으로 내보내줘.`,
  },
  {
    title: "open-image-prompts · 레퍼런스 검색",
    body: `20대 직장인을 위한 생산성 앱 인스타그램 광고 이미지를 만들 거야.
open-image-prompts에서 다음 조건과 가까운 레퍼런스 5개를 찾아줘.
- 미니멀한 SaaS 광고
- 밝은 배경
- 파란색 포인트 컬러
- 스마트폰 UI가 중심
- 과한 3D 표현은 제외
각 결과마다 원본 프롬프트, 참고할 요소, 그대로 복제하면 안 되는 요소를 정리하고
마지막에 내 목적에 맞는 새 프롬프트 하나를 작성해줘.`,
  },
  {
    title: "Finn-loop · 설치",
    body: `이 저장소에 Finn-loop를 설치해줘.
원본은 https://github.com/finna/Finn-loop 이야.
먼저 내 환경을 변경하지 말고 아래 조건부터 점검해줘.
1. Claude Code 버전이 2.1.71 이상인지 확인해줘.
2. GitHub origin과 기본 브랜치를 확인해줘.
3. gh 인증과 저장소 쓰기 권한을 확인해줘.
4. Linear 연결 여부를 확인하고, 필요한 팀 키를 나에게 질문해줘.
5. 필요한 세 스킬을 .claude/skills 아래에 복사할 계획을 보여줘.
점검 결과와 변경될 파일을 먼저 보여주고 내가 승인한 뒤 설치해줘.
설치 후에는 /skills에서 finn-spec, finn-build, finn-review가 보이는지 검증해줘.`,
  },
  {
    title: "Finn-loop · 첫 작업",
    body: `/finn-spec
회원가입 폼에 비밀번호 표시 버튼을 추가하려고 해.
기존 동작을 깨지 않는 범위에서 요구사항과 완료 조건을 질문으로 정리해줘.
내가 승인하기 전에는 agent-ready 상태로 넘기지 마.`,
  },
  {
    title: "graph-engineering · 학습",
    body: `graph engineering을 내 블로그 운영을 예시로 가르쳐줘.
독자, 아티클, 카테고리, 강의, 검색어를 주요 개체 후보로 사용해줘.
9단계 지식그래프 파이프라인을 한 단계씩 설명하고,
각 단계마다 결과 예시와 내가 결정해야 할 질문을 하나씩 줘.
내 답을 받기 전에는 다음 단계로 넘어가지 마.`,
  },
  {
    title: "graph-engineering · 작업그래프 설계",
    body: `내 콘텐츠 제작 과정을 작업그래프로 설계해줘.
작업은 자료 조사, 개요 작성, 초안 작성, 사실 검증, 교정, 발행이야.
실제로 의존성이 있는 작업만 간선으로 연결하고,
병렬로 처리할 수 있는 작업과 반드시 순차로 해야 하는 작업을 구분해줘.
최종 발행 직전에는 사람의 승인 단계를 넣어줘.
Mermaid 다이어그램과 역할별 체크리스트로 보여줘.`,
  },
  {
    title: "humanizer-stack · 영어 초안 다듬기",
    body: `이 영어 뉴스레터 초안을 두 단계로 다듬어줘.
1단계에서는 과장된 표현, 반복되는 문장 패턴, 불필요한 수식어를 찾아 수정해줘.
2단계에서는 모든 문단이 지나치게 반듯한 구조인지, 결론을 과하게 설명하는지,
구체적인 경험 없이 일반론만 이어지는지 점검해줘.
내 말투와 핵심 주장은 유지해줘.
수정 전후의 중요한 차이 5개를 마지막에 설명해줘.
초안: [여기에 글 붙여넣기]`,
  },
  {
    title: "story-to-handdrawn-video · 손그림 영상",
    body: `$story-to-handdrawn-video를 사용해서 아래 이야기를
나중에 한국어 내레이션을 입힐 수 있는 무음 손그림 영상으로 만들어줘.
먼저 문장을 장면별로 나누고,
각 장면의 화면 구성과 자막을 표로 보여줘.
내가 승인하면 720x960 미리보기를 만들고,
최종 승인 후에만 1080x1440으로 렌더링해줘.
이야기:
[여기에 이야기 붙여넣기]`,
  },
  {
    title: "andrej-karpathy-skills · 구현 전 검토",
    body: `이 작업을 바로 구현하지 말고 먼저 다음 순서로 검토해줘.
1. 내가 말하지 않아 네가 가정해야 하는 부분을 모두 적어줘.
2. 요구사항을 만족하는 가장 단순한 구현 범위를 제안해줘.
3. 변경할 파일과 변경하지 않을 파일을 구분해줘.
4. 완료 여부를 확인할 테스트와 성공 조건을 적어줘.
5. 내가 승인한 뒤에만 구현을 시작해줘.
작업: [여기에 개발 작업 입력]`,
  },
  {
    title: "agents-council · 저장소 복구 확인",
    body: `https://github.com/0xwilliamortiz/agents-council 상태를 확인해줘.
설치하기 전에 다음을 검증해줘.
1. 저장소가 현재 공개 상태인지 확인해줘.
2. README의 최신 설치 명령을 그대로 인용해줘.
3. 지원하는 AI CLI와 필요한 Node.js 버전을 확인해줘.
4. 질문 내용이 어느 CLI와 프로세스로 전달되는지 설명해줘.
5. 생성하거나 수정하는 파일을 보여줘.
6. 내가 승인하기 전에는 설치하지 마.`,
  },
  {
    title: "pi-config · 설치 전 검토",
    body: `https://github.com/realchendahuang/pi-config 를 검토해줘.
아직 install.sh를 실행하지 마.
config.json, mcp.json, install.sh를 읽고 다음을 표로 정리해줘.
- 설치되는 플러그인과 역할
- 새로 생성하거나 수정하는 파일
- 필요한 외부 프로그램과 API 키
- 내 기존 설정과 충돌할 수 있는 항목
- 지금 내 용도에 불필요해 보이는 항목
그다음 전체 설치와 최소 설치 두 가지 방안을 제안해줘.
내가 승인한 방안만 실행해줘.`,
  },
  {
    title: "GitHub 프로젝트 설치 계획",
    body: `이 GitHub 프로젝트를 내 환경에 설치하는 방법을 단계별로 알려줘.
저장소: [GitHub URL]

내 환경을 먼저 확인하고, 아직 어떤 파일도 수정하지 마.
README와 설치 스크립트를 읽은 뒤 다음을 알려줘.

1. 이 도구가 실제로 하는 일
2. 필요한 운영체제, 런타임, 외부 프로그램
3. 설치 과정에서 생성하거나 수정하는 파일
4. API 키, 로그인, 유료 서비스 필요 여부
5. 내 기존 설정과 충돌할 가능성
6. 설치 명령어
7. 설치 성공을 확인하는 명령어
8. 제거하거나 원상 복구하는 방법

설치 계획을 먼저 보여주고 내가 승인한 뒤 실행해줘.`,
  },
];

async function ogDataUrl() {
  const response = await fetch(ogUrl, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`표지 이미지 HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw new Error("표지가 PNG가 아닙니다.");
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

const image = await ogDataUrl();
const markdown = buildMarkdown().replace("OG_IMAGE", image);
const pageContent = JSON.stringify(markdownToTiptapDoc(markdown));
const media = extractPageMediaReferences(pageContent);
if (!pageContent.includes(sourceUrl)) throw new Error("원문 주소가 없습니다.");
if (media.imageSources.length !== 1 || !media.imageSources[0].startsWith("data:image/png")) {
  throw new Error("표지 이미지가 없습니다.");
}
if (!pageContent.includes("npx skills add danilo-znamerovszkij/draw-your-font")) {
  throw new Error("설치 명령이 본문에 없습니다.");
}
if (!pageContent.includes("지침 묶음")) throw new Error("FAQ 답변이 본문에 없습니다.");
if (pageContent.includes("동의하고 구독하기") || pageContent.includes("인프런에서 수강하기")) {
  throw new Error("광고·구독 문구가 본문에 남아 있습니다.");
}

function isSamePage(rows) {
  const normalized = normalizedNotionWeekTitle(pageTitle);
  return rows.some((row) => (
    normalizedNotionWeekTitle(row.title) === normalized
    || (row.content != null && String(row.content).includes(sourceUrl))
  ));
}

function promptRows() {
  return prompts.map((item) => ({
    title: item.title,
    category,
    summary: `${pageTitle}에서 가져온 실행 프롬프트입니다.`,
    when_to_use: "해당 스킬·도구를 설치하거나 첫 작업을 시킬 때 사용하세요.",
    sections: JSON.stringify([
      { title: "프롬프트", body: item.body },
      { title: "관련 Page", body: pageTitle },
      { title: "원문", body: sourceUrl },
    ]),
  }));
}

if (process.argv.includes("--check")) {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  const pages = db.prepare("SELECT title, content FROM custom_pages WHERE user_id = ?").all(localUser);
  db.close();
  console.log(JSON.stringify({
    writes: 0,
    pageTitle,
    images: media.imageSources.length,
    prompts: prompts.length,
    faqs: faqs.length,
    localPage: isSamePage(pages) ? "skip" : "insert",
  }, null, 2));
  process.exit(0);
}

function importLocal() {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { page: "skipped", promptsInserted: 0, promptsSkipped: 0 };
  const transaction = db.transaction(() => {
    const pages = db.prepare("SELECT title, content FROM custom_pages WHERE user_id = ?").all(localUser);
    if (!isSamePage(pages)) {
      db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(randomUUID(), localUser, pageTitle, pageContent, now, now);
      result.page = "inserted";
    }
    const existing = db.prepare("SELECT title, category FROM prompts WHERE user_id = ?").all(localUser);
    const insert = db.prepare("INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)");
    for (const prompt of promptRows()) {
      if (existing.some((row) => row.title === prompt.title && row.category === prompt.category)) {
        result.promptsSkipped += 1;
      } else {
        insert.run(randomUUID(), localUser, prompt.title, prompt.category, prompt.summary, prompt.when_to_use, prompt.sections, now, now);
        existing.push(prompt);
        result.promptsInserted += 1;
      }
    }
  });
  transaction();
  db.close();
  return result;
}

async function importProduction() {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const result = { page: "skipped", promptsInserted: 0, promptsSkipped: 0 };
  const { data: pages, error: pageError } = await supabase.from("custom_pages").select("id, title").eq("user_id", productionUser);
  if (pageError) throw pageError;
  if (!isSamePage(pages ?? [])) {
    const { error } = await supabase.from("custom_pages").insert({
      id: randomUUID(),
      user_id: productionUser,
      title: pageTitle,
      content: pageContent,
      created_at: now,
      updated_at: now,
    });
    if (error) throw error;
    result.page = "inserted";
  }
  const { data: existingPrompts, error: promptError } = await supabase
    .from("prompts")
    .select("title, category")
    .eq("user_id", productionUser)
    .eq("category", category);
  if (promptError) throw promptError;
  const stored = existingPrompts ?? [];
  for (const prompt of promptRows()) {
    if (stored.some((row) => row.title === prompt.title && row.category === prompt.category)) {
      result.promptsSkipped += 1;
    } else {
      const { error } = await supabase.from("prompts").insert({
        id: randomUUID(),
        user_id: productionUser,
        title: prompt.title,
        category: prompt.category,
        summary: prompt.summary,
        when_to_use: prompt.when_to_use,
        sections: prompt.sections,
        is_favorite: 0,
        created_at: now,
        updated_at: now,
      });
      if (error) throw error;
      stored.push(prompt);
      result.promptsInserted += 1;
    }
  }
  return result;
}

const local = importLocal();
const production = await importProduction();
console.log(JSON.stringify({ pageTitle, images: 1, prompts: prompts.length, local, production }, null, 2));
