// 2026-08-21 Notion 이관의 이미지 치환과 표 정리를 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import {
  PAGES,
  cleanBrokenSiteCell,
  extractNotionContent,
  replaceAutomationImages,
} from "../scripts/import-notion-kst-20260821.mjs";

test("대상 페이지는 3건이고 이미지 기대 수는 0·10·0이다", () => {
  assert.equal(PAGES.length, 3);
  assert.deepEqual(
    PAGES.map((page) => page.images),
    [0, 10, 0]
  );
});

test("Notion content 태그 안쪽만 추출한다", () => {
  assert.equal(
    extractNotionContent("앞\n<content>\n본문\n</content>\n뒤"),
    "본문"
  );
});

test("깨진 표 링크를 사이트 링크로 고친다", () => {
  const raw =
    '\\<a href="[https://youmind.com"\\>youmind.com\\</a\\>](https://youmind.com">youmind.com</a>)';
  assert.equal(
    cleanBrokenSiteCell(raw),
    "[youmind.com](https://youmind.com)"
  );
});

test("자동화 가이드 이미지는 파일 UUID로 data URL을 찾는다", () => {
  const url =
    "https://prod-files-secure.s3.us-west-2.amazonaws.com/c9f63792-cf01-4ae9-982a-b4c0bb0f97a7/c27154be-e80b-46d9-b2da-8f9521952639/01.png?X-Amz-Expires=300";
  const markdown = replaceAutomationImages(`![아침](${url})`);
  assert.equal(markdown.startsWith("![아침](data:image/png;base64,"), true);
  assert.equal(markdown.includes("prod-files-secure"), false);
  assert.equal(markdown.includes("X-Amz"), false);
});
