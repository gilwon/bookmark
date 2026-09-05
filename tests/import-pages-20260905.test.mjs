// Blogspot·Notion 4건 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  IMAGE_BYTES,
  TARGETS,
  hasNoExpiredUrl,
  isDuplicateRow,
  parseBlogspotHtml,
  stripTracking,
} from "../scripts/import-pages-20260905.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-pages-20260905.mjs"
);

const FIXTURE = `<!doctype html>
<html lang="ko">
  <head>
    <title>최신 AI 뉴스</title>
  </head>
  <body>
    <div class="widget PopularPosts">
      <h3>인기 게시물</h3>
      <img src="https://example.com/popular-sidebar-1.png" alt="인기1">
      <img src="https://example.com/popular-sidebar-2.png" alt="인기2">
      <img src="https://example.com/popular-sidebar-3.png" alt="인기3">
    </div>
    <div class="post-body entry-content">
      <article>
        <h1>앤트로픽(Anthropic) 공식 공개: 클로드 5(Claude 5) 프롬프트 작성 7가지 골든 룰</h1>
        <p>단계를 나누지 말고 엔드투엔드(End-to-End)로 위임하라. Interview Me 스킬을 쓴다.</p>
        <div style="background: rgb(26, 32, 44); font-family: Consolas, Monaco, monospace; overflow-x: auto;">
          <div>// Claude 5 표준 프롬프트 구조 (E2E Framework)</div>
          1. [JOB]: 달성해야 할 전체 작업의 목적
          4. [DONE LOOKS LIKE]: 작업 완결 기준
        </div>
        <div style="background: rgb(26, 32, 44); font-family: Consolas, Monaco, monospace;">
          <div>// Global Voice Control Instructions 예시</div>
          "Keep responses focused, brief, and concise."
        </div>
        <div style="overflow-x: auto;">
          <table>
            <thead>
              <tr><th>구분 요소</th><th>구형 기법</th><th>권장</th></tr>
            </thead>
            <tbody>
              <tr><td>과제 전달</td><td>단계별</td><td>E2E</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          <a href="https://jwchaainews.blogspot.com/2026/09/anthropic-5claude-5-7.html?m=1&amp;utm_source=share&amp;fbclid=IwAR123">원문</a>
        </p>
      </article>
    </div>
    <div class="post-share-buttons">공유하기</div>
    <div id="comments">댓글 영역</div>
    <script>alert(1)</script>
  </body>
</html>`;

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// Blogspot 클로드 5 골든 룰과 한국시간 이번 주 Notion 신규 3건을 Pages에만 저장한다"
  );
});

test("대상은 4건이고 이미지 수는 0·3·0·4이다", () => {
  assert.equal(TARGETS.length, 4);
  assert.deepEqual(
    TARGETS.map((item) => item.key),
    ["blogspot-claude5", "privacy", "subsidy", "hormozi"]
  );
  assert.deepEqual(
    TARGETS.map((item) => item.images),
    [0, 3, 0, 4]
  );
  assert.equal(
    IMAGE_BYTES["tmp/notion-kst-20260905/privacy/01-hero-chatgpt-privacy.png"],
    239581
  );
  assert.equal(
    IMAGE_BYTES["tmp/notion-kst-20260905/hormozi/step4.png"],
    115765
  );
});

test("stripTracking은 m=1·utm·fbclid·pvs·source=copy_link를 뺀다", () => {
  const cases = [
    [
      "https://jwchaainews.blogspot.com/2026/09/anthropic-5claude-5-7.html?m=1&utm_source=share&fbclid=IwAR123",
      "https://jwchaainews.blogspot.com/2026/09/anthropic-5claude-5-7.html",
    ],
    [
      "https://app.notion.com/p/afdb256827ac834aaa1101b008fa23a5?pvs=204&source=copy_link&utm_medium=social",
      "https://app.notion.com/p/afdb256827ac834aaa1101b008fa23a5",
    ],
    [
      "https://example.com/path?utm_campaign=share&fbclid=IwAR123&pvs=204",
      "https://example.com/path",
    ],
  ];
  for (const [dirty, clean] of cases) {
    const cleaned = stripTracking(dirty);
    assert.equal(cleaned.includes("m=1"), false, dirty);
    assert.equal(cleaned.includes("utm_source"), false, dirty);
    assert.equal(cleaned.includes("utm_medium"), false, dirty);
    assert.equal(cleaned.includes("utm_campaign"), false, dirty);
    assert.equal(cleaned.includes("fbclid"), false, dirty);
    assert.equal(cleaned.includes("pvs="), false, dirty);
    assert.equal(cleaned.includes("source=copy_link"), false, dirty);
    assert.equal(cleaned, clean);
  }
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
  assert.equal(hasNoExpiredUrl("https://x.com/?utm_medium=social"), false);
  assert.equal(hasNoExpiredUrl("https://x.com/?utm_campaign=share"), false);
});

test("isDuplicateRow는 제목 또는 hex 또는 sourceUrl로 true다", () => {
  const blog = TARGETS.find((item) => item.key === "blogspot-claude5");
  const privacy = TARGETS.find((item) => item.key === "privacy");
  assert.equal(Boolean(blog?.sourceUrl), true);
  assert.equal(Boolean(privacy?.hex), true);
  assert.equal(
    isDuplicateRow(
      { title: blog.title, content: "x" },
      blog.title,
      [blog.sourceUrl]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", source_url: blog.sourceUrl, content: "없음" },
      blog.title,
      [blog.sourceUrl]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: `원문 ${blog.sourceUrl}` },
      blog.title,
      [blog.sourceUrl]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: `원문 ${privacy.hex}` },
      privacy.title,
      [privacy.hex]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: "없음" },
      privacy.title,
      [privacy.hex, privacy.sourceUrl]
    ),
    false
  );
});

test("블로그 parse는 본문 h1과 코드상자 2개만 남긴다", () => {
  const spec = TARGETS.find((item) => item.key === "blogspot-claude5");
  const parsed = parseBlogspotHtml(FIXTURE, spec);
  assert.equal(parsed.title, spec.title);
  assert.equal(parsed.markdown.startsWith(`# ${spec.title}`), true);
  assert.equal(parsed.markdown.includes("최신 AI 뉴스"), false);
  const fenceCount = [...parsed.markdown.matchAll(/```/g)].length;
  assert.equal(fenceCount, 4);
  assert.equal(
    parsed.markdown.includes("// Claude 5 표준 프롬프트 구조 (E2E Framework)"),
    true
  );
  assert.equal(
    parsed.markdown.includes("// Global Voice Control Instructions 예시"),
    true
  );
  assert.equal(parsed.markdown.includes("[JOB]"), true);
  assert.equal(parsed.markdown.includes("DONE LOOKS LIKE"), true);
  assert.equal(
    parsed.markdown.includes("Keep responses focused, brief, and concise."),
    true
  );
  assert.equal(parsed.markdown.includes("| 구분 요소 |"), true);
  assert.equal(parsed.markdown.includes("popular-sidebar"), false);
  assert.equal(parsed.markdown.includes("인기1"), false);
  assert.equal(parsed.markdown.includes("댓글 영역"), false);
  assert.equal(parsed.markdown.includes("공유하기"), false);
  assert.equal(parsed.markdown.includes("m=1"), false);
  assert.equal(parsed.markdown.includes("fbclid"), false);
  assert.equal(parsed.markdown.includes("utm_source"), false);
});
