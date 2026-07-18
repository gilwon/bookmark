// Claude 디자인 참고 프롬프트를 Prompts에 저장한다
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(resolve(root, ".env.local"))) for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split("\n")) { const match = line.match(/^([^#=]+)=(.*)$/); if (match && !process.env[match[1].trim()]) process.env[match[1].trim()] = match[2].trim().replace(/^("|')|("|')$/g, ""); }

const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const LOCAL_USER = "dev";
const CATEGORY = "Claude 디자인 · 참고 프롬프트";
const now = new Date().toISOString();
const items = [
  ["Prototype · 서비스 견적 시뮬레이터", "색상·상호작용까지 적용된 마케팅 서비스 견적 시뮬레이터 웹앱.", "찍봇 마케팅 회사의 서비스 견적 시뮬레이터 웹앱을, 색상과 디자인이 실제 완성된 서비스처럼 다 입혀진 버전으로 만들어줘. 화면 맨 위에는 찍봇 마케팅 회사 로고와 함께 ‘AI 콘텐츠로 비즈니스 성장을 돕는 마케팅 파트너’라는 짧은 소개 문구, 그리고 구독자 3만 명 채널 운영 경험을 짧게 언급하는 한 줄 소개를 넣어줘. 그 아래부터 견적 시뮬레이터 화면을 배치해줘. 화면 왼쪽에는 서비스 옵션 체크박스 4개(영상 편집, 썸네일 제작, SNS 계정 관리, AI 챗봇 구축)와 월 영상 제작 개수를 조절하는 슬라이더를 배치해줘. 화면 오른쪽에는 선택한 옵션에 따라 실시간으로 바뀌는 견적 금액과 예상 작업 기간을 큼직하게 보여줘. 컬러는 딥네이비(#1A2332)를 배경 및 헤더에, 민트(#00D9C0)를 버튼과 강조 텍스트에 사용해줘. 폰트는 깔끔한 모던 산세리프체로. 왼쪽에서 옵션을 클릭하거나 슬라이더를 움직이면 오른쪽 견적 금액이 즉시 바뀌도록 만들어줘."],
  ["Slides · 브랜드 협찬 사업계획서", "스폰서 미팅용 6장 사업계획서와 발표자 노트.", "찍봇 마케팅 회사의 사업계획서를 총 6장 슬라이드로 만들어줘. 이 자료는 브랜드 협찬 미팅에서 스폰서 담당자에게 보여줄 용도야. 구성은 1장 채널 소개(구독자 3만 명, 유튜브·쓰레드·틱톡·인스타그램 합산 5만 명 이상 도달), 2장 타겟 오디언스(35~54세 남성 1인 사업자, AI 도구와 생산성 관심층), 3장 콘텐츠 강점(AI 도구 리뷰와 실무 활용법), 4장 과거 협찬 사례와 성과, 5장 협찬 상품별 가격표(레이트카드), 6장 연락처와 협업 제안 방법이야. 슬라이드에는 핵심 문구와 숫자만 크게 넣고 자세한 설명은 발표자용 노트에 따로 적어줘. 전체 톤은 전문적이고 신뢰감 있는 테크 회사 느낌으로, 배경은 딥네이비(#1A2332), 강조 색은 민트(#00D9C0)로 통일해줘."],
  ["Document · 협찬 문의 미디어킷", "한 장짜리 인포그래픽 형태의 협찬 문의용 미디어킷.", "찍봇 마케팅 회사의 협찬 문의용 미디어킷을 한 장짜리 인포그래픽 형태로 만들어줘. 상단에는 찍봇 로고와 채널명을 크게 배치하고, 그 아래 구독자 수와 조회수 같은 핵심 숫자를 아이콘과 함께 보여줘. 중간에는 타겟 시청자층 정보(35~54세 남성 1인 사업자, AI 도구 관심층)를 그래프나 도넛 차트로 표현해줘. 하단에는 실제로 진행했던 협찬 상품 예시 이미지 3개를 나란히 배치해줘. 이미지는 실제 사무실에서 콘텐츠를 촬영하고 편집하는 자연스러운 느낌의 사진으로 가져와줘. 맨 아래에는 협업 문의 연락처와 버튼 형태의 문구를 넣어줘. 여백을 넉넉하게 두고 깔끔하고 전문적인 느낌으로, 컬러는 딥네이비와 민트로 통일해줘."],
  ["Wireframe · 신규 랜딩페이지 3안", "실제 디자인 전 구조를 검토하는 회색조 랜딩페이지 와이어프레임.", "찍봇 마케팅 회사의 신규 랜딩페이지 레이아웃을 뼈대만 있는 형태로 3가지 버전 만들어줘. 색상이나 실제 이미지는 넣지 말고, 회색 박스와 텍스트 자리표시(예. ‘제목 들어갈 자리’)만 사용해줘. 각 버전은 맨 위 큰 헤드라인과 버튼 하나의 히어로 영역, 서비스 소개 3단 영역, 협찬사 로고 나열 영역, 고객 후기 영역, 마지막 버튼이 있는 마무리 영역으로 구성해줘. 실제 디자인 작업 전에 구조가 괜찮은지 미리 확인하고 테스트하는 목적이야."],
  ["Animation · 7초 로고 인트로", "원본 로고를 변형하지 않는 7초 루프형 브랜드 인트로 애니메이션.", "첨부한 찍봇 마케팅 회사 로고 파일을 그대로 사용해서 7초 분량의 인트로 애니메이션을 만들어줘. 로고 모양 자체는 절대 새로 그리거나 변형하지 말고, 첨부된 이미지 그대로 움직임만 넣어줘. 0~1초. 딥네이비(#1A2332) 배경에서 중앙에 은은한 민트색(#00D9C0) 빛이 서서히 퍼지고 로고는 아직 보이지 않게. 1~2.5초. 로고가 중앙에 작은 크기로 페이드인되고 테두리에 은은한 민트 글로우를 넣어줘. 2.5~3.5초. 로고가 바운스하며 커졌다가 원래 크기로 안정되게. 3.5~5초. 로고 아래에 ‘AI가 여는 새로운 비즈니스’가 왼쪽에서 슬라이드인되고, 그 아래 작은 글씨 ‘찍봇 마케팅 회사’가 페이드인되게. 5~7초. 배경을 딥네이비에서 민트로 부드럽게 그라데이션 전환하고 로고와 텍스트가 살짝 위로 떠오르며 마무리해줘. 로고는 처음부터 끝까지 원본을 유지하고 크기·위치·빛 효과·배경색만 변화시켜줘. 시작과 끝 프레임이 자연스럽게 이어지도록 루프 가능하게 만들어줘."],
].map(([title, summary, body]) => ({ id: randomUUID(), user_id: LOCAL_USER, title: `Claude 디자인 · ${title}`, category: CATEGORY, summary, when_to_use: "Claude에서 해당 산출물 형식을 만들 때 사용하세요.", sections: JSON.stringify([{ title: "프롬프트", body }]), is_favorite: 0, created_at: now, updated_at: now }));

const db = new Database(resolve(root, "data/mymark.db"));
const find = db.prepare("SELECT id FROM prompts WHERE user_id = ? AND title = ? AND category = ?");
const insert = db.prepare("INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (@id, @user_id, @title, @category, @summary, @when_to_use, @sections, @is_favorite, @created_at, @updated_at)");
let localPrompts = 0;
for (const item of items) if (!find.get(LOCAL_USER, item.title, CATEGORY)) { insert.run(item); localPrompts += 1; }
db.close();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let prodPrompts = 0;
for (const item of items) { const { data, error } = await sb.from("prompts").select("id").eq("user_id", PROD_USER).eq("title", item.title).eq("category", CATEGORY).limit(1); if (error) throw error; if (data?.length) continue; const { id, user_id, ...row } = item; const { error: insertError } = await sb.from("prompts").insert({ id: randomUUID(), user_id: PROD_USER, ...row }); if (insertError) throw insertError; prodPrompts += 1; }
console.log({ localPrompts, prodPrompts });
