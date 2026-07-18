// 대시보드 스타일 가이드와 재사용 프롬프트를 Pages·Prompts에 저장한다
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(resolve(root, ".env.local"))) {
  for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim().replace(/^("|')|("|')$/g, "");
    }
  }
}

const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const LOCAL_USER = "dev";
const CATEGORY = "데이터 시각화 · 대시보드";
const PAGE_TITLE = "대시보드 스타일 8종 가이드";
const now = new Date().toISOString();

const styles = [
  {
    name: "비즈니스 스위트",
    summary: "밝은 무채색과 딥블루 포인트로 신뢰감을 주는 임원·투자자 보고용 스타일.",
    when: "분기 실적, 투자자 보고, 정기 임원 보고.",
    body: "이 데이터로 비즈니스 보고용 대시보드를 만들어줘. 전체 톤은 밝은 회색 배경에 짙은 차콜 글자, 포인트는 딥블루 한 색만. 표와 차트는 얇은 구분선으로 정돈하고 셀 사이 여백을 넉넉히 둬. 제목은 굵게 크게, 본문과 라벨은 작고 단정하게 위계를 줘. 차트는 채도를 낮춘 단색 계열로 통일하고 격자선은 흐리게. 숫자는 천 단위 구분기호와 우측 정렬로 깔끔하게 맞춰줘.",
  },
  {
    name: "미드나잇",
    summary: "어두운 배경과 청록·라임 네온 포인트를 쓰는 발표·콘텐츠용 다크모드 스타일.",
    when: "발표 화면, 콘텐츠 썸네일, 숏폼 캡처.",
    body: "이 데이터로 다크모드 대시보드를 만들어줘. 짙은 차콜·먹색 배경 위에 데이터 영역만 살짝 밝은 패널로 띄우고, 포인트 색은 청록과 라임 네온으로. 차트는 선과 막대를 네온으로 강조하고 면적은 은은한 그라데이션으로, 격자선과 테두리는 거의 안 보이게 어둡게 깔아줘. 글자는 밝은 회색, 강조 숫자만 네온으로 빛나 보이게 대비를 강하게. 전체적으로 어둠 속에서 데이터만 떠 보이는 느낌으로.",
  },
  {
    name: "노션",
    summary: "순백·얇은 선·절제된 흑백으로 군더더기를 없앤 개인 관리용 스타일.",
    when: "개인 가계부, 자기관리, 1인 사업 정리.",
    body: "이 데이터로 노션 문서처럼 미니멀한 화이트 대시보드를 만들어줘. 순백 배경에 아주 얇은 연회색 구분선만 쓰고 색은 검정·회색 위주로 절제해. 표는 테두리를 최소화하고 행 간격을 넉넉히, 차트는 채움을 줄인 단색 막대와 가는 라인으로 단순하게. 항목은 좌측 정렬 위주로 정돈하고 강조가 꼭 필요한 한두 군데만 검정 볼드로. 잡지 본문처럼 차분하고 읽기 편하게.",
  },
  {
    name: "팝 인포그래픽",
    summary: "파스텔 배경과 색 블록으로 친근하고 직관적으로 보여주는 스타일.",
    when: "SNS 공유용, 교육 자료, 비전문가 대상 발표.",
    body: "이 데이터로 컬러풀한 인포그래픽 스타일 대시보드를 만들어줘. 항목마다 고유 색을 정해 전체에서 일관되게 쓰고, 배경은 밝은 파스텔 톤으로. 차트는 알록달록한 색을 입혀 대비를 살리고, 표 대신 둥근 모서리 색 블록·색 바로 값을 표현해서 직관적으로. 퍼센트나 핵심 수치는 큼직하게, 카드엔 옅은 그림자를 줘서 입체감을 더해. 밝고 경쾌하지만 색 조합은 정돈되게.",
  },
  {
    name: "보그",
    summary: "대담한 세리프 헤드라인과 넓은 여백을 쓰는 프리미엄 매거진 스타일.",
    when: "브랜드 자료, 포트폴리오, 프리미엄 제안서.",
    body: "이 데이터를 하이엔드 패션 매거진 화보처럼 세련되게 디자인해줘. 넓은 여백을 과감하게 비우고, 헤드라인은 큰 세리프 폰트로 한두 단어만 강하게. 색은 흑·백·아이보리 베이스에 포인트는 절제된 한 색(머스터드나 버건디 같은 톤)만 살짝. 차트는 장식을 걷어내고 가는 선과 단색 면으로 미니멀하게, 숫자는 디스플레이 폰트로 크게 배치해 그 자체가 디자인 요소가 되게. 좌우 비대칭 레이아웃으로 긴장감을 주고, 전체적으로 비싸 보이고 정제된 편집 감각으로.",
  },
  {
    name: "타임라인",
    summary: "추이와 변곡점이 주인공인 시계열 데이터 중심 스타일.",
    when: "매출 추이, 체중 기록, 트래픽 등 시간에 따라 변하는 자료.",
    body: "이 데이터로 시간 흐름을 강조한 대시보드를 만들어줘. 메인은 기간별 추이를 보여주는 큰 라인 또는 콤보 차트로 상단 전체 폭을 쓰고, 상승·하락 구간이 잘 드러나게 추세선이나 면적 강조를 더해. 보조로 항목별 추이를 작은 미니 라인 차트 여러 개로 나란히 배치하고, 색은 차분한 한두 계열로 통일해 흐름에 집중되게. 최고점·최저점 같은 변곡 지점은 마커로 짚어줘.",
  },
  {
    name: "데이터 덴스",
    summary: "히트맵·데이터 바·스파크라인으로 한 화면의 분석 밀도를 높이는 스타일.",
    when: "상세 분석, 실무용 마스터 시트.",
    body: "이 데이터로 정보 밀도가 높은 분석 대시보드를 만들어줘. 표 셀에 값이 클수록 진해지는 히트맵을 깔고, 숫자 칸에는 막대 길이로 크기를 보여주는 데이터 바를 넣어. 각 행 끝에는 추이를 셀 하나에 담는 스파크라인을 배치해. 정보가 빽빽해도 열 너비와 정렬을 일정하게 맞춰 정돈된 느낌을 유지하고, 색은 한 계열의 농담만으로 통일해 산만하지 않게. 작지만 또렷하게 읽히도록.",
  },
  {
    name: "에디토리얼",
    summary: "큰 제목과 2단 편집 레이아웃으로 읽는 자료에 맞춘 리포트 스타일.",
    when: "결산 리포트, 제안서, 공유용 문서.",
    body: "이 데이터를 매거진 표지처럼 편집 디자인된 대시보드로 만들어줘. 맨 위에 큰 헤드라인과 한 줄 요약 문장을 두고, 본문은 2단 레이아웃으로 차트와 짧은 설명 텍스트를 번갈아 배치해. 폰트는 제목·소제목·본문의 크기 차이를 분명히 줘서 잡지 같은 위계를 만들고, 색은 흑백 베이스에 포인트 한 색만. 차트 옆엔 그 차트가 말하는 핵심을 한 문장으로 적어줘. 여백을 충분히 살려 고급스럽게.",
  },
];

