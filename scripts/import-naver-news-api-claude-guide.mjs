// 네이버 뉴스 API와 Claude 자동 브리핑 가이드를 Pages·Prompts에 저장한다
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

const { markdownToTiptapDoc } = await import(
  resolve(root, "src/lib/markdown-to-tiptap.ts")
);

const SOURCE =
  "https://app.notion.com/p/API-39ffd99f0e5f81e9aed6c1b849013242";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const LOCAL_USER = "dev";
const PAGE_TITLE = "네이버 뉴스 API × 클로드 — 매일 아침 자동 브리핑 세팅 가이드";
const CATEGORY = "Claude · 네이버 뉴스 브리핑";
const now = new Date().toISOString();

const pageMarkdown = `# ${PAGE_TITLE}

> 하루 25,000건, 한 달 77만 5천 건 — 네이버가 검색 API에 무료로 열어둔 한도입니다.
>
> 이 창구를 클로드에 쥐여주면, 원하는 키워드 뉴스가 매일 아침 노션에 요약 브리핑으로 쌓입니다.
>
> 코드는 몰라도 됩니다. 호출 코드는 클로드가 짭니다.

원문 기준. 2026-07-16
원본. [Notion](${SOURCE})
공식 문서. [뉴스 검색 API](https://api.ncloud-docs.com/docs/naver-api-hub-search-news)

---

## 한눈에 보기

| 단계 | 하는 일 | 필요한 것 |
| --- | --- | --- |
| 1. 열쇠 발급 | 네이버 클라우드 API HUB에서 검색 API 신청 | 네이버 계정, 5분 |
| 2. 첫 실행 | 클로드에 열쇠 주고 뉴스 모으기 테스트 | 아래 프롬프트 복붙 |
| 3. 예약 걸기 | 매일 아침 자동 실행으로 승격 | 코워크 예약 작업 |
| 4. 노션 적재 | 날짜별 요약 브리핑으로 정리 | 노션 연결 |

첫 세팅에 10분 정도가 들지만, 다음 날부터는 아침 서칭을 자동화할 수 있습니다.

---

## 1. 열쇠 발급 — 네이버 클라우드 API HUB

검색 API는 네이버 클라우드의 API HUB에서 제공됩니다. 신청하면 아이디(Client ID)와 비밀키(Client Secret) 두 줄이 나오고, 이 두 줄이 뉴스 창구를 여는 열쇠입니다.

[네이버 API HUB에서 검색 API 신청하기](https://www.ncloud.com/product/applicationService/naverApiHub)

### 발급 순서

1. 위 링크에서 신청하기를 누르고 네이버 클라우드 계정으로 로그인합니다.
2. 검색 API를 선택해 이용 신청을 마칩니다. 무료 한도는 월 775,000건, 일 최대 25,000건입니다.
3. 발급된 아이디와 비밀키 두 줄을 복사해 둡니다.

> Client ID와 Client Secret은 비밀번호처럼 다루고 공개 글이나 공유 문서에 올리지 않습니다.

---

## 2. 첫 실행 — 클로드에 열쇠 주고 시키기

발급받은 두 줄을 이용해 이렇게 요청합니다. 호출 코드는 클로드가 작성하고, 기사 제목과 링크를 정리합니다.

\`\`\`text
네이버 검색 API 열쇠야.
Client ID: [여기 붙여넣기]
Client Secret: [여기 붙여넣기]
이 키로 '[이 키워드]' 최신 뉴스 10건을 모아서 제목·언론사·링크로 정리해줘.
\`\`\`

키워드는 브랜드명, 경쟁사, 관심 산업, 좋아하는 주제 등으로 바꿔 쓸 수 있습니다.

---

## 3. 예약 걸기 — 매일 아침 자동으로

테스트가 되면 코워크의 예약 작업으로 매일·평일·매주 주기로 실행할 수 있습니다.

[예약 작업 공식 도움말](https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork)

\`\`\`text
방금 그 뉴스 수집을 예약 작업으로 만들어줘.
매일 아침 8시, 키워드는 [내 키워드].
결과는 노션 '데일리 뉴스' 페이지에 날짜별로 쌓아줘.
\`\`\`

### 만드는 방법 A — 말로 시키기

위 프롬프트처럼 채팅에서 부탁하면 클로드가 예약 설정을 물어가며 만듭니다. 공식 메뉴 기준으로는 Scheduled → New task → Create with Claude 순서입니다.

### 만드는 방법 B — 직접 설정

Scheduled → New task → Set up manually에서 작업명, 프롬프트, 실행 주기를 직접 입력합니다. 주기는 매시간, 매일, 매주, 평일 중 선택합니다.

---

## 4. 노션 적재 — 목록 말고 브리핑으로

기사 목록에 정리 규칙을 더하면 요약 브리핑까지 만들 수 있습니다. 클로드 노션 커넥터를 사용하면 날짜별 아카이브로 쌓을 수 있습니다.

[클로드 노션 커넥터](https://claude.com/connectors/notion)

\`\`\`text
정리 규칙 추가해줘.
겹치는 기사는 하나로 묶고, 기사마다 세 줄 요약을 붙여줘.
중요한 순서대로 정렬하고, 맨 위에 '오늘의 한 줄 총평'을 달아줘.
\`\`\`

키워드를 바꾸면 경쟁사 동향 감시, 브랜드 언급 모니터링, 투자 종목 뉴스 등으로 같은 틀을 재사용할 수 있습니다.

---

## 5. 자주 막히는 부분

### 예약 작업 메뉴가 안 보여요

원문 작성 시점 기준 예약 작업은 유료 플랜 기능이고 Max 플랜부터 순차 출시 중입니다. 아직 메뉴가 없다면 같은 프롬프트를 수동으로 실행할 수 있습니다.

### 한도를 넘을까 걱정돼요

아침에 한 번 모으는 구조는 일 25,000건 한도에서 여유가 있습니다.

### 열쇠는 어디에 보관하죠?

공개 글, 메신저 단체방, 공유 문서에 올리지 말고 비밀번호 관리 도구 등에 별도 보관합니다. 유출이 의심되면 API HUB에서 재발급합니다.

---

## 출처

- [Notion 원문](${SOURCE})
- 프롬왓. [@prompt_what](https://www.instagram.com/prompt_what/)
`;

