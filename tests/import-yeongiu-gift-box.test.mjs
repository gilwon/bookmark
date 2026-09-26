// 연기우 특별선물함 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildMarkdown } from "../scripts/import-claude-eli5-page.mjs";
import {
  LIST_HEX,
  LIST_PAGE_ID,
  REQUEST_GAP_MS,
  RETRY_WAITS_MS,
  isDuplicateRow,
  preprocessBlocks,
  scopeBlocks,
  selectListPages,
  storedTitleOf,
  stripTracking,
  targetsFromItems,
} from "../scripts/import-yeongiu-gift-box.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-yeongiu-gift-box.mjs"
);

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 연기우 특별선물함 하위 글 중 Pages에 없는 것만 저장한다"
  );
});

test("목록에서는 page 자식만 고르고 안내 문구는 뺀다", () => {
  const pageId = "362fec6d-90d2-8043-b955-f026c5872b2d";
  const secondId = "35ffec6d-90d2-81ea-ab82-e25793e468fa";
  const blocks = new Map([
    [
      LIST_PAGE_ID,
      {
        id: LIST_PAGE_ID,
        type: "page",
        properties: { title: [["연기우 특별선물함"]] },
        content: [pageId, "notice-text", "notice-callout", secondId, LIST_PAGE_ID],
      },
    ],
    [
      pageId,
      {
        id: pageId,
        type: "page",
        properties: { title: [["1.유미의세포 스타일 프롬프트"]] },
      },
    ],
    [
      "notice-text",
      {
        id: "notice-text",
        type: "text",
        properties: { title: [["(⏳ 추가 업로드 진행중…)"]] },
      },
    ],
    [
      "notice-callout",
      {
        id: "notice-callout",
        type: "callout",
        properties: { title: [["추가 업로드 진행중"]] },
      },
    ],
    [
      secondId,
      {
        id: secondId,
        type: "page",
        properties: { title: [["2.클로드 프롬프트 36+5"]] },
      },
    ],
  ]);
  const items = selectListPages(blocks, LIST_PAGE_ID);
  assert.deepEqual(
    items.map((item) => item.title),
    ["1.유미의세포 스타일 프롬프트", "2.클로드 프롬프트 36+5"]
  );
  assert.equal(items[0].hex, "362fec6d90d28043b955f026c5872b2d");
  assert.equal(
    items[0].sourceUrl,
    "https://app.notion.com/p/362fec6d90d28043b955f026c5872b2d"
  );
  assert.equal(items.some((item) => item.id === LIST_PAGE_ID), false);
  assert.equal(items.some((item) => String(item.title).includes("추가 업로드")), false);
  const fromItems = targetsFromItems([
    ...items,
    {
      id: LIST_PAGE_ID,
      hex: LIST_HEX,
      title: "연기우 특별선물함",
    },
    {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      hex: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      title: "(⏳ 추가 업로드 진행중…)",
    },
  ]);
  assert.equal(fromItems.length, 2);
  assert.equal(storedTitleOf("1.유미의세포 스타일 프롬프트"), "1.유미의세포 스타일 프롬프트");
});

test("다른 페이지의 이미지와 파일은 렌더 범위에서 뺀다", () => {
  const pageId = "362fec6d-90d2-8043-b955-f026c5872b2d";
  const childId = "35ffec6d-90d2-81ea-ab82-e25793e468fa";
  const blocks = new Map([
    [
      pageId,
      {
        id: pageId,
        type: "page",
        properties: { title: [["1.유미의세포 스타일 프롬프트"]] },
        content: ["text-1", childId],
      },
    ],
    [
      "text-1",
      {
        id: "text-1",
        type: "text",
        properties: { title: [["본문"]] },
      },
    ],
    [
      childId,
      {
        id: childId,
        type: "page",
        properties: { title: [["하위 페이지"]] },
        content: ["foreign-image", "foreign-file"],
      },
    ],
    [
      "foreign-image",
      { id: "foreign-image", type: "image", properties: { source: [["https://example.com/a.png"]] } },
    ],
    [
      "foreign-file",
      { id: "foreign-file", type: "file", properties: { title: [["a.zip"]] } },
    ],
    [
      "outside-image",
      { id: "outside-image", type: "image" },
    ],
  ]);
  const scoped = scopeBlocks(blocks, pageId);
  assert.equal(scoped.has("foreign-image"), false);
  assert.equal(scoped.has("foreign-file"), false);
  assert.equal(scoped.has("outside-image"), false);
  assert.equal(scoped.has(childId), true);
  const built = buildMarkdown(
    scoped,
    pageId,
    "https://app.notion.com/p/362fec6d90d28043b955f026c5872b2d",
    new Map(),
    new Map()
  );
  assert.match(built.markdown, /\[하위 페이지\]\(https:\/\/www\.notion\.so\/35ffec6d90d281eaab82e25793e468fa\)/);
  assert.equal(built.pageTitle, "1.유미의세포 스타일 프롬프트");
});

