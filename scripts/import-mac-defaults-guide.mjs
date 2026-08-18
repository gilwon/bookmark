// Mac 터미널 기본 설정 가이드를 Pages와 Prompts에 중복 없이 저장한다
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localUser = "dev";
const productionUser = "f72e9a44-79d8-4061-a700-3ec50bb04a97";
const pageTitle = "Mac 기본 설정을 터미널로 빠르게 바꾸는 방법";
const category = "macOS · 터미널 설정";
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
const { normalizedNotionWeekTitle } = require(resolve(root, "src/lib/page-attachment-storage.ts"));

const commands = [
  {
    title: "키 반복 입력 여부 설정",
    body: "defaults write -g ApplePressAndHoldEnabled -bool false",
    note: "키를 길게 눌렀을 때 특수문자 선택 팝업 대신 같은 키가 연속으로 반복 입력됩니다. 로그아웃·로그인이 필요합니다.",
  },
  {
    title: "키 반복 속도",
    body: "defaults write -g KeyRepeat -int 1",
    note: "키를 누르고 있을 때 반복 입력 속도를 빠르게 합니다. 로그아웃·로그인이 필요합니다.",
  },
  {
    title: "자동 텍스트 보정 끄기",
    body: [
      "defaults write -g NSAutomaticSpellingCorrectionEnabled -bool false",
      "defaults write -g NSAutomaticCapitalizationEnabled -bool false",
      "defaults write -g NSAutomaticPeriodSubstitutionEnabled -bool false",
      "defaults write -g NSAutomaticQuoteSubstitutionEnabled -bool false",
      "defaults write -g NSAutomaticDashSubstitutionEnabled -bool false",
    ].join("\n"),
    note: "맞춤법 교정, 자동 대문자, 마침표, 스마트 따옴표, 대시 자동 변환을 끕니다.",
  },
  {
    title: "Dock 표시 지연 제거",
    body: "defaults write com.apple.dock autohide-delay -float 0 && killall Dock",
    note: "숨겨진 Dock에 마우스를 가져갔을 때 나타나기까지의 지연을 없앱니다.",
  },
  {
    title: "Dock 애니메이션 제거",
    body: "defaults write com.apple.dock autohide-time-modifier -float 0 && killall Dock",
    note: "Dock이 나타나고 사라지는 애니메이션 시간을 없앱니다.",
  },
  {
    title: "macOS 애니메이션 최소화",
    body: [
      "defaults write -g NSAutomaticWindowAnimationsEnabled -bool false",
      "defaults write -g NSScrollAnimationEnabled -bool false",
      "defaults write -g NSWindowResizeTime -float 0.001",
      "defaults write -g NSDocumentRevisionsWindowTransformAnimation -bool false",
      "defaults write -g NSToolbarFullScreenAnimationDuration -float 0",
      "defaults write -g NSBrowserColumnAnimationSpeedMultiplier -float 0",
      "defaults write -g NSScrollViewRubberbanding -bool false",
      "",
      "defaults write com.apple.finder DisableAllAnimations -bool true",
      "",
      "defaults write com.apple.dock launchanim -bool false",
      "defaults write com.apple.dock autohide-delay -float 0",
      "defaults write com.apple.dock autohide-time-modifier -float 0",
      "defaults write com.apple.dock expose-animation-duration -float 0",
      "",
      "killall Finder",
      "killall Dock",
    ].join("\n"),
    note: "macOS, Finder, Dock에서 지원되는 여러 애니메이션과 지연 효과를 최소화합니다.",
  },
  {
    title: "스크린샷 그림자 제거",
    body: "defaults write com.apple.screencapture disable-shadow -bool true",
    note: "창을 스크린샷으로 촬영할 때 주변 그림자가 포함되지 않도록 합니다.",
  },
  {
    title: "스크린샷 미리보기 끄기",
    body: "defaults write com.apple.screencapture show-thumbnail -bool false",
    note: "스크린샷 촬영 후 오른쪽 아래에 나타나는 미리보기 썸네일을 끕니다.",
  },
  {
    title: "스크린샷 저장 위치 변경",
    body: "defaults write com.apple.screencapture location -string \"/Users/kst/Desktop/screenshots\" && killall SystemUIServer",
    note: "스크린샷 저장 위치를 /Users/kst/Desktop/screenshots로 변경합니다.",
  },
  {
    title: "Finder 경로 및 상태 정보 표시",
    body: [
      "defaults write com.apple.finder _FXShowPosixPathInTitle -bool true",
      "defaults write com.apple.finder ShowPathbar -bool true",
      "defaults write com.apple.finder ShowStatusBar -bool true",
      "killall Finder",
    ].join("\n"),
    note: "Finder 창의 전체 경로, 경로 막대, 상태 막대를 표시합니다.",
  },
  {
    title: "Finder 검색 범위를 현재 폴더로",
    body: "defaults write com.apple.finder FXDefaultSearchScope -string \"SCcf\" && killall Finder",
    note: "Finder 검색의 기본 범위를 현재 폴더로 설정합니다.",
  },
  {
    title: "Finder에서 폴더 먼저 표시",
    body: "defaults write com.apple.finder _FXSortFoldersFirst -bool true && killall Finder",
    note: "Finder에서 정렬할 때 폴더를 파일보다 먼저 표시합니다.",
  },
  {
    title: "확장자 변경 경고 끄기",
    body: "defaults write com.apple.finder FXEnableExtensionChangeWarning -bool false && killall Finder",
    note: "파일 확장자를 변경할 때 나타나는 경고를 끕니다.",
  },
  {
    title: "Finder 종료 기능 활성화",
    body: "defaults write com.apple.finder QuitMenuItem -bool true && killall Finder",
    note: "Finder 메뉴에 Finder 종료 기능을 활성화합니다.",
  },
  {
    title: "데스크톱 아이콘 숨기기",
    body: "defaults write com.apple.finder CreateDesktop -bool false && killall Finder",
    note: "데스크톱 아이콘을 숨깁니다.",
  },
  {
    title: "데스크톱 아이콘 다시 표시하기",
    body: "defaults write com.apple.finder CreateDesktop -bool true && killall Finder",
    note: "숨긴 데스크톱 아이콘을 다시 표시합니다.",
  },
  {
    title: "시스템 잠자기 비활성화",
    body: "sudo pmset -a disablesleep 1",
    note: "Mac의 시스템 잠자기 기능을 비활성화합니다.",
  },
];

