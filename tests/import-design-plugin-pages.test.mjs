// 디자인 플러그인·21st MCP 이관 헬퍼를 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import {
  DESIGN_PAGE_ID,
  DESIGN_SOURCE,
  DESIGN_TITLE,
  FIELDBY_SOURCE,
  FIELDBY_TITLE,
  TWENTYFIRST_SOURCE,
  TWENTYFIRST_TITLE,
  assert21stLiveHtml,
  build21stMarkdown,
  inlineMarkdown,
  isDuplicateRow,
  renderBlock,
  tableMarkdown,
} from "../scripts/import-design-plugin-pages.mjs";

test("inlineMarkdown은 하이라이트 마크를 무시하고 링크를 만든다", () => {
  assert.equal(
    inlineMarkdown([
      ["테이스트 스킬", [["a", "https://github.com/Leonxlnx/taste-skill"], ["h", "default"]]],
    ]),
    "[테이스트 스킬](https://github.com/Leonxlnx/taste-skill)"
  );
});

test("북마크는 빈 제목이면 URL을 링크로 둔다", () => {
  const markdown = renderBlock(
    {
      id: "bm",
      type: "bookmark",
      properties: { link: [["https://21st.dev/mcp"]] },
    },
    new Map()
  );
  assert.equal(markdown, "[https://21st.dev/mcp](https://21st.dev/mcp)");
});

test("할 일은 체크되지 않은 목록으로 렌더한다", () => {
  const markdown = renderBlock(
    {
      type: "to_do",
      properties: {
        title: [["모바일은 안 됩니다"]],
        checked: [["No"]],
      },
    },
    new Map()
  );
  assert.equal(markdown, "- [ ] 모바일은 안 됩니다");
});

test("fieldby 헤더는 sub_sub_header를 ##로 둔다", () => {
  const markdown = renderBlock(
    {
      type: "sub_sub_header",
      properties: { title: [["1️⃣ 테이스트 스킬 (Taste Skill)"]] },
    },
    new Map(),
    new Map(),
    new Set(),
    new Map(),
    { heading: { sub_sub_header: "##" } }
  );
  assert.equal(markdown, "## 1️⃣ 테이스트 스킬 (Taste Skill)");
});

test("표는 첫 행을 헤더로 둔다", () => {
  const table = {
    type: "table",
    format: { table_block_column_order: ["Yu><", "FPsV"] },
    content: ["r1", "r2"],
  };
  const blocks = new Map([
    ["r1", { properties: { "Yu><": [["방법"]], FPsV: [["언제 쓰나"]] } }],
    [
      "r2",
      {
        properties: {
          "Yu><": [["채팅으로 말하기"]],
          FPsV: [["레이아웃을 갈아엎을 때"]],
        },
      },
    ],
  ]);
  assert.equal(
    tableMarkdown(table, blocks),
    "| 방법 | 언제 쓰나 |\n| --- | --- |\n| 채팅으로 말하기 | 레이아웃을 갈아엎을 때 |"
  );
});

test("21st 마크다운은 원문 주소와 작업 명령을 넣는다", () => {
  const markdown = build21stMarkdown();
  assert.equal(markdown.includes(`# ${TWENTYFIRST_TITLE}`), true);
  assert.equal(markdown.includes(`[21st](${TWENTYFIRST_SOURCE})`), true);
  assert.equal(markdown.includes('21st search "pricing table"'), true);
  assert.equal(markdown.includes("API_KEY_21ST"), true);
  assert.equal(markdown.includes("fbclid"), false);
});

test("21st 라이브 HTML에 필수 문구가 없으면 중단한다", () => {
  assert.throws(() => assert21stLiveHtml("<html>empty</html>"), /21st 원문/);
  assert21stLiveHtml(
    "21st MCP API_KEY_21ST What do you want to do 21st search 21st generate 21st publish-theme 21st publish 21st components"
  );
});

test("중복은 제목 또는 원문 식별자면 스킵한다", () => {
  assert.equal(
    isDuplicateRow({ title: FIELDBY_TITLE, content: "x" }, FIELDBY_TITLE, [
      FIELDBY_SOURCE,
    ]),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: `원문 ${DESIGN_SOURCE}` },
      DESIGN_TITLE,
      [DESIGN_SOURCE, DESIGN_PAGE_ID]
    ),
    true
  );
  assert.equal(
    isDuplicateRow({ title: "다른 글", content: "없음" }, DESIGN_TITLE, [
      DESIGN_SOURCE,
    ]),
    false
  );
  assert.equal(
    isDuplicateRow(
      {
        title: FIELDBY_TITLE,
        content: `링크 ${TWENTYFIRST_SOURCE}`,
      },
      TWENTYFIRST_TITLE,
      [`원문. [21st](${TWENTYFIRST_SOURCE})`]
    ),
    false
  );
});