test("bookmark은 링크 문단이 되고 추적 쿼리는 빠진다", () => {
  const pageId = "362fec6d-90d2-8043-b955-f026c5872b2d";
  const bookmarkId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const blocks = new Map([
    [
      pageId,
      {
        id: pageId,
        type: "page",
        properties: { title: [["1.유미의세포 스타일 프롬프트"]] },
        content: [bookmarkId, "text-1"],
      },
    ],
    [
      bookmarkId,
      {
        id: bookmarkId,
        type: "bookmark",
        properties: {
          title: [["예시"]],
          link: [["http://example.com/a?utm_source=share&fbclid=IwAR&source=copy_link"]],
        },
      },
    ],
    [
      "text-1",
      {
        id: "text-1",
        type: "text",
        properties: {
          title: [
            ["안내 "],
            ["바로가기", [["a", "http://example.com/b?fbclid=1"]]],
          ],
        },
      },
    ],
  ]);
  preprocessBlocks(blocks);
  const built = buildMarkdown(
    blocks,
    pageId,
    "https://app.notion.com/p/362fec6d90d28043b955f026c5872b2d",
    new Map(),
    new Map()
  );
  assert.match(built.markdown, /\[예시\]\(https:\/\/example\.com\/a\)/);
  assert.match(built.markdown, /\[바로가기\]\(https:\/\/example\.com\/b\)/);
  assert.equal(built.markdown.includes("utm_source"), false);
  assert.equal(built.markdown.includes("fbclid"), false);
  assert.equal(built.markdown.includes("source=copy_link"), false);
  assert.equal(built.markdown.includes("http://"), false);
});

test("stripTracking은 source=copy_link를 빼고 http를 https로 바꾼다", () => {
  const cleaned = stripTracking(
    "https://app.notion.com/p/362fec6d90d28043b955f026c5872b2d?source=copy_link&utm_source=share&fbclid=IwAR123&pvs=21"
  );
  assert.equal(
    cleaned,
    "https://app.notion.com/p/362fec6d90d28043b955f026c5872b2d"
  );
  assert.equal(stripTracking("http://claude.ai"), "https://claude.ai");
  assert.equal(stripTracking("https://example.com/a?keep=1&utm_medium=x"), "https://example.com/a?keep=1");
});

test("isDuplicateRow는 제목 또는 source_url의 hex만 본다", () => {
  const title = "1.유미의세포 스타일 프롬프트";
  const hex = "362fec6d90d28043b955f026c5872b2d";
  assert.equal(isDuplicateRow({ title, source_url: "" }, title, hex), true);
  assert.equal(
    isDuplicateRow(
      {
        title: "다른 글",
        source_url: "https://app.notion.com/p/362fec6d90d28043b955f026c5872b2d",
      },
      title,
      hex
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      {
        title: "다른 글",
        source_url: "https://app.notion.com/p/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        content: hex,
      },
      title,
      hex
    ),
    false
  );
  assert.equal(isDuplicateRow(null, title, hex), false);
});

test("요청 간격과 Prompts 저장 코드가 정해진 대로다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(REQUEST_GAP_MS, 1500);
  assert.deepEqual(RETRY_WAITS_MS, [30000, 60000]);
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(/from\(["']prompts["']\)/.test(source), false);
  assert.equal(source.includes("source=copy_link"), true);
});
