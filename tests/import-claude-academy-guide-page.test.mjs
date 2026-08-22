// 클로드 아카데미 가이드 Notion 변환 헬퍼를 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import {
  NOTION_PAGE_ID,
  buildMarkdown,
  documentStats,
  inlineMarkdown,
  renderBlock,
  tableMarkdown,
} from "../scripts/import-claude-academy-guide-page.mjs";

test("inlineMarkdown은 a 마크를 href 기준으로 링크로 바꾼다", () => {
  assert.equal(
    inlineMarkdown([
      ["Claude 101", [["a", "https://academy.claude.com/courses/claude-101"]]],
    ]),
    "[Claude 101](https://academy.claude.com/courses/claude-101)"
  );
});

test("하위 페이지는 펼치지 않고 Notion 링크로 둔다", () => {
  const nestedId = "d60fd99f-0e5f-8295-a947-81c6fd0e9948";
  const markdown = renderBlock(
    {
      id: nestedId,
      type: "page",
      properties: { title: [["프롬왓 | Prompt What"]] },
      content: ["never-fetched"],
    },
    new Map()
  );
  assert.equal(
    markdown,
    "[프롬왓 | Prompt What](https://www.notion.so/d60fd99f0e5f8295a94781c6fd0e9948)"
  );
});

test("토글은 제목과 자식을 함께 렌더한다", () => {
  const childId = "child";
  const toggleId = "toggle";
  const blocks = new Map([
    [
      toggleId,
      {
        id: toggleId,
        type: "toggle",
        properties: { title: [["처음이면 이것부터"]] },
        content: [childId],
      },
    ],
    [
      childId,
      {
        id: childId,
        type: "text",
        properties: { title: [["클로드 아카데미 설명"]] },
      },
    ],
  ]);
  assert.equal(
    renderBlock(blocks.get(toggleId), blocks),
    "**처음이면 이것부터**\n\n클로드 아카데미 설명"
  );
});

test("표는 첫 행을 헤더로 둔다", () => {
  const table = {
    type: "table",
    format: { table_block_column_order: ["a", "b"] },
    content: ["r1", "r2"],
  };
  const blocks = new Map([
    [
      "r1",
      { properties: { a: [["이런 분이라면"]], b: [["첫 강의"]] } },
    ],
    [
      "r2",
      { properties: { a: [["클로드가 처음이에요"]], b: [["Claude 101"]] } },
    ],
  ]);
  assert.equal(
    tableMarkdown(table, blocks),
    "| 이런 분이라면 | 첫 강의 |\n| --- | --- |\n| 클로드가 처음이에요 | Claude 101 |"
  );
});

test("buildMarkdown은 원문 링크와 페이지 제목을 넣는다", () => {
  const blocks = new Map([
    [
      NOTION_PAGE_ID,
      {
        id: NOTION_PAGE_ID,
        type: "page",
        properties: { title: [["🎓 클로드 공식 무료 강의 시작 가이드"]] },
        content: ["h"],
      },
    ],
    [
      "h",
      {
        id: "h",
        type: "sub_header",
        properties: { title: [["한 줄 정리"]] },
      },
    ],
  ]);
  const { pageTitle, markdown } = buildMarkdown(
    blocks,
    NOTION_PAGE_ID,
    "https://example.com/source"
  );
  assert.equal(pageTitle, "🎓 클로드 공식 무료 강의 시작 가이드");
  assert.equal(markdown.includes("# 🎓 클로드 공식 무료 강의 시작 가이드"), true);
  assert.equal(markdown.includes("[Notion](https://example.com/source)"), true);
  assert.equal(markdown.includes("## 한 줄 정리"), true);
});

test("documentStats는 이미지와 링크를 센다", () => {
  const json = JSON.stringify({
    type: "doc",
    content: [
      { type: "image", attrs: { src: "data:image/png;base64,xx" } },
      { type: "table", content: [] },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "원문",
            marks: [{ type: "link", attrs: { href: "https://example.com" } }],
          },
        ],
      },
    ],
  });
  const stats = documentStats(json);
  assert.equal(stats.images, 1);
  assert.equal(stats.tables, 1);
  assert.deepEqual(stats.hrefs, ["https://example.com"]);
});