const textNode = (text) => ({ type: "text", text });
const paragraph = (text) => ({ type: "paragraph", content: [textNode(text)] });
const page = {
  title: PAGE_TITLE,
  content: JSON.stringify({
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [textNode(PAGE_TITLE)] },
      { type: "blockquote", content: [paragraph("사용자 제공 원본자료.")] },
      ...styles.flatMap((style, index) => [
        { type: "heading", attrs: { level: 2 }, content: [textNode(`${index + 1}. ${style.name}`)] },
        paragraph(`특징. ${style.summary}`),
        paragraph(`추천 사용처. ${style.when}`),
        paragraph(style.body),
      ]),
    ],
  }),
};
const prompts = styles.map((style) => ({
  id: randomUUID(), user_id: LOCAL_USER, title: `대시보드 스타일 · ${style.name}`, category: CATEGORY,
  summary: style.summary, when_to_use: style.when,
  sections: JSON.stringify([{ title: "프롬프트", body: style.body }]),
  is_favorite: 0, created_at: now, updated_at: now,
}));

const db = new Database(resolve(root, "data/mymark.db"));
const findPage = db.prepare("SELECT id FROM custom_pages WHERE user_id = ? AND title = ?");
const findPrompt = db.prepare("SELECT id FROM prompts WHERE user_id = ? AND title = ? AND category = ?");
const insertPage = db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)");
const insertPrompt = db.prepare("INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (@id, @user_id, @title, @category, @summary, @when_to_use, @sections, @is_favorite, @created_at, @updated_at)");
let localPages = 0;
let localPrompts = 0;
if (!findPage.get(LOCAL_USER, page.title)) { insertPage.run(randomUUID(), LOCAL_USER, page.title, page.content, now, now); localPages += 1; }
for (const prompt of prompts) if (!findPrompt.get(LOCAL_USER, prompt.title, CATEGORY)) { insertPrompt.run(prompt); localPrompts += 1; }
db.close();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let prodPages = 0;
let prodPrompts = 0;
const { data: existingPage, error: pageError } = await sb.from("custom_pages").select("id").eq("user_id", PROD_USER).eq("title", page.title).limit(1);
if (pageError) throw pageError;
if (!existingPage?.length) { const { error } = await sb.from("custom_pages").insert({ id: randomUUID(), user_id: PROD_USER, ...page, created_at: now, updated_at: now }); if (error) throw error; prodPages += 1; }
for (const prompt of prompts) {
  const { data, error } = await sb.from("prompts").select("id").eq("user_id", PROD_USER).eq("title", prompt.title).eq("category", CATEGORY).limit(1);
  if (error) throw error;
  if (data?.length) continue;
  const { id, user_id, ...row } = prompt;
  const { error: insertError } = await sb.from("prompts").insert({ id: randomUUID(), user_id: PROD_USER, ...row });
  if (insertError) throw insertError;
  prodPrompts += 1;
}

console.log({ localPages, localPrompts, prodPages, prodPrompts });
