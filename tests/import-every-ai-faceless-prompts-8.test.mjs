// every._ai 얼굴 없는 계정 프롬프트 8가지 이관 헬퍼를 네트워크 없이 검증한다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { documentStats } from "../scripts/import-claude-eli5-page.mjs";
import { markdownToTiptapDoc } from "../src/lib/markdown-to-tiptap.ts";
import {
  decideSkip,
  isDuplicateRow,
  sourceMarkers,
} from "../scripts/import-every-ai-index-20261013.mjs";
import {
  CREATORS_URL,
  EXPECTED_ATTACHMENTS,
  EXPECTED_CODES,
  EXPECTED_IMAGES,
  EXPECTED_TABLES,
  HELP_URL,
  PAGE_TITLE,
  PROMPT_ENGINEERING_URL,
  SOURCE_URL,
  pageFromHtml,
} from "../scripts/import-every-ai-faceless-prompts-8.mjs";

const TRACKING = ["fb", "clid"].join("");
const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-every-ai-faceless-prompts-8.mjs"
);
const OTHER_TITLES = [
  "클로드로 밤티 없는 화면 만드는 프롬프트 8가지",
  "클로드 코드로 앱 만드는 프롬프트 8가지",
];
const PDF_URL = "data:application/pdf;base64,JVBERi0=";
const PNG_URL = "data:image/png;base64,iVBORw0KGgo=";

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
        <div class="sub"><span>읽는 데 9분</span><span>2026-10-13 공개</span></div>
      </div>
      <a class="bootcamp-post-banner" href="/class/bootcamp-oct.html?from=dm">부트캠프</a>
      <div class="challenge-post-banner">
        <span>AI 수익화 챌린지</span>
        <a href="/money-map?from=guide">자료집</a>
      </div>
      <a class="kakao-post-cta" href="/kakao?from=guide">하단 카카오 배너</a>
      <img src="/img/class/claude-icon.png" alt="Claude">
      <button type="button">복사</button>
      <h2>Quick Start</h2>
      <h2><span class="n">STEP 1 · 5분</span>팔릴 주제 하나를 고른다</h2>
      <p>2026. 9. 18. 기록</p>
      <pre>curl http://localhost:3000/health</pre>
      <ul>
        <li><a href="${CREATORS_URL}?from=guide&amp;${TRACKING}=x">creators</a></li>
        <li><a href="${HELP_URL}?utm_source=share">help</a></li>
        <li><a href="${PROMPT_ENGINEERING_URL}?from=guide&amp;utm_source=y">prompt</a></li>
      </ul>
      <p><a href="/downloads/sample.zip">샘플 zip</a></p>
      <p><a href="${PDF_URL}">샘플.pdf</a></p>
      <img src="${PNG_URL}" alt="예시">
      <table>
        <tr><th>이름</th><th>주소</th></tr>
        <tr><td>예시</td><td><a href="https://example.com/item?utm_source=x">열기</a></td></tr>
      </table>
      <script>var marker = "from=dm";</script>
    </article>
    <footer>
      <a href="https://youtube.com/@every._ai?from=guide">유튜브</a>
    </footer>
  </body>