const pageMarkdown = `# ${pageTitle}

비싼 돈 주고 산 Mac, 기본 설정 그대로 쓰기엔 아깝습니다.

터미널 명령어를 활용해 키 입력, Dock, Finder, 스크린샷, 애니메이션 등 macOS의 불편한 기본 동작을 더 빠르고 편리하게 바꾸는 방법입니다. 몇 줄의 명령어만 입력해도 사용감이 꽤 달라집니다. MacBook, Mac mini 등 Mac을 더 효율적으로 쓰고 싶다면 하나씩 적용해보세요.

> 주의. 일부 명령어는 \`killall\`로 Finder, Dock, SystemUIServer를 강제로 재시작합니다. 실행 순간 해당 UI가 잠시 사라지거나 진행 중인 관련 작업이 중단될 수 있으며, 특히 Finder에서 파일을 복사·이동 중일 때는 \`killall Finder\`를 실행하지 마세요. 가능하면 관련 작업을 모두 마친 뒤 실행하는 것이 안전합니다.
>
> 만약 적용되지 않는다면 설정을 마친 후 한 번 로그아웃·로그인하는 방법이 될 수 있습니다.

${commands.map((item) => `## ${item.title}

\`\`\`bash
${item.body}
\`\`\`

${item.note}`).join("\n\n")}
`;

const pageContent = JSON.stringify(markdownToTiptapDoc(pageMarkdown));
if (!pageContent.includes("ApplePressAndHoldEnabled") || pageContent.includes("00:28") || pageContent.includes("01:20")) {
  throw new Error("본문 변환 검증 실패. 분·초 표시가 남았거나 명령어가 없습니다.");
}

const prompts = commands.map((item) => ({
  title: `${item.title}`,
  category,
  summary: item.note,
  when_to_use: `macOS에서 ${item.title}을 적용할 때 사용하세요.`,
  sections: JSON.stringify([
    { title: "명령어", body: item.body },
    { title: "설명", body: item.note },
    { title: "관련 Page", body: pageTitle },
  ]),
}));

function isSamePage(rows) {
  const normalized = normalizedNotionWeekTitle(pageTitle);
  return rows.some((row) => normalizedNotionWeekTitle(row.title) === normalized);
}

function promptBody(row) {
  try {
    const sections = typeof row.sections === "string" ? JSON.parse(row.sections) : row.sections;
    return sections.find((section) => section.title === "명령어")?.body ?? "";
  } catch {
    return "";
  }
}

function samePrompt(rows, prompt) {
  return rows.some((row) => (
    (row.title === prompt.title && row.category === prompt.category)
    || (prompt.body && promptBody(row).trim() === prompt.body.trim())
  ));
}

function importLocal() {
  const db = new Database(resolve(root, "data/mymark.db"));
  const result = { page: "skipped", promptsInserted: 0, promptsSkipped: 0 };
  const transaction = db.transaction(() => {
    const pages = db.prepare("SELECT id, title, content FROM custom_pages WHERE user_id = ?").all(localUser);
    if (!isSamePage(pages)) {
      db.prepare("INSERT INTO custom_pages (id, user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(randomUUID(), localUser, pageTitle, pageContent, now, now);
      result.page = "inserted";
    }
    const existing = db.prepare("SELECT title, category, sections FROM prompts WHERE user_id = ?").all(localUser);
    const insert = db.prepare("INSERT INTO prompts (id, user_id, title, category, summary, when_to_use, sections, is_favorite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)");
    for (const prompt of prompts) {
      if (samePrompt(existing, { ...prompt, body: promptBody(prompt) })) {
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
  const { data: pages, error: pageError } = await supabase
    .from("custom_pages")
    .select("id, title")
    .eq("user_id", productionUser);
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
    .select("title, category, sections")
    .eq("user_id", productionUser)
    .eq("category", category);
  if (promptError) throw promptError;
  const stored = existingPrompts ?? [];
  for (const prompt of prompts) {
    if (samePrompt(stored, { ...prompt, body: promptBody(prompt) })) {
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

if (process.argv.includes("--check")) {
  const db = new Database(resolve(root, "data/mymark.db"), { readonly: true });
  const pages = db.prepare("SELECT title FROM custom_pages WHERE user_id = ?").all(localUser);
  db.close();
  console.log(JSON.stringify({
    writes: 0,
    pageTitle,
    commands: commands.length,
    hasTimestamp: /\\d{2}:\\d{2}/.test(pageMarkdown),
    localPage: isSamePage(pages) ? "skip" : "insert",
  }, null, 2));
  process.exit(0);
}

const local = importLocal();
const production = await importProduction();
console.log(JSON.stringify({
  pageTitle,
  commands: commands.length,
  local,
  production,
}, null, 2));
