// GPT IMAGE 2.0 API 투명 배경 사용 가이드 Notion 변환 헬퍼를 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import {
  NOTION_PAGE_ID,
  SOURCE_URL,
  buildMarkdown,
  documentStats,
  inlineMarkdown,
  renderBlock,
  tableMarkdown,
} from "../scripts/import-gpt-image-20-api-page.mjs";

test("inlineMarkdown은 a 마크를 href 기준으로 링크로 바꾼다", () => {
  assert.equal(
    inlineMarkdown([
      ["원문", [["a", SOURCE_URL]]],
    ]),
    `[원문](${SOURCE_URL})`
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
        properties: { title: [["투명 배경 설명"]] },
      },
    ],
  ]);
  assert.equal(
    renderBlock(blocks.get(toggleId), blocks),
    "**처음이면 이것부터**\n\n투명 배경 설명"
  );
});

test("토글 제목이 이미 볼드면 별표를 겹치지 않는다", () => {
  const markdown = renderBlock(
    {
      id: "toggle-bold",
      type: "toggle",
      properties: { title: [["방법 A 웹에서 바로 쓰기", [["b"]]]] },
    },
    new Map()
  );
  assert.equal(markdown, "**방법 A 웹에서 바로 쓰기**");
  assert.equal(markdown.includes("****"), false);
});

test("코드 블록은 python 펜스로 렌더한다", () => {
  const markdown = renderBlock(
    {
      type: "code",
      properties: {
        title: [['client.images.generate(\n  background="transparent"\n)']],
        language: [["Python"]],
      },
    },
    new Map()
  );
  assert.equal(
    markdown,
    '```python\nclient.images.generate(\n  background="transparent"\n)\n```'
  );
});

test("Plain Text 코드 블록은 text 펜스로 렌더한다", () => {
  const markdown = renderBlock(
    {
      type: "code",
      properties: {
        title: [["바닥 그림자와 반사 없이 인물만"]],
        language: [["Plain Text"]],
      },
    },
    new Map()
  );
  assert.equal(markdown, "```text\n바닥 그림자와 반사 없이 인물만\n```");
});

test("이미지 alt는 caption을 우선한다", () => {
  const imageId = "img";
  const src = "data:image/png;base64,xx";
  const markdown = renderBlock(
    {
      id: imageId,
      type: "image",
      properties: {
        title: [["openai-transparent-amber-parfum.png"]],
        caption: [["앰버 향수 병"]],
      },
    },
    new Map(),
    new Map([[imageId, src]])
  );
  assert.equal(markdown, `![앰버 향수 병](${src})`);
});

test("이미지 caption이 없으면 파일명을 alt로 둔다", () => {
  const imageId = "cta";
  const src = "data:image/png;base64,yy";
  const markdown = renderBlock(
    {
      id: imageId,
      type: "image",
      properties: { title: [["cta-banner.png"]] },
    },
    new Map(),
    new Map([[imageId, src]])
  );
  assert.equal(markdown, `![cta-banner.png](${src})`);
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

test("buildMarkdown은 원문 링크와 페이지 제목을 넣고 커버는 넣지 않는다", () => {
  const blocks = new Map([
    [
      NOTION_PAGE_ID,
      {
        id: NOTION_PAGE_ID,
        type: "page",
        properties: { title: [["GPT IMAGE 2.0 API 투명 배경 사용 가이드"]] },
        content: ["h"],
      },
    ],
    [
      "h",
      {
        id: "h",
        type: "sub_header",
        properties: { title: [["API·웹·앱 차이부터"]] },
      },
    ],
  ]);
  const { pageTitle, markdown } = buildMarkdown(
    blocks,
    NOTION_PAGE_ID,
    SOURCE_URL
  );
  assert.equal(pageTitle, "GPT IMAGE 2.0 API 투명 배경 사용 가이드");
  assert.equal(
    markdown.includes("# GPT IMAGE 2.0 API 투명 배경 사용 가이드"),
    true
  );
  assert.equal(markdown.includes(`[Notion](${SOURCE_URL})`), true);
  assert.equal(markdown.includes("## API·웹·앱 차이부터"), true);
  assert.equal(markdown.includes("![Notion 커버]"), false);
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
            marks: [{ type: "link", attrs: { href: SOURCE_URL } }],
          },
        ],
      },
    ],
  });
  const stats = documentStats(json);
  assert.equal(stats.images, 1);
  assert.equal(stats.tables, 1);
  assert.deepEqual(stats.hrefs, [SOURCE_URL]);
});
