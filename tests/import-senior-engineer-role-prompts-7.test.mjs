// 시니어 엔지니어 역할 프롬프트 7개 페이지 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import {
  EXISTING_TITLE,
  MARKER,
  PAGE_TITLE,
  PROMPTS,
  buildMarkdown,
  isDuplicateRow,
} from "../scripts/import-senior-engineer-role-prompts-7.mjs";

test("프롬프트는 7개이고 기존 모드 7가지 제목과 다르다", () => {
  assert.equal(PROMPTS.length, 7);
  assert.notEqual(PAGE_TITLE, EXISTING_TITLE);
  assert.equal(PROMPTS[0].body.includes(MARKER), true);
  assert.equal(PROMPTS[5].heading.includes("멀티 에이전트"), true);
  assert.equal(PROMPTS[6].body.includes("Props 설계"), true);
});

test("buildMarkdown은 제목과 원문 7개를 넣고 기존 제목은 넣지 않는다", () => {
  const markdown = buildMarkdown();
  assert.equal(markdown.startsWith(`# ${PAGE_TITLE}`), true);
  assert.equal(markdown.includes(`# ${EXISTING_TITLE}`), false);
  for (const item of PROMPTS) {
    assert.equal(markdown.includes(`## ${item.heading}`), true);
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
      { title: EXISTING_TITLE, content: "시니어 풀스택 엔지니어처럼 행동해." },
      PAGE_TITLE,
      [MARKER]
    ),
    false
  );
  assert.equal(
    isDuplicateRow({ title: "다른 글", content: "없음" }, PAGE_TITLE, [MARKER]),
    false
  );
});
