// 자율루프 세팅 프롬프트 페이지 원문을 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import {
  PAGE_TITLE,
  REQUIRED_PHRASES,
  buildPageMarkdown,
  countCodeBlocks,
} from "../scripts/import-autonomous-loop-setup-page.mjs";

test("마크다운에 제목과 핵심 문구가 있다", () => {
  const markdown = buildPageMarkdown();
  assert.equal(markdown.startsWith(`# ${PAGE_TITLE}`), true);
  for (const phrase of REQUIRED_PHRASES) {
    assert.equal(markdown.includes(phrase), true, phrase);
  }
});

test("셋업 프롬프트는 코드 펜스 안에 있다", () => {
  const markdown = buildPageMarkdown();
  const fences = [...markdown.matchAll(/^```$/gm)];
  assert.equal(fences.length, 2);
  assert.equal(
    markdown.includes("```\n자율 개발 루프를 처음부터 끝까지 셋업해줘."),
    true
  );
  assert.equal(markdown.includes("loop/STOP 파일이 있으면"), true);
});

test("셋업 본문은 펜스 안에서만 나온다", () => {
  const markdown = buildPageMarkdown();
  const withoutFences = markdown.replace(/```[\s\S]*?```/g, "");
  assert.equal(markdown.includes("대화를 이어 붙이지 않는다"), true);
  assert.equal(withoutFences.includes("대화를 이어 붙이지 않는다"), false);
});

test("countCodeBlocks는 codeBlock 노드 수를 센다", () => {
  const json = JSON.stringify({
    type: "doc",
    content: [
      { type: "codeBlock", content: [{ type: "text", text: "a" }] },
      { type: "paragraph", content: [{ type: "text", text: "b" }] },
    ],
  });
  assert.equal(countCodeBlocks(json), 1);
});
