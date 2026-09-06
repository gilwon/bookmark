// 리더플AI 클로드 블로그 자동화 설계도 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  OG_IMAGE_BYTES,
  PAGE_TITLE,
  SOURCE_URL,
  hasNoExpiredUrl,
  isDuplicateRow,
  parseLeaderplHtml,
  stripTracking,
} from "../scripts/import-leaderpl-blog-auto.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-leaderpl-blog-auto.mjs"
);

const FIXTURE = `<!doctype html>
<html lang="ko">
  <head>
    <title>클로드 블로그 자동화 설계도 | 리더플AI 이신영</title>
    <link rel="icon" href="favicon.svg">
    <meta property="og:image" content="https://leaderpl-blog-auto.netlify.app/og-image.png">
  </head>
  <body>
    <main>
      <div class="wrap hero">
        <h1>매일 쓰는 블로그 글,<br>명령 두 줄로 끝내는 구조</h1>
        <p>네이버 블로그 글을 자동으로 씁니다.</p>
      </div>
      <div class="term">
        <span>›</span> <b>/post</b><br>
        <span>임시저장 완료</span>
      </div>
      <div class="say">
        <div class="say-h">클로드 코드에 이렇게 말하세요</div>
        <div class="say-b"><span class="q">브라우저를 자동으로 조종할 수 있는 도구를 설치해줘.</span></div>
      </div>
      <p>테스트 자동화에 쓰는 무료 도구(<code>Playwright</code>)입니다.</p>
      <div class="callout">
        <div class="t">발행은 사람이</div>
        <p>자동화는 임시저장에서 멈춥니다.</p>
      </div>
      <p>확인 <code>node -v</code> 그리고 CLAUDE.md</p>
      <table>
        <tr><th>방식</th><th>강점</th></tr>
        <tr><td>웹페이지로 찍기</td><td>한글 정확</td></tr>
      </table>
      <a href="https://open.kakao.com/o/gg7HIsJi?fbclid=IwAR123">오픈채팅</a>
    </main>
    <footer><p>수강생 공유용</p></footer>
  </body>
</html>`;

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 리더플AI 클로드 블로그 자동화 설계도를 Pages에만 저장한다"
  );
});

test("stripTracking은 utm·fbclid를 뺀다", () => {
  const dirty = `${SOURCE_URL}?utm_source=share&fbclid=IwAR123`;
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned, SOURCE_URL);
});

test("parseLeaderplHtml은 제목과 터미널·지시문을 남긴다", () => {
  const parsed = parseLeaderplHtml(FIXTURE, SOURCE_URL);
  assert.equal(parsed.title, PAGE_TITLE);
  assert.equal(parsed.markdown.startsWith(`# ${PAGE_TITLE}`), true);
  assert.equal(
    parsed.markdown.includes(`> 원문. [리더플AI](${SOURCE_URL})`),
    true
  );
  assert.equal(parsed.markdown.includes("/post"), true);
  assert.equal(parsed.markdown.includes("Playwright"), true);
  assert.equal(parsed.markdown.includes("CLAUDE.md"), true);
  assert.equal(parsed.markdown.includes("node -v"), true);
  assert.equal(parsed.markdown.includes("자동화는 임시저장에서 멈춥니다"), true);
  assert.equal(parsed.markdown.includes("```"), true);
  assert.equal(parsed.markdown.includes(":::callout"), true);
  assert.equal(parsed.markdown.includes("| 방식 |"), true);
  assert.equal(parsed.markdown.includes("favicon"), false);
  assert.equal(parsed.markdown.includes("fbclid"), false);
  assert.equal(parsed.markdown.includes("og-image.png"), false);
});

test("만료 URL 문자열이 본문에 없으면 true다", () => {
  assert.equal(hasNoExpiredUrl("# 제목"), true);
  assert.equal(hasNoExpiredUrl("https://prod-files-secure.s3.amazonaws.com/x"), false);
  assert.equal(OG_IMAGE_BYTES, 44162);
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
    isDuplicateRow({ title: "다른 글", content: "없음" }, PAGE_TITLE, [SOURCE_URL]),
    false
  );
});
