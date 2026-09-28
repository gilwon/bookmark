// 낭만빌더 김스듴 클로덱스 루프 가이드 이관 헬퍼를 네트워크 없이 검증한다
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
} from "../scripts/import-sdk-kim-claudex-loop.mjs";

const OTHER_TITLE = "AI 위임 루프: 에이전트 대신 매뉴얼으로 일 넘기기";
const OTHER_URL =
  "https://sdk-kim-builds.com/guides/ai-delegation-loop-playbook";
const REPO_URL = "https://github.com/chaseai-yt/claudex-loop";
const README_URL =
  "https://github.com/chaseai-yt/claudex-loop/blob/main/README.md";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-sdk-kim-claudex-loop.mjs"
);

const FIXTURE = `<!doctype html>
<html lang="ko">
  <head>
    <title>클로덱스 루프: 짠 모델이 자기 계획을 검수하지 못하게 막기 | 낭만빌더 김스듴</title>
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
        <p class="guide-detail-category">AI 코딩</p>
        <h1>클로덱스 루프: 짠 모델이 자기 계획을 검수하지 못하게 막기</h1>
        <div class="guide-detail-meta">
          <time datetime="2026-09-25T00:00:00.000Z">2026. 9. 25.</time>
          <span>Claude Code</span>
        </div>
      </header>
      <details class="guide-toc">
        <summary>목차</summary>
        <a href="#네-단계">네 단계</a>
      </details>
      <div class="guide-detail-body">
        <h2>무엇이 달라지나</h2>
        <p>검수자는 계획을 짠 모델과 다른 회사 모델이다.</p>
        <h2>네 단계</h2>
        <pre><code>codex --version</code></pre>
        <p><a href="${REPO_URL}?utm_source=share&amp;fbclid=IwAR123">클로드 루프 저장소</a></p>
        <p><a href="${README_URL}">README</a></p>
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
        <a href="/guides/jev-browser-claude-code-codex-skill/">젭 브라우저 설치 가이드</a>
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
    "// 낭만빌더 김스듴 클로덱스 루프 가이드를 Pages에만 저장한다"
  );
  assert.equal(source.includes("aside.guide-mid-cta"), true);
  assert.equal(source.includes("nav.guide-next"), true);
  assert.equal(source.includes("details.guide-toc"), true);
  assert.equal(source.includes(OTHER_TITLE), false);
  assert.equal(source.includes(OTHER_URL), false);
  assert.equal(source.includes("에이전트 워크플로"), false);
  assert.equal(source.includes("2026. 9. 18."), false);
  assert.equal(source.includes("레이어 1"), false);
  assert.equal(source.includes("나만의 자비스"), false);
});

test("PAGE_TITLE과 SOURCE_URL 상수다", () => {
  assert.equal(
    SOURCE_URL,
    "https://sdk-kim-builds.com/guides/claudex-loop-cross-model-plan-review"
  );
  assert.equal(SOURCE_URL.endsWith("/"), false);
  assert.equal(SOURCE_URL.includes("fbclid"), false);
  assert.equal(SOURCE_URL.includes("utm_source"), false);
  assert.equal(
    PAGE_TITLE,
    "클로덱스 루프: 짠 모델이 자기 계획을 검수하지 못하게 막기"
  );
  assert.equal(PAGE_TITLE.includes("낭만빌더"), false);
  assert.equal(OG_IMAGE_BYTES, 3992);
  assert.equal(EXPECTED_IMAGES, 1);
  assert.equal(EXPECTED_ATTACHMENTS, 0);
  assert.equal(EXPECTED_TABLES, 2);
  assert.equal(EXPECTED_CODES, 5);
});

test("위임 루프 글과 제목·URL이 다르다", () => {
  assert.notEqual(PAGE_TITLE, OTHER_TITLE);
  assert.notEqual(SOURCE_URL, OTHER_URL);
});

test("stripTracking은 utm·fbclid를 뺀다", () => {
  const dirty = `${SOURCE_URL}?utm_source=share&fbclid=IwAR123`;
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned, SOURCE_URL);
});

test("parseSdkKimHtml은 본문·깃허브 링크를 남기고 미드 CTA·다음 글·목차를 뺀다", () => {
  const dirty = `${SOURCE_URL}/?utm_source=share&fbclid=IwAR123`;
  const parsed = parseSdkKimHtml(FIXTURE, dirty);
  assert.equal(parsed.title, PAGE_TITLE);
  assert.equal(parsed.markdown.startsWith(`# ${PAGE_TITLE}`), true);
  assert.equal(
    parsed.markdown.includes(`> 원문. [낭만빌더 김스듴](${SOURCE_URL})`),
    true
  );
  assert.equal(parsed.markdown.includes("AI 코딩"), true);
  assert.equal(parsed.markdown.includes("2026. 9. 25."), true);
  assert.match(parsed.markdown, /\u200b2026\. 9\. 25\./);
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(
    resolve(root, "src/lib/markdown-to-tiptap.ts")
  );
  const stored = JSON.stringify(markdownToTiptapDoc(parsed.markdown));
  assert.equal(stored.includes("2026. 9. 25."), true);
  assert.equal(stored.includes("\u200b2026. 9. 25."), true);
  assert.equal(parsed.markdown.includes("무엇이 달라지나"), true);
  assert.equal(parsed.markdown.includes("네 단계"), true);
  assert.equal(parsed.markdown.includes(REPO_URL), true);
  assert.equal(parsed.markdown.includes(README_URL), true);
  assert.equal(parsed.markdown.includes("fbclid"), false);
  assert.equal(parsed.markdown.includes("utm_source"), false);
  assert.equal(parsed.markdown.includes("30일"), false);
  assert.equal(parsed.markdown.includes("이메일 알림"), false);
  assert.equal(parsed.markdown.includes("개인정보 수집"), false);
  assert.equal(parsed.markdown.includes("젭 브라우저"), false);
  assert.equal(parsed.markdown.includes("jev-browser"), false);
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
});

test("Prompts 저장 코드가 없다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes("from('prompts')"), false);
});
