// Slashpage ChatGPT 이미지 프롬프트 99개 변환 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  EXPECTED_IMAGES,
  PAGE_HASH,
  PAGE_TITLE,
  SOURCE_URL,
  blocksToMarkdown,
  hasNoExpiredUrl,
  isDuplicateRow,
  stripTracking,
  tokensToMarkdown,
} from "../scripts/import-slashpage-chatgpt-image-prompts-99.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-slashpage-chatgpt-image-prompts-99.mjs"
);

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// Slashpage ChatGPT 이미지 프롬프트 99개를 Pages에만 저장한다"
  );
});

test("stripTracking은 더러운 사용자 URL에서 fbclid를 뺀다", () => {
  const dirty =
    "https://slashpage.com/biggie-ai/1q3vdn2pdpnk82xy49pr?fbclid=IwAR123&utm_source=share";
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned, SOURCE_URL);
});

test("tokensToMarkdown은 볼드와 인라인 코드를 렌더한다", () => {
  assert.equal(
    tokensToMarkdown([
      { text: "한 번에 2~3개까지만.", styles: { b: true } },
      { text: " " },
      { text: "/portrait", styles: { code: true } },
    ]),
    "**한 번에 2~3개까지만.** `/portrait`"
  );
});

test("blocksToMarkdown은 헤딩·표·이미지·코드를 남긴다", () => {
  const headingId = "h1";
  const tableId = "t1";
  const c00 = "c00";
  const c01 = "c01";
  const c10 = "c10";
  const c11 = "c11";
  const t00 = "t00";
  const t01 = "t01";
  const t10 = "t10";
  const t11 = "t11";
  const imageId = "img1";
  const codeId = "code1";
  const blockMap = {
    [headingId]: {
      id: headingId,
      type: "heading",
      value: { level: 2, tokens: [{ text: "쓰는 법" }] },
      parentBlockId: "_root_",
      sortKey: ".n0",
    },
    [tableId]: {
      id: tableId,
      type: "table",
      value: { colCount: 2, rowCount: 2, headerRow: true },
      parentBlockId: "_root_",
      sortKey: ".n1",
    },
    [c00]: {
      id: c00,
      type: "tableCell",
      value: {},
      parentBlockId: tableId,
      sortKey: ".n0",
    },
    [c01]: {
      id: c01,
      type: "tableCell",
      value: {},
      parentBlockId: tableId,
      sortKey: ".n1",
    },
    [c10]: {
      id: c10,
      type: "tableCell",
      value: {},
      parentBlockId: tableId,
      sortKey: ".n2",
    },
    [c11]: {
      id: c11,
      type: "tableCell",
      value: {},
      parentBlockId: tableId,
      sortKey: ".n3",
    },
    [t00]: {
      id: t00,
      type: "text",
      value: { tokens: [{ text: "목적" }] },
      parentBlockId: c00,
      sortKey: ".n0",
    },
    [t01]: {
      id: t01,
      type: "text",
      value: { tokens: [{ text: "조합" }] },
      parentBlockId: c01,
      sortKey: ".n0",
    },
    [t10]: {
      id: t10,
      type: "text",
      value: { tokens: [{ text: "프로필 사진" }] },
      parentBlockId: c10,
      sortKey: ".n0",
    },
    [t11]: {
      id: t11,
      type: "text",
      value: {
        tokens: [{ text: "/portrait", styles: { code: true } }],
      },
      parentBlockId: c11,
      sortKey: ".n0",
    },
    [imageId]: {
      id: imageId,
      type: "image",
      value: {
        image: {
          filename: "slide_01.png",
          imageKey: "image/slashpagePost/20260901/193142_Qbz6DDmt2ebOybA61Z",
        },
      },
      parentBlockId: "_root_",
      sortKey: ".n2",
    },
    [codeId]: {
      id: codeId,
      type: "code",
      value: {
        code: "카페에 앉은 20대 여성 /cinematicportrait /windowlight",
        language: "plainText",
      },
      parentBlockId: "_root_",
      sortKey: ".n3",
    },
  };
  const markdown = blocksToMarkdown(
    [[headingId], [tableId], [imageId], [codeId]],
    blockMap,
    { [imageId]: "data:image/png;base64,AAAA" }
  );
  assert.match(markdown, /## 쓰는 법/);
  assert.match(markdown, /\| 목적 \| 조합 \|/);
  assert.match(markdown, /\| --- \| --- \|/);
  assert.match(markdown, /`\/portrait`/);
  assert.match(markdown, /!\[slide_01\.png\]\(data:image\/png;base64,AAAA\)/);
  assert.match(markdown, /```\n카페에 앉은 20대 여성 \/cinematicportrait \/windowlight\n```/);
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

test("isDuplicateRow는 제목 또는 해시 또는 원문 URL로 true다", () => {
  const markers = [SOURCE_URL, PAGE_HASH];
  assert.equal(
    isDuplicateRow({ title: PAGE_TITLE, content: "x" }, PAGE_TITLE, markers),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: `원문 ${SOURCE_URL}` },
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
    isDuplicateRow(
      { title: "다른 글", content: `원문 ${PAGE_HASH}` },
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

test("EXPECTED_IMAGES는 1이다", () => {
  assert.equal(EXPECTED_IMAGES, 1);
});
