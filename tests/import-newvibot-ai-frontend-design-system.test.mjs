// newvibot 디자인 시스템 글 이관 헬퍼를 네트워크 없이 검증한다.
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
  EXPECTED_ATTACHMENTS,
  EXPECTED_CODES,
  EXPECTED_IMAGES,
  EXPECTED_TABLES,
  IMAGE_FILES,
  MEDIUM_URL,
  PAGE_TITLE,
  RELATED_URL,
  SOURCE_URL,
  pageFromHtml,
} from "../scripts/import-newvibot-ai-frontend-design-system.mjs";

const TRACKING = ["fb", "clid"].join("");
const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-newvibot-ai-frontend-design-system.mjs"
);
const PNG_URL = "data:image/png;base64,iVBORw0KGgo=";

const FIXTURE = `<!doctype html>
<html lang="ko">
  <body>
    <header>
      <img src="/logo/logo.png" alt="VacayBuddy Logo" />
    </header>
    <article>
      <h1>${PAGE_TITLE}</h1>
      <div>
        <img src="${PNG_URL}" alt="홍길동" />
        <div>홍길동</div>
        <time datetime="2026-10-14T00:00:00.000Z">2026년 10월 14일</time>
      </div>
      <p>지난 글 링크와 <code>ADMIN</code> 라벨.</p>
      <p><a href="${MEDIUM_URL}?${TRACKING}=1&amp;utm_source=ig">지난 글</a></p>
      <figure>
        <img src="${PNG_URL}" alt="개편 후" />
        <figcaption>개편 후. 같은 가상 조직 데이터로 찍었습니다.</figcaption>
      </figure>
      <table>
        <tr><th>항목</th><th>값</th></tr>
        <tr><td>바꾼 페이지</td><td>32개</td></tr>
      </table>
      <p><a href="${RELATED_URL}">VacayBuddy 블로그 글</a></p>
      <p><a href="http://localhost:3000/health">로컬</a></p>
      <p>2026. 10. 14. 메모</p>
      <img src="/logo/slack_icon.png" alt="Slack" />
      <footer><a href="/ko/privacy-policy">Privacy Policy</a></footer>
    </article>
  </body>
</html>`;

test("스크립트 첫 줄과 직접 실행 가드와 저장 금지를 지킨다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// newvibot 디자인 시스템 글을 Pages에만 저장한다."
  );
  assert.equal(source.includes('const LOCAL_USER = "dev"'), true);
  assert.equal(
    source.includes('const PROD_USER = "f72e9a44-79d8-4061-a700-3ec50bb04a97"'),
    true
  );
  assert.equal(source.includes("local.pages === 1"), true);
  assert.equal(
    source.includes(
      "이번 실행에서 넣은 로컬 행만 지운다. 원래 있던 행은 남긴다."
    ),
    true
  );
  assert.equal(source.includes("process.argv[1]"), true);
  assert.equal(source.includes(TRACKING), false);
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes("from('prompts')"), false);
  assert.equal(source.includes(".update("), false);
  assert.equal(/UPDATE\s+custom_pages/i.test(source), false);
  const checkAt = source.indexOf("if (checkOnly)");
  const persistAt = source.indexOf("await persist(");
  assert.equal(checkAt > 0 && persistAt > checkAt, true);
});

test("주소와 제목과 개수 상수가 라이브 글과 같다", () => {
  assert.equal(
    SOURCE_URL,
    "https://newvibot.com/ko/blog/ai-frontend-design-system"
  );
  assert.equal(
    PAGE_TITLE,
    "AI로 만든 프론트, AI처럼 안 보이게 — 디자인 시스템을 먼저 만든 이유"
  );
  assert.equal(EXPECTED_IMAGES, 10);
  assert.equal(EXPECTED_ATTACHMENTS, 0);
  assert.equal(EXPECTED_TABLES, 3);
  assert.equal(EXPECTED_CODES, 0);
  assert.equal(IMAGE_FILES.length, 10);
  assert.equal(IMAGE_FILES.includes("hong.jpg"), true);
  assert.equal(MEDIUM_URL.startsWith("https://medium.com/"), true);
  assert.equal(
    RELATED_URL,
    "https://newvibot.com/ko/blog/leave-calendar-redesign-2026"
  );
});

test("합성 HTML은 로고와 추적 쿼리를 빼고 본문 사진과 표를 남긴다", () => {
  const parsed = pageFromHtml(FIXTURE);
  const { markdown } = parsed;
  assert.equal(parsed.title, PAGE_TITLE);
  assert.equal(markdown.includes(`> 원문. [VacayBuddy](${SOURCE_URL})`), true);
  assert.equal(markdown.includes(TRACKING), false);
  assert.equal(markdown.includes("utm_source"), false);
  assert.equal(markdown.includes("slack_icon"), false);
  assert.equal(markdown.includes("logo.png"), false);
  assert.equal(markdown.includes("Privacy Policy"), false);
  assert.equal(markdown.includes("홍길동"), true);
  assert.equal(markdown.includes("2026년 10월 14일"), true);
  assert.equal(
    markdown.includes("개편 후. 같은 가상 조직 데이터로 찍었습니다."),
    true
  );
  assert.equal(markdown.includes("`ADMIN`"), true);
  assert.equal(markdown.includes("\u200B2026. 10. 14."), true);
  assert.equal(markdown.includes("http://localhost:3000/health"), true);
  assert.equal(markdown.includes("https://localhost"), false);
  assert.equal(markdown.includes(MEDIUM_URL), true);
  assert.equal(markdown.includes(RELATED_URL), true);
  const stats = documentStats(JSON.stringify(markdownToTiptapDoc(markdown)));
  assert.equal(stats.images, 2);
  assert.equal(stats.tables, 1);
  assert.equal(stats.codes, 0);
  assert.equal(stats.attachments, 0);
});

test("같은 원문만 중복이고 다른 글 제목은 통과한다", () => {
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
  assert.equal(
    isDuplicateRow(
      {
        title: "클로드로 얼굴 없는 계정 키우는 프롬프트 8가지",
        source_url: "https://example.com/other",
      },
      PAGE_TITLE,
      markers
    ),
    false
  );
});
