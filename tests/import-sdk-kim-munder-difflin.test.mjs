// 낭만빌더 김스듴 먼더 디플린 AI 사무실 가이드 이관 헬퍼를 네트워크 없이 검증한다
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
} from "../scripts/import-sdk-kim-munder-difflin.mjs";

const OTHER_TITLE = "클로덱스 루프: 짠 모델이 자기 계획을 검수하지 못하게 막기";
const OTHER_URL =
  "https://sdk-kim-builds.com/guides/claudex-loop-cross-model-plan-review";
const GITHUB_URL = "https://github.com/chaitanyagiri/munder-difflin";
const HARNESS_URL = "https://harnessmd.com/download";
const HIRES_URL = "https://munderdiffl.in/hires/";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-sdk-kim-munder-difflin.mjs"
);

const FIXTURE = `<!doctype html>
<html lang="ko">
  <head>
    <title>${PAGE_TITLE} | 낭만빌더 김스듴</title>
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
        <h1>${PAGE_TITLE}</h1>
        <div class="guide-detail-meta">
          <time datetime="2026-09-29T00:00:00.000Z">2026. 9. 29.</time>
          <span>Munder Difflin</span>
        </div>
      </header>
      <details class="guide-mail">
        <summary>지금 다 못 읽겠다면</summary>
        <p>개인정보 수집·이용 동의</p>
        <p>발송 후 30일</p>
      </details>
      <details class="guide-toc">
        <summary>목차</summary>
        <a href="#어떻게-돌아가나">어떻게 돌아가나</a>
      </details>
      <div class="guide-detail-body">
        <h2>어떻게 돌아가나</h2>
        <table>
          <tr><th>역할</th><th>하는 일</th></tr>
          <tr><td>직원</td><td>사무실</td></tr>
        </table>
        <pre><code>munder --version</code></pre>
        <p><a href="${GITHUB_URL}?utm_source=share&amp;fbclid=IwAR123">먼더 디플린 저장소</a></p>
        <p><a href="${HARNESS_URL}">하네스 다운로드</a></p>
        <p><a href="${HIRES_URL}">채용 페이지</a></p>
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
        <a href="/guides/ai-delegation-loop-playbook/">AI 위임 루프: 에이전트 대신 매뉴얼으로 일 넘기기</a>
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
    "// 낭만빌더 김스듴 먼더 디플린 AI 사무실 가이드를 Pages에만 저장한다"
  );
  assert.equal(source.includes("aside.guide-mid-cta"), true);
  assert.equal(source.includes("nav.guide-next"), true);
  assert.equal(source.includes("details.guide-toc"), true);
  assert.equal(source.includes("details.guide-mail"), true);
  assert.equal(source.includes(OTHER_TITLE), false);
  assert.equal(source.includes(OTHER_URL), false);
  assert.equal(source.includes("AI 코딩"), false);
  assert.equal(source.includes("2026. 9. 25."), false);
});

test("PAGE_TITLE과 SOURCE_URL 상수다", () => {
  assert.equal(
    SOURCE_URL,
    "https://sdk-kim-builds.com/guides/munder-difflin-ai-employee-office"
  );
  assert.equal(SOURCE_URL.endsWith("/"), false);
  assert.equal(SOURCE_URL.includes("fbclid"), false);
  assert.equal(SOURCE_URL.includes("utm_source"), false);
  assert.equal(
    PAGE_TITLE,
    "나를 위해 쉬지 않고 일하는 AI 직원: Munder Difflin으로 AI 사무실 차리는 법"
  );
  assert.equal(PAGE_TITLE.includes("낭만빌더"), false);
  assert.equal(OG_IMAGE_BYTES, 3992);
  assert.equal(EXPECTED_IMAGES, 1);
  assert.equal(EXPECTED_ATTACHMENTS, 0);
  assert.equal(EXPECTED_TABLES, 1);
  assert.equal(EXPECTED_CODES, 1);
});

test("클로덱스 루프 글과 제목·URL이 다르다", () => {
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

test("parseSdkKimHtml은 본문·링크를 남기고 메일 폼·미드 CTA·다음 글·목차를 뺀다", () => {
  const dirty = `${SOURCE_URL}/?utm_source=share&fbclid=IwAR123`;
  const parsed = parseSdkKimHtml(FIXTURE, dirty);
  assert.equal(parsed.title, PAGE_TITLE);
  assert.equal(parsed.markdown.startsWith(`# ${PAGE_TITLE}`), true);
  assert.equal(
    parsed.markdown.includes(`> 원문. [낭만빌더 김스듴](${SOURCE_URL})`),
    true
  );
  assert.equal(parsed.markdown.includes("에이전트 워크플로"), true);
  assert.equal(parsed.markdown.includes("2026. 9. 29."), true);
  assert.match(parsed.markdown, /\u200b2026\. 9\. 29\./);
  const require = createRequire(import.meta.url);
  const tsx = require("tsx/cjs/api");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  tsx.register({ tsconfig: resolve(root, "tsconfig.json") });
  const { markdownToTiptapDoc } = require(
    resolve(root, "src/lib/markdown-to-tiptap.ts")
  );
  const stored = JSON.stringify(markdownToTiptapDoc(parsed.markdown));
  assert.equal(stored.includes("2026. 9. 29."), true);
  assert.equal(stored.includes("\u200b2026. 9. 29."), true);
  assert.equal(parsed.markdown.includes("어떻게 돌아가나"), true);
  assert.equal(parsed.markdown.includes(GITHUB_URL), true);
  assert.equal(parsed.markdown.includes(HARNESS_URL), true);
  assert.equal(parsed.markdown.includes(HIRES_URL), true);
  assert.equal(parsed.markdown.includes("fbclid"), false);
  assert.equal(parsed.markdown.includes("utm_source"), false);
  assert.equal(parsed.markdown.includes("utm_"), false);
  assert.equal(parsed.markdown.includes("30일"), false);
  assert.equal(parsed.markdown.includes("이메일 알림"), false);
  assert.equal(parsed.markdown.includes("개인정보 수집"), false);
  assert.equal(parsed.markdown.includes("AI 위임 루프"), false);
  assert.equal(parsed.markdown.includes("ai-delegation-loop"), false);
  assert.equal(parsed.markdown.includes("지금 다 못 읽겠다면"), false);
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
