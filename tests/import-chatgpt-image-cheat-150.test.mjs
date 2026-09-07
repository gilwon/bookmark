// Notion 챗GPT 이미지 생성 치트키 150개 Pages 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  EXPECTED_ATTACHMENTS,
  EXPECTED_IMAGES,
  PAGE_HEX,
  PAGE_TITLE,
  SOURCE_URL,
  commandCount,
  hasNoExpiredUrl,
  isDuplicateRow,
  stripTracking,
} from "../scripts/import-chatgpt-image-cheat-150.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-chatgpt-image-cheat-150.mjs"
);

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// Notion 챗GPT 이미지 생성 치트키 150개를 Pages에만 저장한다"
  );
});

test("PAGE_TITLE과 SOURCE_URL 상수다", () => {
  assert.equal(PAGE_TITLE, "챗GPT 이미지 생성 치트키 150개");
  assert.equal(
    SOURCE_URL,
    "https://app.notion.com/p/GPT-150-3d289afb51cb804ab06cf1b0f2f66702"
  );
  assert.equal(PAGE_HEX, "3d289afb51cb804ab06cf1b0f2f66702");
  assert.equal(SOURCE_URL.includes(PAGE_HEX), true);
  assert.equal(SOURCE_URL.includes("?"), false);
  assert.equal(EXPECTED_IMAGES, 2);
  assert.equal(EXPECTED_ATTACHMENTS, 0);
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
  const markers = [SOURCE_URL, PAGE_HEX];
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
      {
        title: "ChatGPT 이미지 치트키 100개 총정리",
        source_url:
          "https://fieldby.notion.site/ChatGPT-100-3ced730b395381dda7b2c5a8d3516839",
        content: "원문 3ced730b395381dda7b2c5a8d3516839",
      },
      PAGE_TITLE,
      markers
    ),
    false
  );
});

test("CATEGORY/Prompts 저장 코드가 없다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
});

test("commandCount는 헤더를 빼고 슬래시 코드만 센다", () => {
  const blocks = new Map([
    [
      "h",
      {
        type: "table_row",
        properties: {
          a: [["#"]],
          b: [["코드"]],
          c: [["설명"]],
        },
      },
    ],
    [
      "r1",
      {
        type: "table_row",
        properties: {
          a: [["001"]],
          b: [["/lowangle"]],
          c: [["피사체를 아래에서"]],
        },
      },
    ],
    [
      "r2",
      {
        type: "table_row",
        properties: {
          a: [["002"]],
          b: [["/highangle"]],
          c: [["피사체를 위에서"]],
        },
      },
    ],
    ["other", { type: "text", properties: { title: [["/not-a-row"]] } }],
  ]);
  assert.equal(commandCount(blocks), 2);
});