const prompts = [
  {
    title: "네이버 뉴스 API 첫 수집",
    summary: "지정한 키워드의 최신 뉴스 10건을 제목·언론사·링크로 정리합니다.",
    when_to_use: "네이버 검색 API 발급 후 뉴스 수집을 처음 테스트할 때 사용하세요.",
    sections: [
      {
        title: "보안",
        body: "Client Secret은 비밀번호입니다. 공개 채팅·공유 문서에 실제 값을 남기지 말고, 신뢰할 수 있는 실행 환경의 비밀 변수로 전달하세요.",
      },
      {
        title: "프롬프트",
        body: `네이버 검색 API 열쇠야.
Client ID: [여기 붙여넣기]
Client Secret: [여기 붙여넣기]
이 키로 '[이 키워드]' 최신 뉴스 10건을 모아서 제목·언론사·링크로 정리해줘.`,
      },
      { title: "원문", body: SOURCE },
    ],
  },
  {
    title: "네이버 뉴스 매일 아침 예약",
    summary: "뉴스 수집 작업을 매일 아침 실행하고 노션 페이지에 날짜별로 저장합니다.",
    when_to_use: "첫 뉴스 수집 테스트가 성공한 뒤 반복 작업으로 전환할 때 사용하세요.",
    sections: [
      {
        title: "프롬프트",
        body: `방금 그 뉴스 수집을 예약 작업으로 만들어줘.
매일 아침 8시, 키워드는 [내 키워드].
결과는 노션 '데일리 뉴스' 페이지에 날짜별로 쌓아줘.`,
      },
      { title: "원문", body: SOURCE },
    ],
  },
  {
    title: "네이버 뉴스 브리핑 정리 규칙",
    summary: "중복 기사를 묶고 기사별 요약과 오늘의 한 줄 총평을 추가합니다.",
    when_to_use: "단순 기사 목록을 읽기 쉬운 데일리 브리핑으로 바꿀 때 사용하세요.",
    sections: [
      {
        title: "프롬프트",
        body: `정리 규칙 추가해줘.
겹치는 기사는 하나로 묶고, 기사마다 세 줄 요약을 붙여줘.
중요한 순서대로 정렬하고, 맨 위에 '오늘의 한 줄 총평'을 달아줘.`,
      },
      { title: "원문", body: SOURCE },
    ],
  },
];

if (
  prompts.length !== 3 ||
  !["Client Secret", "예약 작업", "오늘의 한 줄 총평"].every((text) =>
    pageMarkdown.includes(text)
  )
) {
  throw new Error("원문 Page 또는 Prompt 구성이 불완전합니다.");
}

const page = {
  title: PAGE_TITLE,
  content: JSON.stringify(markdownToTiptapDoc(pageMarkdown)),
};
const promptRows = prompts.map((prompt) => ({
  id: randomUUID(),
  user_id: LOCAL_USER,
  ...prompt,
  category: CATEGORY,
  sections: JSON.stringify(prompt.sections),
  is_favorite: 0,
  created_at: now,
  updated_at: now,
}));

const db = new Database(resolve(root, "data/mymark.db"));
const findPage = db.prepare(
  "SELECT id FROM custom_pages WHERE user_id = ? AND (title = ? OR content LIKE ?)"
);
const findPrompt = db.prepare(
  "SELECT id FROM prompts WHERE user_id = ? AND title = ? AND category = ?"
);
const insertPrompt = db.prepare(
  "INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (@id, @user_id, @title, @category, @summary, @when_to_use, @sections, @is_favorite, @created_at, @updated_at)"
);
let localPages = 0;
let localPrompts = 0;

if (!findPage.get(LOCAL_USER, PAGE_TITLE, "%39ffd99f0e5f81e9aed6c1b849013242%")) {
  db.prepare(
    "INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(randomUUID(), LOCAL_USER, page.title, page.content, now, now);
  localPages = 1;
}
for (const prompt of promptRows) {
  if (findPrompt.get(LOCAL_USER, prompt.title, CATEGORY)) continue;
  insertPrompt.run(prompt);
  localPrompts += 1;
}
db.close();

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
let prodPages = 0;
let prodPrompts = 0;

const { data: existingPages, error: pageFindError } = await sb
  .from("custom_pages")
  .select("id")
  .eq("user_id", PROD_USER)
  .eq("title", PAGE_TITLE);
if (pageFindError) throw pageFindError;
if (!existingPages?.length) {
  const { error } = await sb.from("custom_pages").insert({
    id: randomUUID(),
    user_id: PROD_USER,
    ...page,
    created_at: now,
    updated_at: now,
  });
  if (error) throw error;
  prodPages = 1;
}

for (const prompt of promptRows) {
  const { data, error } = await sb
    .from("prompts")
    .select("id")
    .eq("user_id", PROD_USER)
    .eq("title", prompt.title)
    .eq("category", CATEGORY);
  if (error) throw error;
  if (data?.length) continue;
  const { error: insertError } = await sb.from("prompts").insert({
    ...prompt,
    id: randomUUID(),
    user_id: PROD_USER,
  });
  if (insertError) throw insertError;
  prodPrompts += 1;
}

console.log({ localPages, localPrompts, prodPages, prodPrompts });
