// 제목 없는 카피에 본문 기준 제목과 태그를 채운다
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_USER = "dev";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";

export const TARGETS = [
  {
    id: "4ca81b0d-eaef-45a8-af55-8b4bbda8adab",
    title: "온라인 업무에 쓰는 크롬 확장 10개",
    tags: ["툴", "SEO"],
    phrase: "Wappalyzer",
  },
  {
    id: "3ff550aa-834c-41d2-a9de-44c909dd04be",
    title: "4명이 6개월 할 일을 하루로 줄이는 기획 프롬프트",
    tags: ["프롬프트", "자동화"],
    phrase: "15년차 IT 기획자",
  },
  {
    id: "dac24a82-7cab-47e0-8a31-9f6a29b39948",
    title: "아스트라·GPT-6 지시 부채 감사 프롬프트",
    tags: ["아스트라", "코덱스", "설정"],
    phrase: "지시 부채 감사",
  },
  {
    id: "d0757b08-a90d-4246-b20d-3ca91f806290",
    title: "클로드 코드로 X 자동게시 봇 만든 과정",
    tags: ["클로드", "후기"],
    phrase: "만든과정 정리.txt",
  },
  {
    id: "0793ad17-c817-4398-84a3-c1e67c1d8926",
    title: "시니어 엔지니어 역할 프롬프트 8개",
    tags: ["클로드", "프롬프트"],
    phrase: "깨끗한 아키텍처를 사용한 재구성",
  },
  {
    id: "3c71ca60-8546-4c6e-a69f-889cbce5a353",
    title: "네이버 상위노출 블로그 자동화 프롬프트 3개",
    tags: ["블로그", "SEO", "프롬프트"],
    phrase: "네이버 SEO 마스터",
  },
  {
    id: "d540f591-6a74-4d8a-b97b-767a6f50805d",
    title: "돈 되는 서비스 재료 GitHub 10개",
    tags: ["툴", "에이전트"],
    phrase: "github.com/The-Swarm-Corporation/AutoHedge",
  },
  {
    id: "e06bf8a8-ace6-4224-8d81-2cde0527857d",
    title: "아이디어 한 줄로 사업 완성하는 프롬프트 4개",
    tags: ["프롬프트", "자동화"],
    phrase: "프로덕트 그로스 해커",
  },
  {
    id: "bf2d40ea-5161-4e48-9e09-bcd77f11c89c",
    title: "아스트라로 만든 음료 3D 웹페이지 프롬프트",
    tags: ["아스트라", "후기"],
    phrase: "Three.js로 인터랙티브 3D",
  },
  {
    id: "37c71177-ef7e-4e96-a67d-98192f3d4635",
    title: "GPT-6 Astra 프롬프팅 공식 가이드 요약",
    tags: ["아스트라", "GPT", "설정"],
    phrase: "Astra를 GPT-5처럼 프롬프팅",
  },
  {
    id: "d5223dea-d1e5-45ff-a96d-85d1a84ee37e",
    title: "크리에이터 사업 콘텐츠 시스템 프롬프트 6개",
    tags: ["프롬프트", "스레드"],
    phrase: "바이럴 후킹 생성기",
  },
  {
    id: "ab112549-f7d4-4909-bf13-9636d489269f",
    title: "ChatGPT 인테리어 리디자인 프롬프트 7개",
    tags: ["GPT", "프롬프트"],
    phrase: "전문 인테리어 디자이너처럼 분석",
  },
  {
    id: "cf7da824-cbc4-4b09-bf3d-ee7abda1758c",
    title: "고객 응대 답변 템플릿 프롬프트",
    tags: ["프롬프트", "세일즈"],
    phrase: "Reply Template Spell",
  },
  {
    id: "80ec84f5-d4e3-4645-9338-4e3d0b4f3817",
    title: "4시간 만에 기술을 익히는 학습 프롬프트 6개",
    tags: ["프롬프트", "학습"],
    phrase: "강제 파인만 학습법",
  },
  {
    id: "a513f878-83bd-4152-bc52-64853748bfcb",
    title: "비개발자용 사이트 중간 점검 체크리스트",
    tags: ["SEO", "설정"],
    phrase: "생성형엔진 최적화",
  },
  {
    id: "ed6d8d3c-ab67-43da-83cd-fab88c9f5cc0",
    title: "플러터 앱 출시 자동화 프롬프트 4개",
    tags: ["프롬프트", "자동화"],
    phrase: "appStoreReviewDetail",
  },
  {
    id: "2079628e-74c3-4039-b0d9-0df50a9a7e1f",
    title: "인형집 스킨케어 캐릭터 3D 웹앱 프롬프트",
    tags: ["프롬프트", "디자인"],
    phrase: "인형집형 방",
  },
  {
    id: "03786b49-e66b-4b40-a22b-3cc44eaa38e8",
    title: "항공권 최저가 잡는 ChatGPT 프롬프트 5개",
    tags: ["GPT", "프롬프트"],
    phrase: "수요 타이밍 해독기",
  },
  {
    id: "6bf20b16-892b-416e-ab39-07fcd28ac5f6",
    title: "검색 상위 블로그 만드는 ChatGPT 질문 7개",
    tags: ["블로그", "SEO", "GPT"],
    phrase: "10년 차 블로그 마케팅 전문가",
  },
  {
    id: "94b84130-2832-4246-93e0-4600c9db2c2e",
    title: "코덱스 주간 한도를 맥 메뉴바에 띄우기",
    tags: ["코덱스", "아스트라"],
    phrase: "아스트라 엑스트라 하이",
  },
  {
    id: "fd8d9dd4-119d-4700-bc64-b0e699d33a14",
    title: "종목 분석 ChatGPT 프롬프트 7개",
    tags: ["금융", "프롬프트"],
    phrase: "시니어 주식 리서치 애널리스트",
  },
  {
    id: "589845c8-103f-42a5-bd64-920430947ffc",
    title: "클로드 워크플로 사령탑 설정",
    tags: ["클로드", "설정"],
    phrase: "서브 AI 군단",
  },
  {
    id: "2af6a590-0f85-43c1-bef1-3972a913fa58",
    title: "영어 학습 서비스 만드는 프롬프트 4개",
    tags: ["프롬프트", "자동화"],
    phrase: "GLM 5.3 Flash",
  },
  {
    id: "6302b64b-cb3e-4f70-ac94-7930fb8a1cb9",
    title: "여러 에이전트에 팀 표준을 맞추는 teamai-cli",
    tags: ["툴", "에이전트"],
    phrase: "Tencent/teamai-cli",
  },
  {
    id: "2c9725c2-b4cd-49cc-8ee0-2ca57fbf080d",
    title: "슬래시 명령어 20개",
    tags: ["프롬프트", "설정"],
    phrase: "/systemdesign",
  },
  {
    id: "a76f91d8-bff2-4fc3-8b1c-a3fed3e0e1f2",
    title: "클로드 디자인할 때 볼 레퍼런스 3곳",
    tags: ["클로드", "디자인", "레퍼런스"],
    phrase: "navbar.gallery",
  },
  {
    id: "02991010-ffb5-4326-92e7-019b4346a874",
    title: "PRD부터 아스트라 구현까지 프롬프트 6개",
    tags: ["아스트라", "프롬프트"],
    phrase: "Low-fidelity Wireframe",
  },
  {
    id: "4fb88054-562c-40bd-83f5-70d71d449187",
    title: "아스트라 콘티와 Gemini Omni로 영상 만들기",
    tags: ["아스트라", "프롬프트"],
    phrase: "영상천재 gemini",
  },
  {
    id: "3dc11988-4a90-4861-89c7-26211a62f929",
    title: "Appllama MCP로 칼로리 추적 앱 만들기",
    tags: ["MCP", "디자인", "프롬프트"],
    phrase: "Appllama",
  },
  {
    id: "096ca6b0-a2f7-432b-8b9a-114bc208cf99",
    title: "바이브코딩 앱 UI 참고 사이트 4곳",
    tags: ["디자인", "레퍼런스"],
    phrase: "Mobbin",
  },
  {
    id: "7a563e6c-26fd-40f3-83b9-09ed5194a988",
    title: "코딩 에이전트에 6단계를 심는 agent-skills",
    tags: ["스킬", "에이전트"],
    phrase: "addyosmani/agent-skills",
  },
  {
    id: "068143ac-747d-4941-9fbe-93b2cb6c7649",
    title: "면접 준비 회사 분석 프롬프트 6개",
    tags: ["프롬프트", "학습"],
    phrase: "DART 전자공시",
  },
  {
    id: "37ce3e8f-5fcf-4d79-9d29-b84f14a0eb7a",
    title: "웹사이트 배포 전 확인 체크리스트",
    tags: ["SEO", "설정"],
    phrase: "네이버 서치어드바이저",
  },
  {
    id: "eeb94cc1-5567-4c45-b937-ecf135514c28",
    title: "그록봇으로 돈 버는 프롬프트 30개",
    tags: ["그록", "프롬프트"],
    phrase: "10 GROKBOT PROMPTS - @poteto",
  },
  {
    id: "0c8bacb8-69b2-48dc-9c1e-67d3c9dd641e",
    title: "그록봇을 제대로 쓰는 팁 20개",
    tags: ["그록", "설정"],
    phrase: "Grok Bot을 101%의 힘으로",
  },
  {
    id: "d6a587a3-064a-4437-8aef-44b55f6d55fe",
    title: "코드를 제대로 뽑는 지시 3가지",
    tags: ["프롬프트", "설정"],
    phrase: "변수명 축약 금지",
  },
  {
    id: "d4f1ccd0-64c4-4a07-930c-067a8f1e56f1",
    title: "Jev와 그록봇을 7분에 붙이는 셋업",
    tags: ["그록", "에이전트"],
    phrase: "jev-usage-router",
  },
  {
    id: "8f56a901-ce0b-423e-ba13-6ad7e4db369f",
    title: "앱 배포 전 보안 체크리스트",
    tags: ["보안", "설정"],
    phrase: "SQL 및 NoSQL 인젝션",
  },
  {
    id: "76b9e0da-c327-4a68-9e1f-bdb95766a073",
    title: "바이브 코더가 json-render에 열광하는 이유 4가지",
    tags: ["디자인", "툴"],
    phrase: "완벽한 레고 블록 방식",
  },
  {
    id: "9fd6c617-d172-4c53-b4fc-d5610a9aa76b",
    title: "올해 본 네카라쿠배 합격 포트폴리오 특징 10가지",
    tags: ["디자인", "학습"],
    phrase: "가입 3단계에서 41% 이탈",
  },
  {
    id: "35077dec-bdb4-4654-9213-93a6a90bc808",
    title: "shadcn pdfcn이 PDF 생성을 바꾼 이유 5가지",
    tags: ["디자인", "툴"],
    phrase: "Takumi & Forme",
  },
  {
    id: "a6e91369-0610-4ddc-9f0b-fc8136e5d6d9",
    title: "점성술 개인 분석 프롬프트 7개",
    tags: ["프롬프트", "학습"],
    phrase: "숙련된 [베다 / 서양] 점성술",
  },
  {
    id: "ab1da4be-169d-4d16-8f4a-b7d60abd0a63",
    title: "Opus 5.5 지시 정리 프롬프트",
    tags: ["클로드", "프롬프트"],
    phrase: "가장 보람찬 5분",
  },
  {
    id: "3b155af0-b3e5-4f1c-9b11-20cf4358f6d3",
    title: "Claude Code 템플릿 라이브러리가 필수인 이유 4가지",
    tags: ["클로드", "툴"],
    phrase: "npx claude-code-templates",
  },
  {
    id: "60fe3729-e84d-41a1-a091-4b4d68e21423",
    title: "Opus 5.5 지침을 점검하고 반영하는 4단계",
    tags: ["클로드", "설정"],
    phrase: "왜 넣었는지 기억 안 나는 규칙",
  },
  {
    id: "9f13cc5b-b622-4a7c-a6b0-954ae53463b1",
    title: "Opus 5.5 토큰 낭비를 줄이는 4단계",
    tags: ["클로드", "설정"],
    phrase: "스크롤백이 아닌 파일",
  },
  {
    id: "7ae9b357-e2c2-4370-ac11-a4f2292c7ee5",
    title: "Fable을 Opus 5.5 어드바이저로 두는 설정",
    tags: ["클로드", "설정"],
    phrase: "Fable은 대기열에 대기합니다",
  },
  {
    id: "8aef3817-fe9f-4c1d-a542-78dd99c6b0d6",
    title: "블로그 광고 수익 구조를 만드는 질문 7개",
    tags: ["블로그", "프롬프트"],
    phrase: "10년 차 애드센스 최적화",
  },
  {
    id: "c89c87f9-fd49-45c0-a657-f93b578e86b2",
    title: "Aside로 글을 시간마다 올리게 하는 셋업",
    tags: ["자동화", "설정"],
    phrase: "mcp로 aside",
  },
  {
    id: "576fd63e-3f84-4d0b-843f-cf3a2bf06b4f",
    title: "클로드 코드 상태 표시줄 디자인 프롬프트 5종",
    tags: ["클로드", "디자인"],
    phrase: "민트색 진행 막대",
  },
  {
    id: "6eb902b1-5269-4ff2-a25b-8e59142aeac8",
    title: "속도 제한 뒤에도 클로드를 쓰는 low-priority",
    tags: ["클로드", "설정"],
    phrase: "/low-priority",
  },
  {
    id: "76372086-a6a2-43a7-a444-24fe6a0590a5",
    title: "바이브코딩에 쓰는 클로드 코드 명령어 정리",
    tags: ["클로드", "설정"],
    phrase: "필수 클로드코드 핵심 명령어",
  },
  {
    id: "8c10b2b4-c0e3-4b01-b63e-f916a03447e9",
    title: "Opus 5.5로 UI 모션을 코드로 만드는 프롬프트",
    tags: ["클로드", "디자인"],
    phrase: "Dribbble 수준의 UI 모션",
  },
  {
    id: "52dff1ba-6e9e-407a-bfde-86281e0c5279",
    title: "검색 비교에서 Typesense가 OpenSearch를 앞섰다",
    tags: ["툴", "후기"],
    phrase: "Typesense도 메모리는 208MB",
  },
  {
    id: "7bfc97c1-3c1c-491e-8716-813803a5d75c",
    title: "낡은 지시를 씻는 prompt-audit",
    tags: ["클로드", "프롬프트"],
    phrase: "세대 지연된 프롬프트",
  },
  {
    id: "e73d3a38-144c-4842-a75e-5bc3ddd07526",
    title: "출시 전 바이브코딩 사이트를 고치는 말 20가지",
    tags: ["클로드", "설정"],
    phrase: "맞춤 404 페이지",
  },
  {
    id: "a19ad09f-57b9-4dd2-a934-e8e6a50e9763",
    title: "로컬 의사결정 모델 Ollaya가 가벼운 이유 5가지",
    tags: ["툴", "에이전트"],
    phrase: "ollaya run laya",
  },
  {
    id: "737967b0-c4de-48cc-a5a9-7813a8f234fe",
    title: "애드센스 글을 검색용으로 잡는 프롬프트 5개",
    tags: ["블로그", "프롬프트"],
    phrase: "검색 유입으로 애드센스 수익",
  },
  {
    id: "75b8cd5a-4a98-4e0a-836f-6761a5a9eb7f",
    title: "긴 작업 전에 HTML 진행 대시보드를 붙이는 설정",
    tags: ["클로드", "에이전트"],
    phrase: "dashboard-builder",
  },
  {
    id: "84f52d99-1e8d-4c72-bf31-99c42add84e0",
    title: "노션 키워드를 네이버 초안으로 보내는 Muse 6단계",
    tags: ["블로그", "자동화"],
    phrase: "초간단 Muse 블로그 자동화",
  },
  {
    id: "73f7923b-49bb-464f-853b-65748dddb6c0",
    title: "Muse 전담 비서 프롬프트 12개",
    tags: ["프롬프트", "에이전트"],
    phrase: "awesome-muse-connectors",
  },
  {
    id: "849a36c8-f5c5-4199-899a-cb4269b9e6b7",
    title: "서버에 올려 쓰는 오픈소스 비서 OpenMuse",
    tags: ["에이전트", "툴"],
    phrase: "기업용 내부 AI 비서",
  },
  {
    id: "d3cf2f44-fcc3-4704-a48e-01f1bb0d73b8",
    title: "사주 사이트를 만들어 결제까지 붙이는 프롬프트 6개",
    tags: ["프롬프트", "SEO", "세일즈"],
    phrase: "원페이지 사주 웹사이트",
  },
  {
    id: "a29207d4-9d94-493e-8c59-8174618a6391",
    title: "Fable 5.1을 Opus 5.5 어드바이저로 두는 설정",
    tags: ["클로드", "설정"],
    phrase: "Fable 5.1이 검토합니다",
  },
  {
    id: "6d7def0f-1cd7-4b82-8dad-ee49fe64cadb",
    title: "Claude Mods와 커밋 전 verify가 들어온 변경 4가지",
    tags: ["클로드", "설정"],
    phrase: "cc-plugin-you-should-know",
  },
  {
    id: "5e8d1cb6-dadc-417f-952b-bf9f139e0b42",
    title: "디저트 카페 메뉴용 페이퍼컷 일러스트 프롬프트",
    tags: ["디자인", "프롬프트"],
    phrase: "matte cream background",
  },
  {
    id: "9cac5c52-ddce-4384-8537-43c248a5e160",
    title: "초보자가 Fincept Terminal을 설치하는 안내 프롬프트",
    tags: ["프롬프트", "설정"],
    phrase: "Continue as Guest",
  },
  {
    id: "130c355c-cdf8-4b7f-96c4-5e9588b11e9c",
    title: "팀에서 AGENTS.md를 관리하는 규칙 5가지",
    tags: ["에이전트", "설정"],
    phrase: "README.md는 사람이 보는 문서",
  },
  {
    id: "2cd8de9f-acae-4277-b9d9-849bf585a34f",
    title: "Sonnet 5.5에게 잡일을 맡기고 Fable을 두는 설정",
    tags: ["클로드", "설정"],
    phrase: "각 모델에: sonnet",
  },
  {
    id: "3fbd6361-45cf-4bfe-aa7e-3ba1a03bef3b",
    title: "놓친 정보를 짚는 You should Know 플러그인",
    tags: ["클로드", "설정"],
    phrase: "당신을 최신 상태로 유지",
  },
  {
    id: "ee12a5b6-02b5-44e3-a48c-35463bb47bbb",
    title: "모델 출력을 글보다 영상으로 받는 팁",
    tags: ["프롬프트", "학습"],
    phrase: "ASD-STE100의 80%",
  },
  {
    id: "14668855-5943-43b4-99e7-a08957ede788",
    title: "NotebookLM으로 문서를 읽고 토큰을 아끼는 연결",
    tags: ["클로드", "MCP"],
    phrase: "nlm login",
  },
  {
    id: "00d65258-09e8-4a76-b952-0709ccc64011",
    title: "LLM 글을 통제 언어와 영상으로 받는 팁",
    tags: ["프롬프트", "학습"],
    phrase: "3b1b 스타일로 영상",
  },
  {
    id: "6b46b2b7-7b0e-4ead-8f46-14aa05f31fcf",
    title: "Aside로 뉴스 글을 쓰고 쇼핑을 붙이는 순서",
    tags: ["블로그", "자동화"],
    phrase: "쇼핑커넥트",
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

/** 저장된 태그 JSON이 비어 있으면 true다. */
export function tagsAreEmpty(raw) {
  if (raw == null) return true;
  if (Array.isArray(raw)) return raw.length === 0;
  const s = String(raw).trim();
  if (!s || s === "[]" || s === "null") return true;
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) && parsed.length === 0;
  } catch {
    return false;
  }
}

