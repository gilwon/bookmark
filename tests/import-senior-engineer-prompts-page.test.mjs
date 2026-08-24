// 시니어 엔지니어 모드 프롬프트 7개의 원문과 펜스를 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import {
  PAGE_TITLE,
  REQUIRED_PHRASES,
  SECTIONS,
  buildPageMarkdown,
  countCodeBlocks,
} from "../scripts/import-senior-engineer-prompts-page.mjs";

test("마크다운에 제목과 자리표시 7개가 있다", () => {
  const markdown = buildPageMarkdown();
  assert.equal(markdown.startsWith(`# ${PAGE_TITLE}`), true);
  for (const phrase of REQUIRED_PHRASES) {
    assert.equal(markdown.includes(phrase), true, phrase);
  }
});

test("프롬프트 7개는 코드 펜스 안에 원문 그대로 있다", () => {
  const markdown = buildPageMarkdown();
  const fences = [...markdown.matchAll(/```(?:\w+)?\n([\s\S]*?)```/g)].map(
    (match) => match[1].trim()
  );
  assert.equal(fences.length, 7);
  assert.equal(SECTIONS.length, 7);
  for (const [index, section] of SECTIONS.entries()) {
    assert.equal(fences[index], section.prompt, section.heading);
  }
});

test("자리표시는 펜스 안에서만 나온다", () => {
  const markdown = buildPageMarkdown();
  const withoutFences = markdown.replace(/```[\s\S]*?```/g, "");
  for (const phrase of REQUIRED_PHRASES) {
    assert.equal(markdown.includes(phrase), true, phrase);
    assert.equal(withoutFences.includes(phrase), false, phrase);
  }
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
