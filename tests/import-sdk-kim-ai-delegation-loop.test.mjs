// 낭만빌더 김스듴 AI 위임 루프 가이드 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  EXPECTED_ATTACHMENTS,
  EXPECTED_CODES,
  EXPECTED_IMAGES,
  EXPECTED_TABLES,
  OG_IMAGE_BYTES,
  PAGE_TITLE,
  SOURCE_URL,
  isDuplicateRow,
  parseSdkKimHtml,
  stripTracking,
} from "../scripts/import-sdk-kim-ai-delegation-loop.mjs";

const OTHER_TITLE = "클로드 SNS 스킬 17개: 대행사처럼 말투부터 배우게 하기";
const OTHER_URL = "https://sdk-kim-builds.com/guides/claude-sns-agency-skills";
const REPOS_TITLE =
  "AI 에이전트 역량을 늘려주는 GitHub 레포 7개 (별점·라이선스 실측)";
const REPOS_URL = "https://sdk-kim-builds.com/guides/agent-github-repos-7";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-sdk-kim-ai-delegation-loop.mjs"
);

const FIXTURE = `<!doctype html>
<html lang="ko">
  <head>
    <title>AI 위임 루프: 에이전트 대신 매뉴얼으로 일 넘기기 | 낭만빌더 김스듴</title>
    <link rel="icon" href="/favicon.ico">
    <meta property="og:image" content="https://sdk-kim-builds.com/og/default.png">
  </head>
  <body>
    <header class="home-header">
      <a href="/challenge/?utm_source=header&amp;fbclid=IwAR111">30일 챌린지</a>
    </header>
    <article class="guide-detail">
      <a class="guide-detail__back" href="/guides">목록</a>
      <header class="guide-detail__hero">
        <p class="guide-detail-category">에이전트 워크플로</p>
        <h1>AI 위임 루프: 에이전트 대신 매뉴얼으로 일 넘기기</h1>
        <div class="guide-detail-meta">
          <time datetime="2026-09-18T00:00:00.000Z">2026. 9. 18.</time>
          <span>Claude</span>
        </div>
      </header>
      <details class="guide-toc">
        <summary>목차</summary>
        <a href="#첫-30분">첫 30분</a>
      </details>
      <div class="guide-detail-body">
        <h2>에이전트를 계속 만들지 말고 일 하나에 매뉴얼 하나를 만들어라</h2>
        <h2>레이어 1: 프로세스</h2>
        <p>주간 고객 업데이트는 폴더 하나로 남긴다.</p>
        <h2>첫 30분</h2>
        <pre><code>SKILL.md</code></pre>
        <p><a href="https://example.com/manual?utm_source=share&amp;fbclid=IwAR123">본문 링크</a></p>
      </div>
      <aside class="guide-mid-cta guide-card">
        <p>이 가이드, 내 업무에 30일 안에 적용해보고 싶다면</p>
        <p>이메일 알림 받기</p>
        <p>개인정보 수집·이용 동의</p>
      </aside>
      <section class="guide-inquiry-block">
        <h2>이 가이드, 우리 팀에 적용하려면?</h2>
        <p>개인정보 수집·이용 동의</p>
      </section>
      <nav class="guide-next">
        <a href="/guides/claude-code-jarvis-7-prompts/">나만의 자비스 만들기</a>
      </nav>
    </article>
    <footer class="home-footer">
      <a href="https://example.com/footer?utm_source=footer&amp;fbclid=IwAR999">푸터</a>
    </footer>
  </body>
</html>`;

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 낭만빌더 김스듴 AI 위임 루프 가이드를 Pages에만 저장한다"
  );
  assert.equal(source.includes("aside.guide-mid-cta"), true);
});

test("PAGE_TITLE과 SOURCE_URL 상수다", () => {
  assert.equal(
    SOURCE_URL,
    "https://sdk-kim-builds.com/guides/ai-delegation-loop-playbook"
  );
  assert.equal(SOURCE_URL.endsWith("/"), false);
  assert.equal(SOURCE_URL.includes("fbclid"), false);
  assert.equal(SOURCE_URL.includes("utm_source"), false);
  assert.equal(PAGE_TITLE, "AI 위임 루프: 에이전트 대신 매뉴얼으로 일 넘기기");
  assert.equal(PAGE_TITLE.includes("낭만빌더"), false);
  assert.equal(OG_IMAGE_BYTES, 3992);
  assert.equal(EXPECTED_IMAGES, 1);
  assert.equal(EXPECTED_ATTACHMENTS, 0);
  assert.equal(EXPECTED_TABLES, 0);
  assert.equal(EXPECTED_CODES, 5);
});

