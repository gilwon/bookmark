// Claude Skills 마켓플레이스 4곳 가이드와 설치 명령을 Pages·Prompts에 저장한다
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
  "https://kimminwook.notion.site/Claude-Skills-4-3378c53193a7800eb385e0b1c52ac789";
const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const LOCAL_USER = "dev";
const PAGE_TITLE = "클로드 스킬(Claude Skills) 마켓플레이스 4곳 & 설치 가이드";
const CATEGORY = "Claude Skills · 마켓플레이스 4곳";
const now = new Date().toISOString();

const pageMarkdown = `# ${PAGE_TITLE}

> 클로드 스킬을 찾고 설치하는 방법을 한 곳에 정리했습니다.
> 초보자도 따라할 수 있도록 단계별로 설명합니다.

원본. [Notion](${SOURCE})

---

## 클로드 스킬이란?

클로드 스킬은 클로드의 능력을 확장해주는 **모듈형 확장 기능**입니다.

마케팅, 코딩, 문서 작성, 리서치 등 특정 분야에서 클로드가 더 잘 작동하도록 전문 지식과 워크플로를 제공합니다.

스킬은 \`SKILL.md\`라는 마크다운 파일로 구성되어 있고, 설치하면 클로드가 자동으로 인식하여 적절한 상황에서 활용합니다.

---

## 스킬을 찾을 수 있는 마켓플레이스 4곳

### 1. 클로드 공식 스킬 저장소

[github.com/anthropics/skills](https://github.com/anthropics/skills)

- 클로드를 만든 앤트로픽이 직접 관리하는 공식 저장소
- PDF, DOCX, XLSX, PPTX 문서 처리, 프론트엔드 디자인, 스킬 제작 가이드 등 핵심 스킬 제공
- 품질과 안정성이 보장된 가장 신뢰할 수 있는 소스
- Claude.ai 유료 플랜 사용자는 이 스킬들이 이미 내장되어 있음

### 2. Skills.sh

[skills.sh](https://skills.sh)

- 각 스킬의 상세 페이지와 설치 명령어를 확인할 수 있는 레퍼런스 허브
- 스킬별 설명, 구조, 사용법을 한눈에 파악 가능
- CLI 설치 명령어를 바로 복사해서 사용 가능
- 예시. \`skills.sh/anthropics/skills/frontend-design\`

### 3. SkillsMP

[skillsmp.com](https://skillsmp.com)

- 70만 개 이상의 스킬이 등록된 대규모 커뮤니티 마켓플레이스
- Claude Code뿐 아니라 Codex CLI, ChatGPT 등 다양한 AI 도구와 호환
- GitHub 공개 저장소에서 자동으로 스킬을 수집하고 품질을 필터링
- 최소 GitHub 스타 2개 이상인 저장소만 등록

### 4. SkillHub

[skillhub.club](https://skillhub.club)

- 7,000개 이상의 스킬을 AI가 자동 평가하는 마켓플레이스
- 실용성, 명확성, 자동화, 품질, 영향력 5가지 기준으로 S~C 등급 부여
- 브라우저에서 바로 스킬을 테스트할 수 있는 Playground 기능 제공
- 데스크톱 앱으로 여러 AI 도구에 원클릭 설치 가능

---

## 스킬 설치 방법

### 방법 1. Claude.ai에서 설치

1. Claude.ai에 로그인
2. **설정(Settings)** → **기능(Capabilities)** → **코드 실행(Code Execution)** 활성화
3. **사용자 지정(Customize)** → **Skills** 메뉴 이동
4. 앤트로픽 공식 스킬 켜기 또는 커스텀 스킬 업로드
5. 대화에서 바로 사용 시작

### 방법 2. Claude Code CLI에서 설치

공식 마켓플레이스에서 설치합니다.

\`\`\`text
# 플러그인 매니저 열기
/plugin

# 또는 직접 설치
/plugin install [플러그인이름]@[마켓플레이스이름]
\`\`\`

커뮤니티 마켓플레이스를 추가합니다.

\`\`\`text
# 마켓플레이스 추가
/plugin marketplace add anthropics/skills

# 설치 가능한 스킬 탐색
/plugin
# Discover 탭에서 스킬 목록 확인
\`\`\`

npx로 설치합니다.

\`\`\`text
npx skills add anthropics/skills --skill frontend-design
\`\`\`

### 방법 3. 수동 설치

1. GitHub에서 원하는 스킬의 저장소를 찾기
2. \`SKILL.md\` 파일이 포함된 스킬 폴더를 다운로드
3. 아래 경로에 복사
   - 개인용. \`~/.claude/skills/[스킬이름]/SKILL.md\`
   - 프로젝트용. \`[프로젝트폴더]/.claude/skills/[스킬이름]/SKILL.md\`
4. Claude Code를 재시작해 자동 인식 확인

---

## 설치 전 주의사항

- 공식 스킬을 우선 사용하고, 커뮤니티 스킬은 설명과 코드를 확인 후 설치
- 스킬이 외부 패키지를 설치하거나 네트워크에 접속하는 경우 주의
- 업무용으로 사용할 때는 조직의 보안 정책 확인
- 스킬이 작동하지 않으면 코드 실행(Code Execution) 기능이 켜져 있는지 확인

---

## 한눈에 보는 요약

| 마켓플레이스 | URL | 특징 |
| --- | --- | --- |
| 클로드 공식 | github.com/anthropics/skills | 앤트로픽 공식, 가장 안정적 |
| Skills.sh | skills.sh | 스킬별 상세 레퍼런스 |
| SkillsMP | skillsmp.com | 70만+ 대규모 커뮤니티 |
| SkillHub | skillhub.club | AI 평가 등급, Playground |

## 출처

- [Notion 원문](${SOURCE})
- 우주보스. @woojooboss_
- [우주보스닷컴](https://woojooboss.com)
`;

