// every._ai 혼자 개발 스킬 4개 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  AGENT_BROWSER_URL,
  EXPECTED_ATTACHMENTS,
  EXPECTED_CODES,
  EXPECTED_IMAGES,
  EXPECTED_TABLES,
  FIND_SKILLS_URL,
  PAGE_TITLE,
  SKILL_CREATOR_URL,
  SKILLS_INSTALL_URL,
  SOURCE_URL,
  SUPERPOWERS_URL,
  SYSTEMATIC_DEBUGGING_URL,
  isDuplicateRow,
  parseEveryAiHtml,
  stripTracking,
} from "../scripts/import-every-ai-claude-solo-skills-4.mjs";

const OTHER_TITLE = "클로드 코드 플러그인 5개 설치 가이드";
const OTHER_URL = "https://every-ai-guides.vercel.app/posts/skill-pack-marketing";
const TRACKING = ["fb", "clid"].join("");
const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-every-ai-claude-solo-skills-4.mjs"
);
const ALLOWED = [
  SOURCE_URL,
  SKILLS_INSTALL_URL,
  FIND_SKILLS_URL,
  AGENT_BROWSER_URL,
  SYSTEMATIC_DEBUGGING_URL,
  SUPERPOWERS_URL,
  SKILL_CREATOR_URL,
];

const FIXTURE = `<!doctype html>
<html lang="ko">
  <head>
    <title>${PAGE_TITLE} — every._ai</title>
  </head>
  <body>
    <nav>
      <a href="https://youtube.com/@every._ai">유튜브</a>
      <a href="https://instagram.com/every._ai?utm_source=nav">인스타그램</a>
    </nav>
    <article class="post">
      <div class="head">
        <h1>${PAGE_TITLE} — every._ai</h1>
        <div class="sub"><span>읽는 데 6분</span><span>2026-09-10 공개</span></div>
      </div>
      <a class="bootcamp-post-banner" href="/class/bootcamp-oct.html?from=dm">부트캠프</a>
      <div class="challenge-post-banner">
        <span>AI 수익화 챌린지</span>
        <a href="/money-map?from=guide">자료집</a>
      </div>
      <a class="challenge-post-banner" href="/money-map?from=dm">챌린지 배너</a>
      <a class="kakao-post-cta" href="/kakao?from=guide">하단 카카오 배너</a>
      <img src="/img/class/claude-icon.png" alt="Claude">
      <a href="https://youtube.com/@every._ai?from=dm">유튜브 메뉴</a>
      <a href="https://instagram.com/every._ai">인스타 메뉴</a>
      <h2>Quick Start</h2>
      <h2><span class="n">STEP 1 · 설치</span>필요한 스킬을 고른다</h2>
      <div class="prompt">
        <button type="button">복사</button>
        <pre>curl http://localhost:3000/health</pre>
      </div>
      <pre>npx skills list</pre>
      <table>
        <tr><th>스킬</th><th>역할</th></tr>
        <tr><td>find-skills</td><td>찾기</td></tr>
      </table>
      <ul>
        <li><a href="${SKILLS_INSTALL_URL}">설치</a></li>
        <li><a href="${FIND_SKILLS_URL}?utm_source=share&amp;from=guide">find-skills</a></li>
        <li><a href="${AGENT_BROWSER_URL}">agent-browser</a></li>
        <li><a href="${SYSTEMATIC_DEBUGGING_URL}?${TRACKING}=x&amp;from=dm">디버깅</a></li>
        <li><a href="${SUPERPOWERS_URL}">superpowers</a></li>
        <li><a href="${SKILL_CREATOR_URL}?utm_medium=mail">skill-creator</a></li>
      </ul>
      <script>var marker = "from=dm";</script>
    </article>
    <footer>
      <a href="https://youtube.com/@every._ai?from=guide">유튜브</a>
    </footer>
  </body>
</html>`;

