// 클로드 learn 스킬 3분 가이드 이관을 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildMarkdown } from "../scripts/import-claude-eli5-page.mjs";
import {
  CONTENT_HREFS,
  EXPECTED_TITLE,
  NOTION_PAGE_HEX,
  NOTION_PAGE_ID,
  PLACEHOLDERS,
  SOURCE_URL,
  isDuplicateRow,
  preprocessBlocks,
  scopeBlocks,
  stripTracking,
} from "../scripts/import-notion-learn-skill-3min.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-notion-learn-skill-3min.mjs"
);

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 클로드 learn 스킬 3분 가이드를 Pages에만 저장한다"
  );
});

test("제목과 저장 URL은 Notion 원문 그대로다", () => {
  assert.equal(
    EXPECTED_TITLE,
    "클로드 '학습의 신' 모드 — learn 스킬 켜는 법 (3분)"
  );
  assert.equal(NOTION_PAGE_ID, "3e8bc8af-735e-81e2-a399-fc2d47d80b00");
  assert.equal(NOTION_PAGE_HEX, "3e8bc8af735e81e2a399fc2d47d80b00");
  assert.equal(SOURCE_URL, "https://app.notion.com/p/3e8bc8af735e81e2a399fc2d47d80b00");
  assert.equal(SOURCE_URL.includes("source=copy_link"), false);
  assert.equal(SOURCE_URL.includes(NOTION_PAGE_HEX), true);
});

test("stripTracking은 source=copy_link를 빼고 http를 https로 바꾼다", () => {
  const dirty = `${SOURCE_URL}?source=copy_link&utm_source=share&fbclid=IwAR123&pvs=21`;
  assert.equal(stripTracking(dirty), SOURCE_URL);
  assert.equal(stripTracking("http://claude.ai"), "https://claude.ai");
  assert.equal(
    stripTracking("https://turnflow.link/@use-ai-likejimin"),
    "https://turnflow.link/@use-ai-likejimin"
  );
  assert.equal(stripTracking("http://claude.ai"), CONTENT_HREFS[0]);
  assert.deepEqual(CONTENT_HREFS, [
    "https://claude.ai",
    "https://turnflow.link/@use-ai-likejimin",
  ]);
});

test("자리 표시 3줄은 콜아웃 자식으로 남고 추적 쿼리는 빠진다", () => {
  const pageId = NOTION_PAGE_ID;
  const blocks = new Map([
    [
      pageId,
      {
        id: pageId,
        type: "page",
        properties: { title: [[EXPECTED_TITLE]] },
        content: ["c1", "c2", "c3", "link", "turn", "child-page"],
      },
    ],
    ["c1", { id: "c1", type: "callout", properties: {}, content: ["p1"] }],
    ["p1", { id: "p1", type: "text", properties: { title: [[PLACEHOLDERS[0]]] } }],
    ["c2", { id: "c2", type: "callout", properties: {}, content: ["p2"] }],
    ["p2", { id: "p2", type: "text", properties: { title: [[PLACEHOLDERS[1]]] } }],
    ["c3", { id: "c3", type: "callout", properties: {}, content: ["p3"] }],
    ["p3", { id: "p3", type: "text", properties: { title: [[PLACEHOLDERS[2]]] } }],
    [
      "link",
      {
        id: "link",
        type: "text",
        properties: {
          title: [
            ["PC에서 하세요. "],
            ["claude.ai", [["a", "http://claude.ai?source=copy_link&fbclid=IwAR"]]],
          ],
        },
      },
    ],
    [
      "turn",
      {
        id: "turn",
        type: "text",
        properties: {
          title: [["지민", [["a", "https://turnflow.link/@use-ai-likejimin?utm_source=share"]]]],
        },
      },
    ],
    [
      "child-page",
      {
        id: "child-page",
        type: "page",
        properties: { title: [["하위"]] },
        content: ["nested-image"],
      },
    ],
    [
      "nested-image",
      { id: "nested-image", type: "image", properties: { source: [["https://example.com/a.png"]] } },
    ],
    ["outside-image", { id: "outside-image", type: "image" }],
  ]);
  const scoped = scopeBlocks(blocks, pageId);
  assert.equal(scoped.has("p1"), true);
  assert.equal(scoped.has("p2"), true);
  assert.equal(scoped.has("p3"), true);
  assert.equal(scoped.has("nested-image"), false);
  assert.equal(scoped.has("outside-image"), false);
  preprocessBlocks(scoped);
  const built = buildMarkdown(scoped, pageId, SOURCE_URL);
  for (const line of PLACEHOLDERS) {
    assert.equal(built.markdown.includes(line), true, line);
  }
  assert.equal(built.markdown.includes("https://claude.ai"), true);
  assert.equal(built.markdown.includes("http://claude.ai"), false);
  assert.equal(built.markdown.includes("source=copy_link"), false);
  assert.equal(built.markdown.includes("fbclid"), false);
  assert.equal(built.markdown.includes("utm_source"), false);
  assert.equal(
    built.markdown.includes("https://turnflow.link/@use-ai-likejimin"),
    true
  );
  assert.equal(built.pageTitle, EXPECTED_TITLE);
});

test("isDuplicateRow는 제목 또는 hex로 true다", () => {
  assert.equal(
    isDuplicateRow({ title: EXPECTED_TITLE, source_url: "https://example.com" }, EXPECTED_TITLE, NOTION_PAGE_HEX),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", source_url: SOURCE_URL, content: "같은 본문" },
      EXPECTED_TITLE,
      NOTION_PAGE_HEX
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      {
        title: "다른 글",
        source_url: "https://app.notion.com/p/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        content: EXPECTED_TITLE,
      },
      EXPECTED_TITLE,
      NOTION_PAGE_HEX
    ),
    false
  );
  assert.equal(isDuplicateRow(null, EXPECTED_TITLE, NOTION_PAGE_HEX), false);
});

test("Prompts 저장과 기존 행 갱신 코드가 없다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(/from\(["']prompts["']\)/.test(source), false);
  assert.equal(/update\s+custom_pages/i.test(source), false);
  assert.equal(source.includes(".update("), false);
});
