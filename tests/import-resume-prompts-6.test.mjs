// 이력서 프롬프트 6개 페이지 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import {
  MARKER,
  PAGE_TITLE,
  PROMPTS,
  buildMarkdown,
  isDuplicateRow,
} from "../scripts/import-resume-prompts-6.mjs";

test("프롬프트는 6개이고 엑스레이 역할 문장이 있다", () => {
  assert.equal(PROMPTS.length, 6);
  assert.equal(PAGE_TITLE.includes("엑스레이부터 서류 통과까지"), true);
  assert.equal(PROMPTS[0].body.includes(MARKER), true);
  assert.equal(PROMPTS[5].body.includes("[직무 입력]"), true);
});

test("buildMarkdown은 제목과 원문 6개를 넣는다", () => {
  const markdown = buildMarkdown();
  assert.equal(markdown.startsWith(`# ${PAGE_TITLE}`), true);
  for (const item of PROMPTS) {
    assert.equal(markdown.includes(`## ${item.heading}`), true);
    assert.equal(markdown.includes(item.body), true);
  }
  assert.equal((markdown.match(/```/g) || []).length, 12);
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
