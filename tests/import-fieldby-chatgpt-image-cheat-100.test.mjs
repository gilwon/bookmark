// fieldby ChatGPT 이미지 치트키 100개 Pages 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { tableMarkdown } from "../scripts/import-claude-eli5-page.mjs";
import {
  PAGE_HEX,
  PAGE_TITLE,
  SOURCE_URL,
  commandCount,
  hasNoExpiredUrl,
  isDuplicateRow,
  stripTracking,
} from "../scripts/import-fieldby-chatgpt-image-cheat-100.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-fieldby-chatgpt-image-cheat-100.mjs"
);

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// fieldby Notion ChatGPT 이미지 치트키 100개를 Pages에만 저장한다"
  );
});

test("PAGE_TITLE과 SOURCE_URL 상수다", () => {
  assert.equal(PAGE_TITLE, "ChatGPT 이미지 치트키 100개 총정리");
  assert.equal(
    SOURCE_URL,
    "https://fieldby.notion.site/ChatGPT-100-3ced730b395381dda7b2c5a8d3516839"
  );
  assert.equal(PAGE_HEX, "3ced730b395381dda7b2c5a8d3516839");
  assert.equal(SOURCE_URL.includes(PAGE_HEX), true);
});

test("stripTracking은 source=copy_link를 뺀다", () => {
  const dirty = `${SOURCE_URL}?source=copy_link&utm_source=share&fbclid=IwAR123&pvs=21`;
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes("source=copy_link"), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("pvs"), false);
  assert.equal(cleaned, SOURCE_URL);
});

test("만료 URL 문자열이 본문에 없으면 true다", () => {
  assert.equal(hasNoExpiredUrl("# 제목\n\n본문입니다."), true);
  assert.equal(
    hasNoExpiredUrl("https://prod-files-secure.s3.us-west-2.amazonaws.com/x"),
    false
  );
  assert.equal(hasNoExpiredUrl("https://file.notion.so/f"), false);
  assert.equal(hasNoExpiredUrl("https://example.com/?X-Amz-Signature=1"), false);
  assert.equal(hasNoExpiredUrl("expirationTimestamp=1"), false);
  assert.equal(hasNoExpiredUrl("blob:https://example.com/1"), false);
  assert.equal(hasNoExpiredUrl("https://x.com/?fbclid=IwAR"), false);
  assert.equal(hasNoExpiredUrl("https://x.com/?utm_source=ig"), false);
});

test("isDuplicateRow는 제목 또는 hex로 true다", () => {
  const markers = [PAGE_HEX];
  assert.equal(
    isDuplicateRow({ title: PAGE_TITLE, content: "x" }, PAGE_TITLE, markers),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: `원문 ${PAGE_HEX}` },
      PAGE_TITLE,
      markers
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", source_url: SOURCE_URL, content: "없음" },
      PAGE_TITLE,
      markers
    ),
    true
  );
  assert.equal(
    isDuplicateRow({ title: "다른 글", content: "없음" }, PAGE_TITLE, markers),
    false
  );
});

test("tableMarkdown은 명령어 열 순서를 유지한다", () => {
  const blocks = new Map([
    [
      "row0",
      {
        type: "table_row",
        properties: {
          TDlg: [["명령어", [["b"]]]],
          Ahpa: [["효과", [["b"]]]],
        },
      },
    ],
    [
      "row1",
      {
        type: "table_row",
        properties: {
          TDlg: [["/goldenhour", [["c"]]]],
          Ahpa: [["해 질 녘 황금빛"]],
        },
      },
    ],
  ]);
  const markdown = tableMarkdown(
    {
      type: "table",
      format: { table_block_column_order: ["TDlg", "Ahpa"] },
      content: ["row0", "row1"],
    },
    blocks
  );
  assert.equal(
    markdown,
    "| **명령어** | **효과** |\n| --- | --- |\n| `/goldenhour` | 해 질 녘 황금빛 |"
  );
});

test("commandCount는 헤더를 빼고 슬래시 명령만 센다", () => {
  const blocks = new Map([
    [
      "h",
      {
        type: "table_row",
        properties: {
          a: [["명령어"]],
          b: [["효과"]],
        },
      },
    ],
    [
      "r1",
      {
        type: "table_row",
        properties: {
          a: [["/droneview"]],
          b: [["드론 항공샷"]],
        },
      },
    ],
    [
      "r2",
      {
        type: "table_row",
        properties: {
          a: [["/35mmfilm"]],
          b: [["35mm 필름 사진"]],
        },
      },
    ],
    ["other", { type: "text", properties: { title: [["/not-a-row"]] } }],
  ]);
  assert.equal(commandCount(blocks), 2);
});