</html>`;

test("스크립트 첫 줄과 직접 실행 가드와 저장 금지를 지킨다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// every._ai 얼굴 없는 계정 프롬프트 8가지를 Pages에만 저장한다."
  );
  assert.equal(source.includes('const LOCAL_USER = "dev"'), true);
  assert.equal(
    source.includes('const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97"'),
    true
  );
  assert.equal(
    source.includes('from "./import-every-ai-index-20261013.mjs"'),
    true
  );
  assert.equal(source.includes("parseEveryAiHtml(html, SOURCE_URL)"), true);
  assert.equal(source.includes("async function inlineBodyImages"), true);
  assert.equal(source.includes("async function inlineAttachments"), true);
  assert.equal(source.includes("local.pages === 1"), true);
  assert.equal(
    source.includes(
      "이번 실행에서 넣은 로컬 행만 지운다. 원래 있던 행은 남긴다."
    ),
    true
  );
  assert.equal(source.includes("process.argv[1]"), true);
  assert.equal(
    source.includes(
      "fileURLToPath(import.meta.url) === resolve(process.argv[1])"
    ),
    true
  );
  assert.equal(source.includes(TRACKING), false);
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes("from('prompts')"), false);
  assert.equal(source.includes(".update("), false);
  assert.equal(source.includes("page-attachment-storage"), false);
  assert.equal(/UPDATE\s+custom_pages/i.test(source), false);
  assert.equal(source.includes("Turndown"), false);
  assert.equal(source.includes("turndown"), false);
  const checkAt = source.indexOf("if (checkOnly)");
  const persistAt = source.indexOf("await persist(");
  assert.equal(checkAt > 0 && persistAt > checkAt, true);
});

test("주소와 제목과 개수 상수가 라이브 글과 같다", () => {
  assert.equal(
    SOURCE_URL,
    "https://every-ai-guides.vercel.app/posts/claude-faceless-account-prompts-8"
  );
  assert.equal(SOURCE_URL.includes("?"), false);
  assert.equal(SOURCE_URL.includes(".html"), false);
  assert.equal(SOURCE_URL.endsWith("/"), false);
  assert.equal(PAGE_TITLE, "클로드로 얼굴 없는 계정 키우는 프롬프트 8가지");
  assert.equal(CREATORS_URL, "https://creators.instagram.com/");
  assert.equal(HELP_URL, "https://help.instagram.com/");
  assert.equal(
    PROMPT_ENGINEERING_URL,
    "https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview"
  );
  assert.equal(EXPECTED_IMAGES, 0);
  assert.equal(EXPECTED_ATTACHMENTS, 0);
  assert.equal(EXPECTED_TABLES, 3);
  assert.equal(EXPECTED_CODES, 8);
});

test("합성 HTML은 배너를 빼고 공식 링크와 첨부를 남긴다", () => {
  const parsed = pageFromHtml(FIXTURE);
  const { markdown } = parsed;
  assert.equal(parsed.title, PAGE_TITLE);
  assert.equal(
    markdown.includes(`> 원문. [every._ai](${SOURCE_URL})`),
    true
  );
  assert.equal(markdown.includes(`${SOURCE_URL}?`), false);
  assert.equal(markdown.includes(".html"), false);
  assert.equal(markdown.includes("읽는 데 9분 2026-10-13 공개"), true);
  assert.equal(
    markdown.includes("STEP 1 · 5분 팔릴 주제 하나를 고른다"),
    true
  );
  assert.equal(markdown.includes("5분팔릴"), false);
  assert.equal(markdown.includes("\u200B2026. 9. 18."), true);
  assert.equal(markdown.includes("http://localhost:3000/health"), true);
  assert.equal(markdown.includes("https://localhost"), false);
  assert.equal(
    markdown.includes("https://every-ai-guides.vercel.app/downloads/sample.zip"),
    true
  );
  assert.equal(markdown.includes("data:application/zip"), false);
  assert.equal(markdown.includes("money-map"), false);
  assert.equal(markdown.includes("/kakao"), false);
  assert.equal(markdown.includes("youtube.com"), false);
  assert.equal(markdown.includes("instagram.com/every"), false);
  assert.equal(markdown.includes("claude-icon"), false);
  assert.equal(markdown.includes("from=dm"), false);
  assert.equal(markdown.includes("from=guide"), false);
  assert.equal(markdown.includes("utm_source"), false);
  assert.equal(markdown.includes(TRACKING), false);
  assert.equal(markdown.includes("AI 수익화 챌린지"), false);

  const stats = documentStats(JSON.stringify(markdownToTiptapDoc(markdown)));
  assert.equal(stats.images, 1);
  assert.equal(stats.tables, 1);
  assert.equal(stats.codes, 1);
  assert.equal(stats.attachments, 1);
  for (const href of [
    SOURCE_URL,
    CREATORS_URL,
    HELP_URL,
    PROMPT_ENGINEERING_URL,
    "https://every-ai-guides.vercel.app/downloads/sample.zip",
    "https://example.com/item",
  ]) {
    assert.equal(stats.hrefs.includes(href), true, href);
  }
});

test("같은 원문만 중복이고 비슷한 제목은 다른 글이다", () => {
  const markers = sourceMarkers(SOURCE_URL);
  const both = decideSkip(
    [{ id: "local-1", title: PAGE_TITLE, source_url: SOURCE_URL }],
    [{ id: "prod-1", title: PAGE_TITLE, source_url: `${SOURCE_URL}.html` }],
    PAGE_TITLE,
    markers
  );
  assert.equal(both.skip, true);
  const otherSource = decideSkip(
    [{ id: "other", title: PAGE_TITLE, source_url: "https://example.com/other" }],
    [],
    PAGE_TITLE,
    markers
  );
  assert.equal(otherSource.skip, true);
  assert.equal(otherSource.preferredId, null);
  const localOnly = decideSkip(
    [{ id: "local-9", title: PAGE_TITLE, source_url: SOURCE_URL }],
    [],
    PAGE_TITLE,
    markers
  );
  assert.equal(localOnly.skip, false);
  assert.equal(localOnly.preferredId, "local-9");
  const none = decideSkip([], [], PAGE_TITLE, markers);
  assert.equal(none.skip, false);
  assert.equal(none.preferredId, null);
  for (const title of OTHER_TITLES) {
    assert.equal(
      isDuplicateRow(
        { title, source_url: "https://example.com/other" },
        PAGE_TITLE,
        markers
      ),
      false
    );
  }
});
