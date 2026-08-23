// 2026-08-22 이후 Notion 신규 2건의 이미지 치환과 표 정리를 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import {
  PAGES,
  convertTables,
  extractNotionContent,
  replaceSnapshotImages,
} from "../scripts/import-notion-kst-20260824.mjs";

test("대상 페이지는 2건이고 이미지 기대 수는 6·3이다", () => {
  assert.equal(PAGES.length, 2);
  assert.deepEqual(
    PAGES.map((page) => page.images),
    [6, 3]
  );
  assert.deepEqual(
    PAGES.map((page) => page.hex),
    [
      "c8db256827ac82b0bf8381dc928fde34",
      "a4ab256827ac82f785e1813bd31d0687",
    ]
  );
});

test("Notion content 태그 안쪽만 추출한다", () => {
  assert.equal(
    extractNotionContent("앞\n<content>\n본문\n</content>\n뒤"),
    "본문"
  );
});

test("스냅샷 이미지는 파일 UUID로 data URL을 찾고 만료 쿼리를 제거한다", () => {
  const url =
    "https://prod-files-secure.s3.us-west-2.amazonaws.com/c9f63792-cf01-4ae9-982a-b4c0bb0f97a7/0e4cfd65-7a1d-4686-9e08-5317d8fb372e/%EC%86%8C%EB%B9%84_%EB%8C%80%EC%8B%9C%EB%B3%B4%EB%93%9C.png?X-Amz-Expires=300";
  const markdown = replaceSnapshotImages(`![소비](${url})`);
  assert.equal(markdown.startsWith("![소비](data:image/png;base64,"), true);
  assert.equal(markdown.includes("prod-files-secure"), false);
  assert.equal(markdown.includes("X-Amz"), false);
});

test("HTML 표를 마크다운 표로 바꾼다", () => {
  const html =
    "<table header-row=\"true\"><tr><td>날짜</td><td>금액</td></tr><tr><td>8/1</td><td>3.2</td></tr></table>";
  const markdown = convertTables(html);
  assert.equal(markdown.includes("| 날짜 | 금액 |"), true);
  assert.equal(markdown.includes("| --- | --- |"), true);
  assert.equal(markdown.includes("| 8/1 | 3.2 |"), true);
});
