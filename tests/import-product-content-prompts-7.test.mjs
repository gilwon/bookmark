// 상품 콘텐츠 프롬프트 7개 페이지 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import {
  MARKER,
  PAGE_TITLE,
  PROMPTS,
  buildMarkdown,
  isDuplicateRow,
} from "../scripts/import-product-content-prompts-7.mjs";

test("프롬프트는 7개이고 역할 문장이 있다", () => {
  assert.equal(PROMPTS.length, 7);
  assert.equal(PAGE_TITLE.includes("후킹부터 발행까지"), true);
  assert.equal(PROMPTS[0].body.includes(MARKER), true);
  assert.equal(PROMPTS[5].body.includes("당신은 콘텐츠 기획 PD입니다."), true);
  assert.equal(PROMPTS[6].body.includes("당신은 최종 편집자입니다."), true);
});

test("buildMarkdown은 제목·핵심 의도·원문 7개를 넣는다", () => {
  const markdown = buildMarkdown();
  assert.equal(markdown.startsWith(`# ${PAGE_TITLE}`), true);
  for (const item of PROMPTS) {
    assert.equal(markdown.includes(`## ${item.heading}`), true);
    assert.equal(markdown.includes(item.intent), true);
    assert.equal(markdown.includes(item.body), true);
  }
  assert.equal((markdown.match(/```/g) || []).length, 14);
});

test("isDuplicateRow는 제목 또는 마커로 true다", () => {
  assert.equal(
    isDuplicateRow({ title: PAGE_TITLE, content: "x" }, PAGE_TITLE, [MARKER]),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: `본문 ${MARKER}` },
      PAGE_TITLE,
      [MARKER]
    ),
    true
  );
  assert.equal(
    isDuplicateRow({ title: "다른 글", content: "없음" }, PAGE_TITLE, [MARKER]),
    false
  );
});
