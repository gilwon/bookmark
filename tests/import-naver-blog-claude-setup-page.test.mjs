// 네이버 블로그 클로드 세팅 페이지 원문 4개를 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import {
  PAGE_TITLE,
  REQUIRED_PHRASES,
  buildPageMarkdown,
  countCodeBlocks,
} from "../scripts/import-naver-blog-claude-setup-page.mjs";

test("마크다운에 제목과 핵심 문구 4개가 있다", () => {
  const markdown = buildPageMarkdown();
  assert.equal(markdown.startsWith(`# ${PAGE_TITLE}`), true);
  for (const phrase of REQUIRED_PHRASES) {
    assert.equal(markdown.includes(phrase), true, phrase);
  }
});

test("프롬프트 4개는 코드 펜스 안에 있다", () => {
  const markdown = buildPageMarkdown();
  const fences = [...markdown.matchAll(/^```$/gm)];
  assert.equal(fences.length, 8);
  assert.equal(markdown.includes("```\n최근 30일 동안"), true);
  assert.equal(markdown.includes("```\n네이버블로그 [분야] 상위 글 10개"), true);
  assert.equal(markdown.includes("```\n네이버블로그 [주제] 포스팅을 써줘."), true);
  assert.equal(markdown.includes("```\n매일 [분야]에서 검색량이 오르는"), true);
});

test("countCodeBlocks는 codeBlock 노드 수를 센다", () => {
  const json = JSON.stringify({
    type: "doc",
    content: [
      { type: "codeBlock", content: [{ type: "text", text: "a" }] },
      { type: "paragraph", content: [{ type: "text", text: "b" }] },
      { type: "codeBlock", content: [{ type: "text", text: "c" }] },
    ],
  });
  assert.equal(countCodeBlocks(json), 2);
});
