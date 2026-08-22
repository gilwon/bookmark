// 경력 정리 프롬프트 페이지 원문 5개를 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import {
  PAGE_TITLE,
  REQUIRED_PHRASES,
  buildPageMarkdown,
  countCodeBlocks,
} from "../scripts/import-career-summary-prompts-page.mjs";

test("마크다운에 제목과 핵심 문구가 있다", () => {
  const markdown = buildPageMarkdown();
  assert.equal(markdown.startsWith(`# ${PAGE_TITLE}`), true);
  for (const phrase of REQUIRED_PHRASES) {
    assert.equal(markdown.includes(phrase), true, phrase);
  }
});

test("프롬프트 5개는 코드 펜스 안에 있다", () => {
  const markdown = buildPageMarkdown();
  const fences = [...markdown.matchAll(/^```$/gm)];
  assert.equal(fences.length, 10);
  assert.equal(markdown.includes("```\n❌ 뭘 썼는지 모르겠어"), true);
  assert.equal(markdown.includes("```\n❌ 담당했다고밖에 못 쓰겠어"), true);
  assert.equal(markdown.includes("```\n❌ 내 강점이 뭔지 모르겠어"), true);
  assert.equal(markdown.includes("```\n❌ 어떻게 배치하지"), true);
  assert.equal(markdown.includes("```\n❌ 하나로 다 내면 되지"), true);
  assert.equal(markdown.includes("[여기에 쏟아내기]\n```"), true);
});

test("핵심 문장은 펜스 안에서만 나온다", () => {
  const markdown = buildPageMarkdown();
  const withoutFences = markdown.replace(/```[\s\S]*?```/g, "");
  assert.equal(markdown.includes("너는 경력기술서를 돕는 컨설턴트다"), true);
  assert.equal(withoutFences.includes("너는 경력기술서를 돕는 컨설턴트다"), false);
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
