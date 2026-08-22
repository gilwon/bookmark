// 블로그 주제 찾기 프롬프트 페이지 원문 8개를 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import {
  PAGE_TITLE,
  REQUIRED_PHRASES,
  buildPageMarkdown,
  countCodeBlocks,
} from "../scripts/import-blog-topic-finder-prompts-page.mjs";

test("마크다운에 제목과 핵심 문구가 있다", () => {
  const markdown = buildPageMarkdown();
  assert.equal(markdown.startsWith(`# ${PAGE_TITLE}`), true);
  for (const phrase of REQUIRED_PHRASES) {
    assert.equal(markdown.includes(phrase), true, phrase);
  }
});

test("프롬프트 8개는 코드 펜스 안에 있다", () => {
  const markdown = buildPageMarkdown();
  const fences = [...markdown.matchAll(/^```$/gm)];
  assert.equal(fences.length, 16);
  assert.equal(markdown.includes("```\n나는 [관심 분야]에 관심이 있고"), true);
  assert.equal(markdown.includes("```\n[주제]로 블로그를 운영하려고 해."), true);
  assert.equal(markdown.includes("```\n[키워드]를 활용해서"), true);
  assert.equal(
    markdown.includes("```\n[키워드]로 블로그 글을 작성하려고 해."),
    true
  );
  assert.equal(
    markdown.includes("```\n아래 정보를 바탕으로 블로그 글 초안을 작성해줘."),
    true
  );
  assert.equal(markdown.includes("```\n아래 블로그 글을 분석해서"), true);
  assert.equal(
    markdown.includes("```\n다음 블로그 또는 콘텐츠를 분석해줘."),
    true
  );
  assert.equal(
    markdown.includes("```\n나는 [분야] 블로그를 운영하고 있고"),
    true
  );
});

test("자리표시자는 펜스 안에 있다", () => {
  const markdown = buildPageMarkdown();
  const withoutFences = markdown.replace(/```[\s\S]*?```/g, "");
  for (const phrase of ["[관심 분야]", "[키워드]", "[블로그 글 붙여넣기]"]) {
    assert.equal(markdown.includes(phrase), true, phrase);
    assert.equal(withoutFences.includes(phrase), false, phrase);
  }
});

test("핵심 문장은 펜스 안에서만 나온다", () => {
  const markdown = buildPageMarkdown();
  const withoutFences = markdown.replace(/```[\s\S]*?```/g, "");
  assert.equal(markdown.includes("수익화하기 좋은 주제 5개를 추천해줘."), true);
  assert.equal(
    withoutFences.includes("수익화하기 좋은 주제 5개를 추천해줘."),
    false
  );
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