/** 본문에 확인 문구가 있고 태그가 비어 있으면 갱신한다. */
export function nextPatch(row, target) {
  if (!row) return { action: "missing" };
  if (!String(row.body ?? "").includes(target.phrase)) {
    return { action: "mismatch" };
  }
  if (!tagsAreEmpty(row.tags)) return { action: "skip" };
  return {
    action: "update",
    title: target.title,
    tags: JSON.stringify(target.tags),
  };
}

function loadEnv() {
  for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[key]) throw new Error(`필수 환경변수 누락. ${key}`);
  }
}

function patchLocal(target) {
  const db = new Database(resolve(root, "data/mymark.db"));
  const row = db
    .prepare(
      `SELECT id, title, tags, body FROM thread_copies WHERE id = ? AND user_id = ?`
    )
    .get(target.id, LOCAL_USER);
  const plan = nextPatch(row, target);
  if (plan.action === "update") {
    db.prepare(
      `UPDATE thread_copies SET title = ?, tags = ?, updated_at = ? WHERE id = ? AND user_id = ?`
    ).run(plan.title, plan.tags, new Date().toISOString(), target.id, LOCAL_USER);
  }
  db.close();
  return plan.action;
}

async function patchProduction(supabase, target) {
  const { data, error } = await supabase
    .from("thread_copies")
    .select("id, title, tags, body")
    .eq("id", target.id)
    .eq("user_id", PROD_USER)
    .maybeSingle();
  if (error) throw error;
  const plan = nextPatch(data, target);
  if (plan.action === "update") {
    const { error: updateError } = await supabase
      .from("thread_copies")
      .update({
        title: plan.title,
        tags: plan.tags,
        updated_at: new Date().toISOString(),
      })
      .eq("id", target.id)
      .eq("user_id", PROD_USER);
    if (updateError) throw updateError;
  }
  return plan.action;
}

