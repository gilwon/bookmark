// 스케일메이커 클로드 공식 스킬 정리 이관을 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  PAGE_TITLE,
  SOURCE_URL,
  articleMarkdownFromHtml,
  isDuplicateRow,
  stripTracking,
} from "../scripts/import-scalemaker-claude-official-skills.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-scalemaker-claude-official-skills.mjs"
);

const SAMPLE_HTML = `<!doctype html>
<html><body>
<header><img src="/brand/logo.svg" alt="logo"></header>
<main>
  <ol>
    <li>
      <span>01</span>
      <h2>1. claude.ai에서 스킬 켜는 법</h2>
      <button type="button">복사</button>
      <pre>/plugin marketplace add anthropics/skills
/plugin install document-skills@anthropic-agent-skills</pre>
    </li>
  </ol>
  <p>2026. 10. 02. 메모</p>
  <a href="/courses">강의 둘러보기</a>
</main>
<footer><a href="https://pf.kakao.com/x">이용약관</a></footer>
</body></html>`;

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 스케일메이커 클로드 공식 스킬 19개 정리를 Pages에만 저장한다"
  );
});

test("SOURCE_URL에 쿼리와 fbclid가 없다", () => {
  assert.equal(SOURCE_URL.includes("?"), false);
  assert.equal(SOURCE_URL.includes("fbclid"), false);
  assert.equal(PAGE_TITLE, "클로드 공식 스킬 19개 총정리 + 켜는 법");
  assert.equal(stripTracking(`${SOURCE_URL}?fbclid=abc&utm_source=ig`), SOURCE_URL);
});

test("비슷한 제목은 중복이 아니다", () => {
  assert.equal(
    isDuplicateRow(
      { title: "클로드 공식 스킬", source_url: "https://example.com/other" },
      PAGE_TITLE,
      SOURCE_URL
    ),
    false
  );
});

test("같은 제목은 중복이다", () => {
  assert.equal(
    isDuplicateRow(
      { title: PAGE_TITLE, source_url: "https://example.com/other" },
      PAGE_TITLE,
      SOURCE_URL
    ),
    true
  );
});

test("같은 원문 주소는 중복이다", () => {
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", source_url: SOURCE_URL },
      PAGE_TITLE,
      SOURCE_URL
    ),
    true
  );
});

test("본문 변환은 헤더 로고와 복사 버튼을 버리고 목록 안 제목과 코드와 강의 링크를 남긴다", () => {
  const markdown = articleMarkdownFromHtml(SAMPLE_HTML);
  assert.equal(markdown.includes("/brand/logo"), false);
  assert.equal(markdown.includes("복사"), false);
  assert.equal(markdown.includes("이용약관"), false);
  assert.equal(markdown.includes("01"), false);
  assert.match(markdown, /^## 1\. claude\.ai에서 스킬 켜는 법$/m);
  assert.match(
    markdown,
    /```\n\/plugin marketplace add anthropics\/skills\n\/plugin install document-skills@anthropic-agent-skills\n```/
  );
  assert.equal(markdown.includes("https://scalemaker.co/courses"), true);
  assert.equal(markdown.includes("](/courses)"), false);
  assert.equal(markdown.includes("\u200B2026. 10. 02."), true);
  assert.equal(/^2026\. 10\. 02\./m.test(markdown), false);
});

test("원문 스크립트는 프롬프트 테이블과 갱신과 첨부 저장소를 쓰지 않는다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes("from('prompts')"), false);
  assert.equal(source.includes(".update("), false);
  assert.equal(source.includes("UPDATE custom_pages"), false);
  assert.equal(source.includes("page-attachment-storage"), false);
});
