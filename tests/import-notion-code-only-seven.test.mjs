// Claude Code 코드로만 되는 일 7가지 이관 스크립트의 주소와 링크 규칙을 확인한다.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PAGE_ID,
  PAGE_TITLE,
  SOURCE_URL,
  isDuplicateRow,
  markdownFromBlocks,
  stripTracking,
} from "../scripts/import-notion-code-only-seven.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-notion-code-only-seven.mjs",
);

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const first = readFileSync(SCRIPT_PATH, "utf8").split("\n")[0];
  assert.equal(first.startsWith("// "), true);
  assert.equal(/[가-힣]/.test(first), true);
});

test("저장 주소에 추적 쿼리가 없고 인스타그램 끝 슬래시를 뺀다", () => {
  assert.equal(SOURCE_URL, "https://app.notion.com/p/edab256827ac83128b578171564aeef9");
  assert.equal(SOURCE_URL.includes("?"), false);
  assert.equal(stripTracking("http://CLAUDE.md"), "https://claude.md/");
  assert.equal(
    stripTracking("https://www.instagram.com/godseng.mom/?igsh=1"),
    "https://www.instagram.com/godseng.mom",
  );
  assert.equal(stripTracking("https://instagram.com/godseng.mom/"), "https://www.instagram.com/godseng.mom");
  assert.equal(stripTracking("http://localhost:11235/mcp/sse"), "http://localhost:11235/mcp/sse");
  assert.equal(
    stripTracking("https://l.threads.com/?u=https%3A%2F%2Fexample.com%2Fa%3Ffbclid%3DIwAR&e=1"),
    "https://example.com/a",
  );
});

test("빈 제목 북마크와 http 링크를 저장 주소로 바꾼다", () => {
  const blocks = new Map();
  blocks.set(PAGE_ID, {
    id: PAGE_ID,
    type: "page",
    properties: { title: [[PAGE_TITLE]] },
    content: ["head", "mark", "rule"],
  });
  blocks.set("head", {
    id: "head",
    type: "sub_sub_header",
    properties: {
      title: [["2주차 · ③ "], ["CLAUDE.md", [["a", "http://CLAUDE.md"]]], ["에 내 규칙 적어두기"]],
    },
  });
  blocks.set("mark", {
    id: "mark",
    type: "bookmark",
    properties: { link: [["https://www.instagram.com/godseng.mom/"]] },
    format: { bookmark_url: "https://www.instagram.com/godseng.mom/" },
  });
  blocks.set("rule", { id: "rule", type: "divider" });
  const markdown = markdownFromBlocks(blocks);
  assert.equal(markdown.startsWith(`# ${PAGE_TITLE}`), true);
  assert.equal(markdown.includes(`[CLAUDE.md](https://claude.md/)`), true);
  assert.equal(/http:\/\/claude\.md/i.test(markdown), false);
  assert.equal(markdown.includes("https://www.instagram.com/godseng.mom"), true);
  assert.equal(markdown.includes("godseng.mom/"), false);
  assert.equal(markdown.includes("---"), true);
  assert.equal(markdown.includes(SOURCE_URL), true);
});

test("isDuplicateRow는 제목 또는 원문 주소만 본다", () => {
  assert.equal(isDuplicateRow({ title: PAGE_TITLE, source_url: "다른" }, PAGE_TITLE, [SOURCE_URL]), true);
  assert.equal(
    isDuplicateRow({ title: "다른", source_url: `${SOURCE_URL}?pvs=39` }, PAGE_TITLE, [SOURCE_URL]),
    true,
  );
  assert.equal(isDuplicateRow({ title: "다른", content: SOURCE_URL }, PAGE_TITLE, [SOURCE_URL]), false);
  assert.equal(isDuplicateRow({ title: "다른", source_url: "" }, PAGE_TITLE, [SOURCE_URL]), false);
  assert.equal(isDuplicateRow(null, PAGE_TITLE, [SOURCE_URL]), false);
});

test("스크립트는 Prompts 테이블과 행 갱신을 쓰지 않는다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes(".update({"), false);
  assert.equal(source.includes(".upsert("), false);
  assert.equal(source.includes(".or("), false);
  assert.equal(source.includes("UPDATE custom_pages"), false);
  assert.equal(source.includes("content LIKE"), false);
  assert.equal(source.includes("3c0c680c75f080dcadc0fb3b0f069912"), false);
  assert.equal(source.includes("로컬과 운영 중 한쪽에만 글이 있습니다."), true);
});
