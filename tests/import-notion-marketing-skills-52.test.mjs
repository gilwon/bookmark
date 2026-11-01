// 마케팅 스킬 52개 이관 스크립트의 주소와 콜아웃 규칙을 확인한다.
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
} from "../scripts/import-notion-marketing-skills-52.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-notion-marketing-skills-52.mjs",
);

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const first = readFileSync(SCRIPT_PATH, "utf8").split("\n")[0];
  assert.equal(first.startsWith("// "), true);
  assert.equal(/[가-힣]/.test(first), true);
});

test("깨진 자동 링크를 고치고 추적 쿼리를 뺀다", () => {
  assert.equal(SOURCE_URL.includes("?"), false);
  assert.equal(stripTracking("http://maily.so/josh)%EB%A1%9C"), "https://maily.so/josh");
  assert.equal(stripTracking("http://product-marketing.md"), "https://product-marketing.md/");
  assert.equal(
    stripTracking("https://www.youtube.com/@builderjoshkim?sub_confirmation=1&fbclid=IwAR"),
    "https://www.youtube.com/@builderjoshkim?sub_confirmation=1",
  );
  assert.equal(stripTracking("http://localhost:11235/mcp/sse"), "http://localhost:11235/mcp/sse");
});

test("콜아웃 안 번호 목록을 밖으로 꺼낸다", () => {
  const blocks = new Map();
  blocks.set(PAGE_ID, {
    id: PAGE_ID,
    type: "page",
    properties: { title: [[PAGE_TITLE]] },
    content: ["call"],
  });
  blocks.set("call", {
    id: "call",
    type: "callout",
    properties: { title: [[]] },
    content: ["intro", "step"],
  });
  blocks.set("intro", {
    id: "intro",
    type: "text",
    properties: { title: [["설치했는데 스킬이 안 뜨면"]] },
  });
  blocks.set("step", {
    id: "step",
    type: "numbered_list",
    properties: { title: [["폴더가 달라요"]] },
  });
  const markdown = markdownFromBlocks(blocks);
  assert.equal(markdown.includes(":::callout"), false);
  assert.equal(markdown.includes("설치했는데 스킬이 안 뜨면"), true);
  assert.equal(markdown.includes("1. 폴더가 달라요"), true);
  assert.equal(markdown.includes(SOURCE_URL), true);
});

test("깨진 메일리 자동 링크의 보이는 글자에서 괄호를 뺀다", () => {
  const blocks = new Map();
  blocks.set(PAGE_ID, {
    id: PAGE_ID,
    type: "page",
    properties: { title: [[PAGE_TITLE]] },
    content: ["line"],
  });
  blocks.set("line", {
    id: "line",
    type: "text",
    properties: {
      title: [
        ["제 뉴스레터 랜딩페이지("],
        ["maily.so/josh)로", [["a", "http://maily.so/josh)%EB%A1%9C"]]],
        [" 실제로 돌려 봤어요."],
      ],
    },
  });
  const markdown = markdownFromBlocks(blocks);
  assert.equal(markdown.includes("[maily.so/josh](https://maily.so/josh)"), true);
  assert.equal(markdown.includes(")로 실제로 돌려 봤어요."), true);
  assert.equal(markdown.includes("josh)로"), false);
  assert.equal(markdown.includes("josh)%"), false);
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
  assert.equal(source.includes("로컬과 운영 중 한쪽에만 글이 있습니다."), true);
});