test("다른 낭만빌더 글과 제목·URL이 다르다", () => {
  assert.notEqual(PAGE_TITLE, OTHER_TITLE);
  assert.notEqual(SOURCE_URL, OTHER_URL);
  assert.notEqual(PAGE_TITLE, REPOS_TITLE);
  assert.notEqual(SOURCE_URL, REPOS_URL);
});

test("stripTracking은 utm·fbclid를 뺀다", () => {
  const dirty = `${SOURCE_URL}?utm_source=share&fbclid=IwAR123`;
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned, SOURCE_URL);
});

test("parseSdkKimHtml은 본문을 남기고 미드 CTA·도입 문의·다음 글을 뺀다", () => {
  const dirty = `${SOURCE_URL}/?utm_source=share&fbclid=IwAR123`;
  const parsed = parseSdkKimHtml(FIXTURE, dirty);
  assert.equal(parsed.title, PAGE_TITLE);
  assert.equal(parsed.markdown.startsWith(`# ${PAGE_TITLE}`), true);
  assert.equal(
    parsed.markdown.includes(`> 원문. [낭만빌더 김스듴](${SOURCE_URL})`),
    true
  );
  assert.equal(parsed.markdown.includes("에이전트 워크플로"), true);
  assert.equal(parsed.markdown.includes("2026. 9. 18."), true);
  assert.match(parsed.markdown, /\u200b2026\. 9\. 18\./);
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(
    resolve(root, "src/lib/markdown-to-tiptap.ts")
  );
  const stored = JSON.stringify(markdownToTiptapDoc(parsed.markdown));
  assert.equal(stored.includes("2026. 9. 18."), true);
  assert.equal(stored.includes("\u200b2026. 9. 18."), true);
  assert.equal(parsed.markdown.includes("에이전트를 계속 만들지 말고"), true);
  assert.equal(parsed.markdown.includes("레이어 1"), true);
  assert.equal(parsed.markdown.includes("주간 고객 업데이트"), true);
  assert.equal(parsed.markdown.includes("첫 30분"), true);
  assert.equal(parsed.markdown.includes("SKILL.md"), true);
  assert.equal(parsed.markdown.includes("https://example.com/manual"), true);
  assert.equal(parsed.markdown.includes("fbclid"), false);
  assert.equal(parsed.markdown.includes("utm_source"), false);
  assert.equal(parsed.markdown.includes("30일"), false);
  assert.equal(parsed.markdown.includes("이메일 알림"), false);
  assert.equal(parsed.markdown.includes("개인정보 수집"), false);
  assert.equal(parsed.markdown.includes("나만의 자비스"), false);
  assert.equal(parsed.markdown.includes("claude-code-jarvis"), false);
  assert.equal(parsed.markdown.includes("도입 문의"), false);
  assert.equal(parsed.markdown.includes("우리 팀에 적용하려면"), false);
  assert.equal(parsed.markdown.includes("목차"), false);
  assert.equal(parsed.markdown.includes("favicon"), false);
  assert.equal(parsed.markdown.includes("| 낭만빌더"), false);
});

test("isDuplicateRow는 제목 또는 원문 URL로 true다", () => {
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
      { title: "다른 글", content: `원문 ${SOURCE_URL}` },
      PAGE_TITLE,
      [SOURCE_URL]
    ),
    true
  );
  assert.equal(
    isDuplicateRow({ title: "다른 글", content: "없음" }, PAGE_TITLE, [SOURCE_URL]),
    false
  );
  assert.equal(
    isDuplicateRow(
      { title: OTHER_TITLE, source_url: OTHER_URL, content: OTHER_URL },
      PAGE_TITLE,
      [SOURCE_URL]
    ),
    false
  );
  assert.equal(
    isDuplicateRow(
      { title: REPOS_TITLE, source_url: REPOS_URL, content: REPOS_URL },
      PAGE_TITLE,
      [SOURCE_URL]
    ),
    false
  );
});

test("Prompts 저장 코드가 없다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes("from('prompts')"), false);
});
