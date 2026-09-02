// ADU 키미 K3 가이드 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  EXPECTED_IMAGES,
  PAGE_TITLE,
  SOURCE_URL,
  hasNoExpiredUrl,
  htmlToMarkdown,
  isDuplicateRow,
  parseGuideHtml,
  stripTracking,
} from "../scripts/import-adu-kimi-guide.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-adu-kimi-guide.mjs"
);

const FIXTURE = `<!doctype html>
<html lang="ko">
  <head>
    <title>키미 K3 제대로 쓰는 법 | ADU</title>
  </head>
  <body>
    <div class="wrap">
      <header class="hero">
        <span class="kicker">ADU · AI 실전 활용</span>
        <h1>키미 K3, <em>결과가 갈리는 이유</em>는 요청 방식에 있습니다</h1>
        <p class="sub">요청 방식을 정리했습니다.</p>
        <p class="meta">댓글에 '키미' 남겨주신 분께 보내드리는 가이드</p>
      </header>
      <section>
        <h2>1. 시작할 때 이것부터</h2>
        <div class="callout c-tip">
          <span class="ico">💡</span>
          <div>kimi.ai로 들어가세요.</div>
        </div>
        <div class="promptbox">
          <span class="plabel">결과 화면을 캡처해서 다시 넣기</span>
          <button class="copybtn" onclick="copyP(this)">복사</button>
          <pre>[캡처 첨부]

&lt;고칠 것&gt;
- 어색한 부분
&lt;/고칠 것&gt;</pre>
        </div>
      </section>
      <section class="cta">
        <h2>하다가 막히면</h2>
        <a href="https://open.kakao.com/o/gNUk2D2h?fbclid=IwAR123">카카오 오픈채팅방 참여 →</a>
      </section>
    </div>
    <div id="toast">복사됐어요 ✓</div>
    <script>function copyP(btn) {}</script>
  </body>
</html>`;

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// ADU 키미 K3 가이드를 Pages에만 저장한다"
  );
});

test("stripTracking은 더러운 사용자 URL에서 fbclid를 뺀다", () => {
  const dirty =
    "https://adu-kimi-guide.vercel.app/?fbclid=IwAR123&utm_source=share";
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned, SOURCE_URL);
  assert.equal(
    stripTracking(
      "https://platform.kimi.ai/?track_id=track-a108dbb3bb6f428da504914a02498c01&fbclid=IwAR"
    ),
    "https://platform.kimi.ai/?track_id=track-a108dbb3bb6f428da504914a02498c01"
  );
});

test("parseGuideHtml은 복사 버튼을 빼고 프롬프트를 펜스로 둔다", () => {
  const parsed = parseGuideHtml(FIXTURE, SOURCE_URL);
  const markdown = htmlToMarkdown(FIXTURE, SOURCE_URL);
  assert.equal(parsed.title, PAGE_TITLE);
  assert.equal(parsed.markdown, markdown);
  assert.equal(markdown.startsWith(`# ${PAGE_TITLE}`), true);
  assert.equal(markdown.includes(`> 원문. [ADU](${SOURCE_URL})`), true);
  assert.equal(markdown.includes("### 결과 화면을 캡처해서 다시 넣기"), true);
  assert.equal(markdown.includes("```\n[캡처 첨부]"), true);
  assert.equal(markdown.includes("<고칠 것>"), true);
  assert.equal(markdown.includes("</고칠 것>"), true);
  assert.equal(markdown.includes("ADU · AI 실전 활용"), true);
  assert.equal(markdown.includes("요청 방식을 정리했습니다."), true);
  assert.equal(markdown.includes("kimi.ai로 들어가세요."), true);
  assert.equal(/^\s*복사(?:됨!)?\s*$/m.test(markdown), false);
  assert.equal(markdown.includes("복사됐어요"), false);
  assert.equal(markdown.includes('onclick="copyP'), false);
  assert.equal(markdown.includes("fbclid"), false);
  assert.equal(
    markdown.includes("https://open.kakao.com/o/gNUk2D2h"),
    true
  );
});

test("만료 URL 문자열이 본문에 없으면 true다", () => {
  assert.equal(hasNoExpiredUrl("# 제목\n\n본문입니다."), true);
  assert.equal(
    hasNoExpiredUrl("https://prod-files-secure.s3.us-west-2.amazonaws.com/x"),
    false
  );
  assert.equal(hasNoExpiredUrl("https://file.notion.so/f"), false);
  assert.equal(hasNoExpiredUrl("https://example.com/?X-Amz-Signature=1"), false);
  assert.equal(hasNoExpiredUrl("expirationTimestamp=1"), false);
  assert.equal(hasNoExpiredUrl("blob:https://example.com/1"), false);
  assert.equal(hasNoExpiredUrl("https://x.com/?fbclid=IwAR"), false);
  assert.equal(hasNoExpiredUrl("https://x.com/?utm_source=ig"), false);
});

test("isDuplicateRow는 제목 또는 원문 URL로 true다", () => {
  const markers = [SOURCE_URL];
  assert.equal(
    isDuplicateRow({ title: PAGE_TITLE, content: "x" }, PAGE_TITLE, markers),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: `원문 ${SOURCE_URL}` },
      PAGE_TITLE,
      markers
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", source_url: SOURCE_URL, content: "없음" },
      PAGE_TITLE,
      markers
    ),
    true
  );
  assert.equal(
    isDuplicateRow({ title: "다른 글", content: "없음" }, PAGE_TITLE, markers),
    false
  );
});

test("EXPECTED_IMAGES는 0이다", () => {
  assert.equal(EXPECTED_IMAGES, 0);
});