function countNodes(node, type) {
  let count = node?.type === type ? 1 : 0;
  for (const child of node?.content ?? []) count += countNodes(child, type);
  return count;
}

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// every._ai 혼자 개발하는 클로드 스킬 4개를 Pages에만 저장한다"
  );
  assert.equal(source.includes("article.post"), true);
  assert.equal(source.includes("a.bootcamp-post-banner"), true);
  assert.equal(source.includes(".challenge-post-banner"), true);
  assert.equal(source.includes("a.challenge-post-banner"), true);
  assert.equal(source.includes("a.kakao-post-cta"), true);
  assert.equal(source.includes("section.challenge-banner"), true);
  assert.equal(source.includes("img[src*='claude-icon']"), true);
  assert.equal(source.includes("a[href*='youtube.com']"), true);
  assert.equal(source.includes("a[href*='instagram.com/every']"), true);
  assert.equal(source.includes("h2 span.n"), true);
  assert.equal(source.includes("div.sub span + span"), true);
  assert.equal(source.includes('const LOCAL_USER = "dev"'), true);
  assert.equal(
    source.includes('const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97"'),
    true
  );
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes("from('prompts')"), false);
  assert.equal(source.includes(".update("), false);
  assert.equal(source.includes("page-attachment-storage"), false);
  assert.equal(/UPDATE\s+custom_pages/i.test(source), false);
  assert.equal(source.includes(OTHER_TITLE), false);
  assert.equal(source.includes(OTHER_URL), false);
  assert.equal(source.includes(TRACKING), false);
  const checkAt = source.indexOf("if (checkOnly)");
  const persistAt = source.indexOf("await persist(");
  assert.equal(checkAt > 0 && persistAt > checkAt, true);
});

test("PAGE_TITLE과 SOURCE_URL과 개수 상수다", () => {
  assert.equal(
    SOURCE_URL,
    "https://every-ai-guides.vercel.app/posts/claude-solo-skills-4"
  );
  assert.equal(SOURCE_URL.endsWith("/"), false);
  assert.equal(SOURCE_URL.includes(TRACKING), false);
  assert.equal(SOURCE_URL.includes("utm_source"), false);
  assert.equal(
    PAGE_TITLE,
    "혼자 개발할 때 무조건 챙길 클로드 필수 스킬 4개 설치 가이드"
  );
  assert.equal(PAGE_TITLE.includes("every._ai"), false);
  assert.equal(PAGE_TITLE.includes("—"), false);
  assert.equal(EXPECTED_IMAGES, 0);
  assert.equal(EXPECTED_ATTACHMENTS, 0);
  assert.equal(EXPECTED_TABLES, 1);
  assert.equal(EXPECTED_CODES, 15);
  assert.equal(
    SKILLS_INSTALL_URL,
    "https://github.com/vercel-labs/skills#install-a-skill"
  );
  assert.equal(
    FIND_SKILLS_URL,
    "https://github.com/vercel-labs/skills/tree/main/skills/find-skills"
  );
  assert.equal(
    AGENT_BROWSER_URL,
    "https://github.com/vercel-labs/agent-browser#installation"
  );
  assert.equal(
    SYSTEMATIC_DEBUGGING_URL,
    "https://github.com/obra/superpowers/tree/main/skills/systematic-debugging"
  );
  assert.equal(
    SUPERPOWERS_URL,
    "https://github.com/obra/superpowers#installation"
  );
  assert.equal(
    SKILL_CREATOR_URL,
    "https://github.com/anthropics/skills/tree/main/skills/skill-creator"
  );
});

test("다른 글 제목과 URL이면 중복이 아니다", () => {
  assert.notEqual(PAGE_TITLE, OTHER_TITLE);
  assert.notEqual(SOURCE_URL, OTHER_URL);
  assert.equal(
    isDuplicateRow(
      { title: OTHER_TITLE, source_url: OTHER_URL, content: OTHER_URL },
      PAGE_TITLE,
      [SOURCE_URL]
    ),
    false
  );
});

test("isDuplicateRow는 제목 또는 source_url이 정확히 같을 때만 true다", () => {
  assert.equal(isDuplicateRow(null, PAGE_TITLE, [SOURCE_URL]), false);
  assert.equal(
    isDuplicateRow({ title: PAGE_TITLE, content: "x" }, PAGE_TITLE, [SOURCE_URL]),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", source_url: SOURCE_URL, content: "없음" },
      PAGE_TITLE,
      [SOURCE_URL]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", source_url: "https://example.com", content: SOURCE_URL },
      PAGE_TITLE,
      [SOURCE_URL]
    ),
    false
  );
  assert.equal(
    isDuplicateRow(
      { title: `${PAGE_TITLE} 외`, source_url: `${SOURCE_URL}/`, content: "없음" },
      PAGE_TITLE,
      [SOURCE_URL]
    ),
    false
  );
});

