// 한국 시간 이번 주 Notion 변환 헬퍼를 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import {
  PAGES,
  buildMarkdown,
  cleanNotionFetch,
  convertTables,
  freezeImportImages,
} from "../scripts/import-notion-kst-this-week.mjs";
import { pageBodies } from "../scripts/notion-kst-this-week-data.mjs";

test("이번 주 대상은 4건이다", () => {
  assert.equal(PAGES.length, 4);
  assert.equal(
    PAGES.some((page) => page.hex === "a4ab256827ac82f785e1813bd31d0687"),
    false
  );
});

test("만료 이미지 URL은 본문에서 뺀다", () => {
  const cleaned = cleanNotionFetch(
    "앞 ![](https://prod-files-secure.s3.us-west-2.amazonaws.com/aa/bb/c.svg?X-Amz-Signature=dead) 뒤"
  );
  assert.equal(cleaned.includes("X-Amz"), false);
  assert.equal(cleaned.includes("앞"), true);
  assert.equal(cleaned.includes("뒤"), true);
});

test("표는 마크다운 표로 바꾼다", () => {
  const markdown = convertTables(
    `<table header-row="true"><tr><td>증상</td><td>해결</td></tr><tr><td>안 됨</td><td>다시 켜기</td></tr></table>`
  );
  assert.equal(
    markdown.includes("| 증상 | 해결 |"),
    true
  );
  assert.equal(markdown.includes("| --- | --- |"), true);
  assert.equal(markdown.includes("| 안 됨 | 다시 켜기 |"), true);
});

test("buildMarkdown은 제목과 원문 링크를 넣는다", () => {
  const page = PAGES[1];
  const markdown = buildMarkdown(page, "본문");
  assert.equal(markdown.includes(`# ${page.title}`), true);
  assert.equal(markdown.includes(`[Notion](${page.url})`), true);
});

test("종목·아파트 이미지는 로컬 경로를 쓴다", () => {
  assert.equal(PAGES[0].images, 2);
  assert.equal(PAGES[2].images, 1);
  assert.equal(
    pageBodies.stock.includes(
      "/imports/notion-kst-this-week/pipeline_flow.svg"
    ),
    true
  );
  assert.equal(
    pageBodies.stock.includes(
      "/imports/notion-kst-this-week/premarket_gap_example.svg"
    ),
    true
  );
  assert.equal(
    pageBodies.apt.includes("/imports/notion-kst-this-week/apt-table.png"),
    true
  );
  assert.equal(pageBodies.stock.includes("X-Amz"), false);
  assert.equal(pageBodies.apt.includes("prod-files-secure"), false);
});

test("로컬 이미지 경로는 data URL로 고정한다", () => {
  const frozen = freezeImportImages(
    "![흐름](/imports/notion-kst-this-week/pipeline_flow.svg)"
  );
  assert.equal(frozen.startsWith("![흐름](data:image/svg+xml;base64,"), true);
  assert.equal(frozen.includes("/imports/"), false);
  assert.equal(frozen.includes("X-Amz"), false);
});
