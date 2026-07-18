// 브랜드와 로고 설계 프롬프트 8종을 개발·운영 라이브러리에 저장한다
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
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2]
      .trim()
      .replace(/^(["'])|(["'])$/g, "");
  }
}

const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const LOCAL_USER = "dev";
const CATEGORY = "브랜드 · 로고 디자인";
const now = new Date().toISOString();
const prompts = [
  ["브랜드 아이덴티티 설계", "브랜드의 성격·포지셔닝·언어·로고 방향을 한 번에 설계합니다.", "새 브랜드의 핵심 정체성과 디자인 기준을 잡을 때 사용하세요.", `당신은 시니어 브랜드 전략가입니다.

[브랜드명]의 브랜드 아이덴티티를 설계해주세요.

정보.
- 산업. [산업]
- 타깃. [타깃 고객]
- 상품/서비스. [상품/서비스]
- 원하는 느낌. [프리미엄/친근함/미니멀/대담함 등]

다음 항목을 작성해주세요.
- 브랜드 성격 5가지.
- 말투.
- 미션.
- 포지셔닝.
- 태그라인 3개.
- 피해야 할 비주얼.
- 로고가 전달해야 할 메시지.
- 연상 단어 5개.
- 로고 방향성.`],
  ["로고 콘셉트 10개 만들기", "브랜드 정보에 맞춘 로고 콘셉트 10개를 비교 가능한 형식으로 제안합니다.", "로고 디자인 탐색 초기에 여러 방향을 빠르게 비교할 때 사용하세요.", `당신은 전문 로고 디자이너입니다.

[브랜드명]을 위한 로고 콘셉트 10개를 제안해주세요.

정보.
- 산업. [산업]
- 타깃. [타깃]
- 성격. [모던/럭셔리/재미있는/대담한 등]
- 핵심 메시지. [메시지]
- 선호 스타일. [워드마크/모노그램/아이콘/엠블럼/추상형]
- 색상. [선호 색상]

각 콘셉트마다 이름, 심볼 아이디어, 폰트 스타일, 색상, 장점, 추천 사용처를 설명해주세요.`],
  ["미니멀 럭셔리 로고 방향", "고급스러운 미니멀 로고 7가지 방향과 이미지 생성 프롬프트를 만듭니다.", "프리미엄 브랜드의 로고 비주얼을 구체화할 때 사용하세요.", `당신은 럭셔리 브랜드 디자이너입니다.

[브랜드명]을 위한 미니멀하고 고급스러운 로고 방향 7가지를 제안해주세요.

정보.
- 산업. [산업]
- 타깃. [타깃]
- 분위기. [우아함/독점적/타임리스/모던]
- 참고 브랜드. [브랜드명]

각 방향마다 로고 스타일, 심볼 또는 모노그램 아이디어, 폰트, 컬러, 레이아웃, 고급스러워 보이는 이유, AI 이미지 프롬프트를 포함해주세요.`],
  ["전체 비주얼 방향성 설계", "로고부터 SNS·웹·패키지까지 일관된 브랜드 비주얼 시스템을 설계합니다.", "브랜드 전반의 디자인 가이드 초안이 필요할 때 사용하세요.", `당신은 크리에이티브 디렉터입니다.

[브랜드명]의 전체 비주얼 방향성을 설계해주세요.

정보.
- 산업. [산업]
- 타깃. [타깃]
- 브랜드 가치. [가치]
- 원하는 느낌. [느낌]
- 상품/서비스. [상품/서비스]

로고 스타일, 컬러 팔레트 HEX 코드, 폰트, 아이콘, 사진 스타일, SNS 스타일, 웹사이트 스타일, 패키지 방향, 디자인 Do 5개, Don't 5개를 정리해주세요.`],
  ["컬러 팔레트와 폰트 추천", "브랜드 성격에 맞는 컬러 팔레트와 타이포그래피 조합을 추천합니다.", "로고·웹·패키지에 쓸 색상과 폰트 기준을 정할 때 사용하세요.", `당신은 브랜드 디자이너입니다.

[브랜드명]에 어울리는 컬러와 폰트를 추천해주세요.

정보.
- 산업. [산업]
- 타깃. [타깃]
- 브랜드 성격. [성격]
- 로고 스타일. [미니멀/럭셔리/대담함/재미있는 등]

컬러 팔레트 3가지와 HEX 코드, 각 색의 의미, 최종 추천 팔레트, 로고용 폰트, 제목용 폰트, 본문용 폰트, 좋은 조합과 피해야 할 조합을 알려주세요.`],
  ["모노그램 로고 만들기", "브랜드 이니셜을 활용한 모노그램 로고 콘셉트 10개를 제안합니다.", "앱 아이콘·패키지·SNS에 쓸 이니셜 로고를 탐색할 때 사용하세요.", `당신은 모노그램 로고 전문가입니다.

[브랜드명]의 이니셜 [이니셜]을 활용해 모노그램 로고 콘셉트 10개를 제안해주세요.

정보.
- 산업. [산업]
- 분위기. [럭셔리/모던/미래적/대담함 등]
- 타깃. [타깃]
- 사용처. [웹사이트/SNS/패키지/앱 아이콘]

각 콘셉트마다 글자 결합 방식, 형태, 폰트, 의미, 색상, 전체 느낌, AI 이미지 프롬프트를 포함해주세요.`],
  ["로고 아이디어 비평", "로고 아이디어의 사용성·독창성·타깃 적합성을 엄격하게 평가합니다.", "시안 제작 전 로고 아이디어의 약점과 개선안을 검토할 때 사용하세요.", `당신은 엄격한 시니어 로고 디자이너입니다.

아래 로고 아이디어를 평가해주세요.

로고 아이디어.
[로고 설명]

브랜드 정보.
- 브랜드명. [브랜드명]
- 산업. [산업]
- 타깃. [타깃]
- 성격. [성격]

기억성, 독창성, 타깃 적합성, 흑백 사용성, 작은 크기 사용성, 전문성, 제거할 요소, 개선할 점을 분석하고 더 나은 대안 3가지를 제안해주세요.`],
  ["AI 로고 이미지 프롬프트 만들기", "이미지 생성 도구에 바로 넣을 브랜드 로고 프롬프트 10개를 만듭니다.", "AI로 다양한 로고 시각 시안을 생성할 때 사용하세요.", `당신은 AI 로고 프롬프트 전문가입니다.

[브랜드명] 로고 생성을 위한 이미지 프롬프트 10개를 만들어주세요.

정보.
- 산업. [산업]
- 타깃. [타깃]
- 스타일. [미니멀/럭셔리/대담함/재미있는/미래적]
- 심볼 아이디어. [선택]
- 색상. [선호 색상]

각 프롬프트에는 로고 타입, 심볼, 스타일, 타이포그래피, 색상, 배경, 피해야 할 요소를 포함해주세요.`],
];

const rows = prompts.map(([title, summary, when_to_use, body]) => ({ id: randomUUID(), user_id: LOCAL_USER, title, category: CATEGORY, summary, when_to_use, sections: JSON.stringify([{ title: "프롬프트", body }]), is_favorite: 0, created_at: now, updated_at: now }));
const db = new Database(resolve(root, "data/mymark.db"));
const insert = db.prepare("INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (@id, @user_id, @title, @category, @summary, @when_to_use, @sections, @is_favorite, @created_at, @updated_at)");
const find = db.prepare("SELECT id FROM prompts WHERE user_id = ? AND title = ? AND category = ?");
let localInserted = 0;
for (const row of rows) if (!find.get(LOCAL_USER, row.title, CATEGORY)) { insert.run(row); localInserted++; }
db.close();

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let prodInserted = 0;
for (const row of rows) {
  const { data, error } = await sb.from("prompts").select("id").eq("user_id", PROD_USER).eq("title", row.title).eq("category", CATEGORY);
  if (error) throw error;
  if (!data?.length) { const { error: insertError } = await sb.from("prompts").insert({ ...row, id: randomUUID(), user_id: PROD_USER }); if (insertError) throw insertError; prodInserted++; }
}
console.log({ localInserted, prodInserted, total: rows.length });
