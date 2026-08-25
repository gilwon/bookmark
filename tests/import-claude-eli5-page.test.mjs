// ELI5 Notion 페이지 변환 헬퍼를 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import {
  NOTION_PAGE_ID,
  SOURCE_URL,
  assertDownloadableAttachment,
  buildMarkdown,
  documentStats,
  inlineMarkdown,
  isZipBytes,
  renderBlock,
  tableMarkdown,
} from "../scripts/import-claude-eli5-page.mjs";

test("inlineMarkdown은 a 마크를 href 기준으로 링크로 바꾼다", () => {
  assert.equal(
    inlineMarkdown([
      [
        "ELI5 플러그인 소스",
        [["a", "https://github.com/anthropics/claude-plugins-community/tree/main/eli5"]],
      ],
    ]),
    "[ELI5 플러그인 소스](https://github.com/anthropics/claude-plugins-community/tree/main/eli5)"
  );
});

test("링크와 볼드가 겹치면 링크 문구에 **를 넣지 않는다", () => {
  assert.equal(
    inlineMarkdown([
      [
        "구성 참고 페이지",
        [["a", "https://app.notion.com/p/3c5d596ff5bd80cc8314f386247910a6"], ["b"]],
      ],
    ]),
    "[구성 참고 페이지](https://app.notion.com/p/3c5d596ff5bd80cc8314f386247910a6)"
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
        properties: { title: [["이미 Claude Code 안에 있다면"]] },
        content: [childId],
      },
    ],
    [
      childId,
      {
        id: childId,
        type: "text",
        properties: { title: [["아래 슬래시 명령어를 사용하세요."]] },
      },
    ],
  ]);
  assert.equal(
    renderBlock(blocks.get(toggleId), blocks),
    "**이미 Claude Code 안에 있다면**\n\n아래 슬래시 명령어를 사용하세요."
  );
});

test("토글 제목이 이미 볼드면 별표를 겹치지 않는다", () => {
  const markdown = renderBlock(
    {
      id: "toggle-bold",
      type: "toggle",
      properties: { title: [["이미 Claude Code 안에 있다면", [["b"]]]] },
    },
    new Map()
  );
  assert.equal(markdown, "**이미 Claude Code 안에 있다면**");
  assert.equal(markdown.includes("****"), false);
});

test("Shell 코드는 shell 펜스로, Plain Text는 text 펜스로 렌더한다", () => {
  assert.equal(
    renderBlock(
      {
        type: "code",
        properties: {
          title: [["claude plugin list"]],
          language: [["Shell"]],
        },
      },
      new Map()
    ),
    "```shell\nclaude plugin list\n```"
  );
  assert.equal(
    renderBlock(
      {
        type: "code",
        properties: {
          title: [["/plugin install eli5@claude-community"]],
          language: [["Plain Text"]],
        },
      },
      new Map()
    ),
    "```text\n/plugin install eli5@claude-community\n```"
  );
});

test("표는 첫 행을 헤더로 두고 인라인 코드를 유지한다", () => {
  const table = {
    type: "table",
    format: { table_block_column_order: ["va[H", "JGOE"] },
    content: ["r1", "r2"],
  };
  const blocks = new Map([
    [
      "r1",
      { properties: { "va[H": [["증상"]], JGOE: [["해결법"]] } },
    ],
    [
      "r2",
      {
        properties: {
          "va[H": [["claude: command not found", [["c"]]]],
          JGOE: [["터미널을 다시 여세요."]],
        },
      },
    ],
  ]);
  assert.equal(
    tableMarkdown(table, blocks),
    "| 증상 | 해결법 |\n| --- | --- |\n| `claude: command not found` | 터미널을 다시 여세요. |"
  );
});

test("이미지 alt는 caption을 우선하고 data URL을 쓴다", () => {
  const imageId = "img";
  const src = "data:image/png;base64,xx";
  const markdown = renderBlock(
    {
      id: imageId,
      type: "image",
      properties: {
        title: [["guide.png"]],
        caption: [["설치 화면"]],
      },
    },
    new Map(),
    new Map([[imageId, src]])
  );
  assert.equal(markdown, `![설치 화면](${src})`);
});