async function previewProduction(supabase, target) {
  const { data, error } = await supabase
    .from("thread_copies")
    .select("id, title, tags, body")
    .eq("id", target.id)
    .eq("user_id", PROD_USER)
    .maybeSingle();
  if (error) throw error;
  const plan = nextPatch(data, target);
  return {
    id: target.id,
    action: plan.action,
    fromTitle: data?.title ?? null,
    toTitle: plan.action === "update" ? plan.title : data?.title ?? null,
    fromTags: data?.tags ?? null,
    toTags: plan.action === "update" ? plan.tags : data?.tags ?? null,
  };
}

async function main() {
  const check = process.argv.includes("--check");
  loadEnv();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  const counts = { update: 0, skip: 0, missing: 0, mismatch: 0 };
  for (const target of TARGETS) {
    if (check) {
      const preview = await previewProduction(supabase, target);
      counts[preview.action] += 1;
      console.log(
        JSON.stringify({
          id: preview.id,
          action: preview.action,
          fromTitle: preview.fromTitle,
          toTitle: preview.toTitle,
          fromTags: preview.fromTags,
          toTags: preview.toTags,
        })
      );
      continue;
    }
    const local = patchLocal(target);
    const prod = await patchProduction(supabase, target);
    counts[prod] += 1;
    console.log(
      JSON.stringify({
        id: target.id,
        local,
        prod,
        title: target.title,
        tags: target.tags,
      })
    );
  }
  console.log(JSON.stringify({ check, counts }));
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
