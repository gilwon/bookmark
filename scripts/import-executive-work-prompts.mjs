// 회의·보고·분석용 업무 프롬프트 8종을 개발·운영 라이브러리에 저장한다
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envPath = resolve(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const LOCAL_USER = "dev";
const CATEGORY = "업무 · 회의·보고·분석";
const now = new Date().toISOString();

const prompts = [
  ["고품격 회의자료", "10분 팀 회의를 위한 7장 발표 자료를 문제부터 실행까지 자연스럽게 구성합니다.", "내일 팀 회의에서 주제를 빠르게 설득력 있는 발표 자료로 정리해야 할 때 사용하세요.", `내일 팀 회의 발표 자료를 만들어줘.

주제. [입력]

조건.
- 총 7장 슬라이드 구조로 작성해줘.
- 각 장마다 핵심 메시지 1개와 근거 2개를 포함해줘.
- 문제 → 원인 → 해결 → 기대효과 흐름으로 구성해줘.
- 실제 발표용으로 자연스럽게 이어지게 구성해줘.
- 각 슬라이드의 제목과 한 줄 메시지를 작성해줘.
- 마지막 장에는 실행 액션 3개를 포함해줘.
- 발표 시간은 10분 기준으로 조절해줘.`],
  ["보고서 퀄리티 3배 향상", "보고서의 문장·논리·구조를 다듬고 수정 전후를 비교합니다.", "초안 보고서를 임원 또는 이해관계자에게 제출하기 전 완성도를 높일 때 사용하세요.", `아래 보고서를 다듬어줘.

[보고서 붙여넣기]

요청.
- 어색한 문장을 자연스럽게 수정해줘.
- 논리 흐름이 끊긴 부분을 연결해줘.
- 중복되거나 불필요한 문장을 제거해줘.
- 가독성 좋게 재구성하고 핵심 메시지를 더 강조해줘.
- 수정 전/후 비교를 제공해줘.
- 더 설득력 있게 보이도록 표현도 개선해줘.`],
  ["최신 데이터 + 인사이트", "2026년 최신 시장 데이터를 핵심 수치와 PPT용 문장으로 압축합니다.", "시장·산업 동향을 근거와 함께 발표 자료에 반영해야 할 때 사용하세요.", `주제. [입력]

요청.
- 2026년 기준 최신 통계와 시장 데이터를 검색해줘.
- 신뢰 가능한 출처 링크를 각 수치에 포함해줘.

정리 방식.
1. 핵심 수치 3개를 숫자 중심으로 제시해줘.
2. 각 수치의 한 줄 해석을 작성해줘.
3. PPT에 바로 넣을 한 줄 요약을 작성해줘.

추가.
- 현재 트렌드를 한 줄로 정리해줘.
- 앞으로 1~2년 전망을 한 줄로 정리해줘.`],
  ["기획서 초안 5분 컷", "임원이 5분 안에 판단할 수 있는 숫자 중심 프로젝트 기획서 초안을 만듭니다.", "신규 프로젝트의 승인 또는 예산 검토용 기획서를 빠르게 작성할 때 사용하세요.", `프로젝트 기획서 초안을 작성해줘.

프로젝트명. [입력]

구성.
1. 배경. 왜 지금 해야 하는지.
2. 목적. 정량 목표 포함.
3. 기대효과. 비즈니스 임팩트 중심.
4. 실행 계획. 단계별.
5. 일정. 간단한 타임라인.
6. 예산. 범위라도 제시.

조건.
- 임원이 5분 안에 이해할 수 있는 밀도로 작성해줘.
- 불필요한 설명 없이 핵심만 작성해줘.
- 숫자와 성과 중심으로 표현해줘.
- 상단에 한 줄 요약을 넣어줘.
- 마지막에 승인 유도 문장을 포함해줘.`],
  ["이메일 설득력 2배 만들기", "한 이메일을 임원용과 파트너용으로 각각 설득력 있게 재작성합니다.", "같은 내용을 수신자 관계에 맞춰 전달해야 할 때 사용하세요.", `아래 이메일을 2가지 버전으로 변환해줘.

[이메일 원문]

A. 대기업 임원용. 격식 있고 논리 중심.
B. 파트너용. 친근하고 관계 중심.

조건.
- 핵심 메시지는 유지해줘.
- 불필요한 문장은 줄이고 설득력을 강화해줘.
- 각 버전의 제목을 3개씩 추천해줘.
- 상대방이 행동하게 만드는 CTA를 포함해줘.`],
  ["경쟁사 분석 + 전략 전문가", "최근 3개월 경쟁사 동향을 분석해 공략 기회와 실행 아이디어를 도출합니다.", "경쟁사 대응 전략이나 분기별 시장 점검이 필요할 때 사용하세요.", `경쟁사. [입력]

최근 3개월 기준으로 분석해줘.

정리.
1. 주요 제품·서비스 변화.
2. 마케팅 전략 및 캠페인.
3. 고객 반응 및 리뷰 요약.

추가.
- 경쟁사의 강점 3개와 약점 3개를 정리해줘.
- 우리가 공략할 수 있는 기회 3개를 제안해줘.
- 바로 실행 가능한 액션 아이디어 3개를 제안해줘.
- 실무자가 바로 활용할 수 있는 수준으로 작성해줘.
- 확인 가능한 사실에는 출처 링크를 포함해줘.`],
  ["의사결정 비교표", "세 가지 선택지를 엑셀에 붙여넣을 수 있는 비교표와 상황별 추천으로 정리합니다.", "도구·서비스·구매 옵션을 빠르게 비교해 선택해야 할 때 사용하세요.", `아래 항목 3개를 비교표로 정리해줘.

[항목 입력]

형식.
- 열은 기능, 가격, 장점, 단점, 추천 대상으로 구성해줘.
- 한눈에 비교되도록 간결하게 작성해줘.
- 엑셀에 바로 붙여넣기 가능한 Markdown 표로 출력해줘.

추가.
- 각 항목별 핵심 한 줄 요약을 작성해줘.
- 가성비, 성능, 초보자용 등 상황별 추천을 제시해줘.
- 마지막에 어떤 경우에 무엇을 선택해야 하는지 결론을 작성해줘.`],
  ["대표님 핵심 보고용", "긴 문서에서 결론·근거·리스크만 뽑아 의사결정용으로 압축합니다.", "대표 또는 임원에게 빠른 판단을 위한 요약 보고를 올릴 때 사용하세요.", `아래 문서를 읽고 핵심만 정리해줘.

[문서 붙여넣기]

정리.
1. 결론. 가장 중요한 판단.
2. 근거. 핵심 이유.
3. 리스크. 주의사항.

추가.
- 3줄 요약을 작성해줘.
- 가장 중요한 문장 3개를 추출해줘.
- 의사결정자가 바로 쓸 수 있는 코멘트 1줄을 작성해줘.

조건.
- 불필요한 내용은 제거해줘.
- 빠르게 판단할 수 있게 작성해줘.`],
];

const rows = prompts.map(([title, summary, when_to_use, body]) => ({
  id: randomUUID(), user_id: LOCAL_USER, title, category: CATEGORY, summary, when_to_use,
  sections: JSON.stringify([{ title: "프롬프트", body }]), is_favorite: 0, created_at: now, updated_at: now,
}));

const db = new Database(resolve(root, "data/mymark.db"));
const insert = db.prepare(`INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (@id, @user_id, @title, @category, @summary, @when_to_use, @sections, @is_favorite, @created_at, @updated_at)`);
const find = db.prepare("SELECT id FROM prompts WHERE user_id = ? AND title = ? AND category = ?");
let localInserted = 0;
for (const row of rows) if (!find.get(LOCAL_USER, row.title, CATEGORY)) { insert.run(row); localInserted++; }
db.close();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let prodInserted = 0;
for (const row of rows) {
  const { data: existing, error: lookupError } = await sb.from("prompts").select("id").eq("user_id", PROD_USER).eq("title", row.title).eq("category", CATEGORY);
  if (lookupError) throw lookupError;
  if (!existing?.length) {
    const { error } = await sb.from("prompts").insert({ ...row, id: randomUUID(), user_id: PROD_USER });
    if (error) throw error;
    prodInserted++;
  }
}

console.log({ localInserted, prodInserted, total: rows.length });
