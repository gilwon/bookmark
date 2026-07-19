// Markdown 표 변환과 구형 Page 문서 마이그레이션을 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import { markdownToTiptapDoc } from "../src/lib/markdown-to-tiptap";
import {
  migrateLegacyMarkdownTablesInTiptapDoc,
  removeDuplicateLeadingTitle,
} from "../src/lib/migrate-aside-content";
import { tiptapToMarkdown } from "../src/lib/tiptap-to-markdown";

const markdown = `| 단계 | 하는 일 | 필요한 것 |
| --- | --- | --- |
| 1. 열쇠 발급 | API 신청 | 네이버 계정 |
| 2. 첫 실행 | 뉴스 수집 | 프롬프트 |`;

test("Markdown 표를 TableKit 노드로 변환하고 다시 내보낸다", () => {
  const doc = markdownToTiptapDoc(markdown);
  const table = doc.content?.[0];

  assert.equal(table?.type, "table");
  assert.equal(table?.content?.length, 3);
  assert.deepEqual(
    table?.content?.[0]?.content?.map((cell) => cell.type),
    ["tableHeader", "tableHeader", "tableHeader"]
  );
  assert.match(tiptapToMarkdown(doc), /\| 단계 \| 하는 일 \| 필요한 것 \|/);
});

test("한 문단으로 합쳐진 구형 표와 중복 제목을 복원한다", () => {
  const legacy = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "가이드" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: markdown.replace(/\n/g, " "),
          },
        ],
      },
    ],
  };

  const tables = migrateLegacyMarkdownTablesInTiptapDoc(legacy);
  const title = removeDuplicateLeadingTitle(tables.content, "가이드");
  const doc = title.content as {
    content: Array<{ type: string }>;
  };

  assert.equal(tables.changed, true);
  assert.equal(title.changed, true);
  assert.deepEqual(doc.content.map((node) => node.type), ["table"]);
});