const prompt = {
  title: "Claude Skills 마켓플레이스 설치 명령 모음",
  category: CATEGORY,
  summary: "Claude Code에서 공식·커뮤니티 스킬을 탐색하고 설치하는 명령 모음입니다.",
  when_to_use: "Claude Skills 마켓플레이스를 추가하거나 스킬을 설치할 때 사용하세요.",
  sections: [
    {
      title: "공식 마켓플레이스",
      body: `/plugin

/plugin install [플러그인이름]@[마켓플레이스이름]`,
    },
    {
      title: "커뮤니티 마켓플레이스",
      body: `/plugin marketplace add anthropics/skills

/plugin
# Discover 탭에서 스킬 목록 확인`,
    },
    {
      title: "npx 설치",
      body: `npx skills add anthropics/skills --skill frontend-design`,
    },
    {
      title: "수동 설치 경로",
      body: `개인용: ~/.claude/skills/[스킬이름]/SKILL.md
프로젝트용: [프로젝트폴더]/.claude/skills/[스킬이름]/SKILL.md`,
    },
    {
      title: "원문",
      body: SOURCE,
    },
  ],
};

if (
  !["Skills.sh", "SkillsMP", "SkillHub", "anthropics/skills"].every((text) =>
    pageMarkdown.includes(text)
  ) ||
  prompt.sections.length !== 5
) {
  throw new Error("원문 Page 또는 설치 명령 Prompt 구성이 불완전합니다.");
}

const page = {
  title: PAGE_TITLE,
  content: JSON.stringify(markdownToTiptapDoc(pageMarkdown)),
};
const promptRow = {
  id: randomUUID(),
  user_id: LOCAL_USER,
  ...prompt,
  sections: JSON.stringify(prompt.sections),
  is_favorite: 0,
  created_at: now,
  updated_at: now,
};

const db = new Database(resolve(root, "data/mymark.db"));
const findPage = db.prepare(
  "SELECT id FROM custom_pages WHERE user_id = ? AND (title = ? OR content LIKE ?)"
);
const findPrompt = db.prepare(
  "SELECT id FROM prompts WHERE user_id = ? AND title = ? AND category = ?"
);
let localPages = 0;
let localPrompts = 0;

if (!findPage.get(LOCAL_USER, PAGE_TITLE, "%3378c53193a7800eb385e0b1c52ac789%")) {
  db.prepare(
    "INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(randomUUID(), LOCAL_USER, page.title, page.content, now, now);
  localPages = 1;
}
if (!findPrompt.get(LOCAL_USER, prompt.title, CATEGORY)) {
  db.prepare(
    "INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (@id, @user_id, @title, @category, @summary, @when_to_use, @sections, @is_favorite, @created_at, @updated_at)"
  ).run(promptRow);
  localPrompts = 1;
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

const { data: existingPrompts, error: promptFindError } = await sb
  .from("prompts")
  .select("id")
  .eq("user_id", PROD_USER)
  .eq("title", prompt.title)
  .eq("category", CATEGORY);
if (promptFindError) throw promptFindError;
if (!existingPrompts?.length) {
  const { error } = await sb.from("prompts").insert({
    ...promptRow,
    id: randomUUID(),
    user_id: PROD_USER,
  });
  if (error) throw error;
  prodPrompts = 1;
}

console.log({ localPages, localPrompts, prodPages, prodPrompts });