test("이미지 caption이 없으면 파일명을 alt로 둔다", () => {
  const imageId = "img2";
  const src = "data:image/png;base64,yy";
  const markdown = renderBlock(
    {
      id: imageId,
      type: "image",
      properties: { title: [["guide.png"]] },
    },
    new Map(),
    new Map([[imageId, src]])
  );
  assert.equal(markdown, `![guide.png](${src})`);
});

test("file/pdf는 다운로드 가능한 데이터 URL 링크로 렌더한다", () => {
  const fileId = "file1";
  const href = "data:application/pdf;base64,AAAA";
  const markdown = renderBlock(
    {
      id: fileId,
      type: "file",
      properties: { title: [["guide.pdf"]] },
    },
    new Map(),
    new Map(),
    new Set(),
    new Map([[fileId, `[guide.pdf](${href})`]])
  );
  assert.equal(markdown, `[guide.pdf](${href})`);
});

test("ZIP 첨부는 화이트리스트 없이 저장하지 않는다", () => {
  const zip = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x00]);
  assert.equal(isZipBytes(zip, "pack.bin"), true);
  assert.throws(
    () => assertDownloadableAttachment("pack.zip", zip, "application/zip"),
    /page-attachment-storage/
  );
});

test("PDF 첨부는 data URL 링크로 고정한다", () => {
  const pdf = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
  const markdown = assertDownloadableAttachment(
    "note.pdf",
    pdf,
    "application/pdf"
  );
  assert.equal(markdown.startsWith("[note.pdf](data:application/pdf;base64,"), true);
  assert.equal(markdown.includes("X-Amz"), false);
});

test("buildMarkdown은 원문 링크와 페이지 제목을 넣고 커버는 넣지 않는다", () => {
  const blocks = new Map([
    [
      NOTION_PAGE_ID,
      {
        id: NOTION_PAGE_ID,
        type: "page",
        properties: {
          title: [["[AI Brief] Claude Code ELI5 설치 가이드 및 실무 활용 프롬프트"]],
        },
        content: ["h"],
      },
    ],
    [
      "h",
      {
        id: "h",
        type: "sub_header",
        properties: { title: [["2. 설치 확인"]] },
      },
    ],
  ]);
  const { pageTitle, markdown } = buildMarkdown(
    blocks,
    NOTION_PAGE_ID,
    SOURCE_URL
  );
  assert.equal(
    pageTitle,
    "[AI Brief] Claude Code ELI5 설치 가이드 및 실무 활용 프롬프트"
  );
  assert.equal(
    markdown.includes("# [AI Brief] Claude Code ELI5 설치 가이드 및 실무 활용 프롬프트"),
    true
  );
  assert.equal(markdown.includes(`[Notion](${SOURCE_URL})`), true);
  assert.equal(markdown.includes("## 2. 설치 확인"), true);
  assert.equal(markdown.includes("![Notion 커버]"), false);
});

test("documentStats는 이미지와 첨부 링크를 구분한다", () => {
  const json = JSON.stringify({
    type: "doc",
    content: [
      { type: "image", attrs: { src: "data:image/png;base64,xx" } },
      { type: "table", content: [] },
      { type: "codeBlock", attrs: { language: "shell" } },
      { type: "callout", content: [] },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "원문",
            marks: [{ type: "link", attrs: { href: SOURCE_URL } }],
          },
          {
            type: "text",
            text: "가이드.pdf",
            marks: [
              {
                type: "link",
                attrs: { href: "data:application/pdf;base64,AA" },
              },
            ],
          },
        ],
      },
    ],
  });
  const stats = documentStats(json);
  assert.equal(stats.images, 1);
  assert.equal(stats.tables, 1);
  assert.equal(stats.codes, 1);
  assert.equal(stats.callouts, 1);
  assert.equal(stats.attachments, 1);
  assert.equal(stats.hrefs.includes(SOURCE_URL), true);
});
