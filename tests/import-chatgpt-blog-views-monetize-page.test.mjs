// ChatGPT 블로그 조회수·수익화 Notion 페이지 변환 헬퍼를 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import {
  documentStats,
  inlineMarkdown,
  renderBlock,
} from "../scripts/import-chatgpt-blog-views-monetize-page.mjs";

test("inlineMarkdown은 a 마크를 href 기준으로 [text](href)로 바꾼다", () => {
  assert.equal(
    inlineMarkdown([
      [
        "https://open.kakao.com/o/g87MMj",
        [["a", "https://open.kakao.com/o/g87MMjIg"]],
      ],
    ]),
    "[https://open.kakao.com/o/g87MMj](https://open.kakao.com/o/g87MMjIg)"
  );
});

test("링크와 볼드가 겹치면 링크 문구에 **를 넣지 않는다", () => {
  assert.equal(
    inlineMarkdown([
      [
        "https://blog.naver.com/rldnjsrldnjs",
        [["a", "https://blog.naver.com/rldnjsrldnjs"], ["b"]],
      ],
    ]),
    "[https://blog.naver.com/rldnjsrldnjs](https://blog.naver.com/rldnjsrldnjs)"
  );
});

test("heading map은 header를 ##, sub_header를 ###로 만든다", () => {
  const blocks = new Map();
  assert.equal(
    renderBlock({ type: "header", properties: { title: [["제목"]] } }, blocks),
    "## 제목"
  );
  assert.equal(
    renderBlock(
      { type: "sub_header", properties: { title: [["소제목"]] } },
      blocks
    ),
    "### 소제목"
  );
});

test("빈 text 블록은 건너뛴다", () => {
  assert.equal(
    renderBlock({ type: "text", properties: { title: [["   "]] } }, new Map()),
    ""
  );
});

test("깨진 *[주제]** 원문을 고치지 않는다", () => {
  assert.equal(
    renderBlock(
      {
        type: "bulleted_list",
        properties: {
          title: [["*[주제]**에 대한 블로그 글을 작성해주세요."]],
        },
      },
      new Map()
    ),
    "- `*[주제]**에 대한 블로그 글을 작성해주세요.`"
  );
});

test("quote 자식은 각 줄 앞에 >를 붙인다", () => {
  const childId = "child";
  const quoteId = "quote";
  const blocks = new Map([
    [
      quoteId,
      {
        id: quoteId,
        type: "quote",
        properties: { title: [["사용법", [["b"]]]] },
        content: [childId],
      },
    ],
    [
      childId,
      {
        id: childId,
        type: "text",
        properties: { title: [["안쪽 설명"]] },
      },
    ],
  ]);
  assert.equal(
    renderBlock(blocks.get(quoteId), blocks),
    "> **사용법**\n> 안쪽 설명"
  );
});

test("documentStats는 링크 마크 수를 센다", () => {
  const json = JSON.stringify({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "원문",
            marks: [{ type: "link", attrs: { href: "https://example.com" } }],
          },
          {
            type: "text",
            text: "다른",
            marks: [{ type: "link", attrs: { href: "https://example.com/b" } }],
          },
        ],
      },
    ],
  });
  const stats = documentStats(json);
  assert.equal(stats.links, 2);
  assert.deepEqual(stats.hrefs, ["https://example.com", "https://example.com/b"]);
  assert.equal(stats.images, 0);
  assert.equal(stats.tables, 0);
});
