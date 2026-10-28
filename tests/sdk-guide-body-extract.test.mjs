// 김스듴 가이드 본문 추출이 장식과 코드 줄을 바르게 다루는지 검증한다.
import assert from "node:assert/strict";
import test from "node:test";
import { extractGuideMarkdown } from "../scripts/fetch-sdk-guide-bodies.mjs";

const SOURCE_URL = "https://sdk-kim-builds.com/guides/example/";

test("본문 문단과 span.line 코드는 빈 줄이 있는 코드 펜스가 된다", () => {
  const markdown = extractGuideMarkdown(
    `<div class="guide-detail-body">
      <p>본문 문단</p>
      <pre><code><span class="line">첫째 줄</span><span class="line"></span><span class="line">둘째 줄</span></code></pre>
    </div>`,
    SOURCE_URL
  );
  assert.match(markdown, /본문 문단/);
  assert.match(markdown, /```\n첫째 줄\n\n둘째 줄\n```/);
});

test("본문 밖 메일·대기자·도입 문의·다음 글은 결과에 없다", () => {
  const markdown = extractGuideMarkdown(
    `<details class="guide-mail"><p>개인정보 수집</p></details>
    <aside class="guide-waitlist"><p>도입 상담 요청</p></aside>
    <div class="guide-detail-body"><p>본문만 남긴다</p></div>
    <section class="guide-inquiry-block"><p>개인정보 수집</p></section>
    <nav class="guide-next"><p>도입 상담 요청</p></nav>`,
    SOURCE_URL
  );
  assert.match(markdown, /본문만 남긴다/);
  assert.equal(markdown.includes("개인정보 수집"), false);
  assert.equal(markdown.includes("도입 상담 요청"), false);
});

test("본문 안 상대 링크는 https 절대 주소이고 추적 쿼리가 없다", () => {
  const markdown = extractGuideMarkdown(
    `<div class="guide-detail-body"><p><a href="/guides/foo/?utm_source=x&amp;fbclid=1">이동</a></p></div>`,
    SOURCE_URL
  );
  assert.match(markdown, /https:\/\/sdk-kim-builds\.com\/guides\/foo\/?/);
  assert.equal(markdown.includes("utm_source"), false);
  assert.equal(markdown.includes("fbclid"), false);
});

test("연월일로 시작하는 문단은 폭 없는 문자와 날짜를 포함한다", () => {
  const markdown = extractGuideMarkdown(
    `<div class="guide-detail-body"><p>2026. 10. 27. 발행</p></div>`,
    SOURCE_URL
  );
  assert.equal(markdown.includes("\u200b"), true);
  assert.equal(markdown.includes("2026. 10. 27."), true);
});

test("guide-detail-body가 없으면 실패한다", () => {
  assert.throws(() => extractGuideMarkdown("<article><p>없음</p></article>", SOURCE_URL));
});