test("stripTracking은 utm, 추적 키, from=dm, from=guide를 빼고 data URL은 둔다", () => {
  const dataUrl = "data:image/png;base64,abc";
  const dirty = `${SOURCE_URL}?utm_campaign=a&${TRACKING}=x&from=guide`;
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes(TRACKING), false);
  assert.equal(cleaned.includes("utm_campaign"), false);
  assert.equal(cleaned.includes("from=guide"), false);
  assert.equal(cleaned, SOURCE_URL);
  assert.equal(stripTracking(`${FIND_SKILLS_URL}?from=dm`), FIND_SKILLS_URL);
  assert.equal(stripTracking(dataUrl), dataUrl);
  assert.equal(
    stripTracking("http://localhost:3000/health"),
    "http://localhost:3000/health"
  );
});

test("parseEveryAiHtml은 하단 배너를 빼고 스킬 링크와 표를 남긴다", () => {
  const dirty = `${SOURCE_URL}/?utm_source=share&${TRACKING}=x&from=dm&from=guide`;
  const parsed = parseEveryAiHtml(FIXTURE, dirty);
  assert.equal(parsed.title, PAGE_TITLE);
  assert.equal(parsed.markdown.startsWith(`# ${PAGE_TITLE}`), true);
  assert.equal(
    parsed.markdown.includes(`> 원문. [every._ai](${SOURCE_URL})`),
    true
  );
  assert.equal(parsed.markdown.includes("— every._ai"), false);
  assert.equal(parsed.markdown.includes("Quick Start"), true);
  assert.equal(parsed.markdown.includes("2026-09-10"), true);
  assert.equal(parsed.markdown.includes("6분 2026-09-10"), true);
  assert.equal(parsed.markdown.includes("분2026"), false);
  assert.equal(parsed.markdown.includes("STEP 1 · 설치 필요한"), true);
  assert.equal(parsed.markdown.includes("설치필요한"), false);
  assert.equal(parsed.markdown.includes("npx skills list"), true);
  assert.match(parsed.markdown, /```\ncurl http:\/\/localhost:3000\/health/);
  assert.equal(parsed.markdown.includes("https://localhost"), false);
  assert.equal(parsed.markdown.includes("| 스킬 | 역할 |"), true);
  assert.equal(parsed.markdown.includes("| find-skills | 찾기 |"), true);
  const links = [
    ...parsed.markdown.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g),
  ].map((match) => match[1]);
  assert.deepEqual([...new Set(links)].sort(), [...ALLOWED].sort());
  assert.equal(parsed.markdown.includes(TRACKING), false);
  assert.equal(parsed.markdown.includes("utm_source"), false);
  assert.equal(parsed.markdown.includes("utm_medium"), false);
  assert.equal(parsed.markdown.includes("from=dm"), false);
  assert.equal(parsed.markdown.includes("from=guide"), false);
  assert.equal(parsed.markdown.includes("AI 수익화 챌린지"), false);
  assert.equal(parsed.markdown.includes("youtube.com"), false);
  assert.equal(parsed.markdown.includes("instagram.com/every"), false);
  assert.equal(parsed.markdown.includes("claude-icon"), false);
  assert.equal(parsed.markdown.includes("하단 카카오 배너"), false);
  assert.equal(parsed.markdown.includes("복사"), false);
  assert.equal(parsed.markdown.includes("money-map"), false);
  assert.equal(parsed.markdown.includes("/kakao"), false);

  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  tsx.register({ tsconfig: resolve(repoRoot, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(
    resolve(repoRoot, "src/lib/markdown-to-tiptap.ts")
  );
  const doc = markdownToTiptapDoc(parsed.markdown);
  assert.equal(countNodes(doc, "codeBlock"), 2);
  assert.equal(countNodes(doc, "table"), 1);
  assert.equal(countNodes(doc, "image"), 0);
});
