// Slashpage 클로드 다크 프롬프트 10 변환 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  EXPECTED_ATTACHMENTS,
  EXPECTED_CODES,
  EXPECTED_IMAGES,
  EXPECTED_TABLES,
  PAGE_HASH,
  PAGE_TITLE,
  SOURCE_URL,
  hasNoExpiredUrl,
  isDuplicateRow,
  stripTracking,
  tokensToMarkdown,
} from "../scripts/import-slashpage-claude-dark-prompts-10.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-slashpage-claude-dark-prompts-10.mjs"
);

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// Slashpage 클로드 다크 프롬프트 10을 Pages에만 저장한다"
  );
});

test("stripTracking은 이 hash URL에서 fbclid와 utm_source를 뺀다", () => {
  const dirty =
    "https://slashpage.com/biggie-ai/d367nxm3wr133mj98pv1?fbclid=IwAR123&utm_source=share";
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned, SOURCE_URL);
});

test("이 글은 기존 Slashpage 두 글과 제목·hash가 다르다", () => {
  assert.equal(PAGE_TITLE, "클로드 다크 프롬프트 10");
  assert.equal(PAGE_HASH, "d367nxm3wr133mj98pv1");
  assert.equal(
    SOURCE_URL,
    "https://slashpage.com/biggie-ai/d367nxm3wr133mj98pv1"
  );
  assert.notEqual(PAGE_TITLE, "ChatGPT 이미지 프롬프트 99개");
  assert.notEqual(PAGE_TITLE, "ChatGPT 프롬프트 해킹 99개");
  assert.notEqual(PAGE_HASH, "1q3vdn2pdpnk82xy49pr");
  assert.notEqual(PAGE_HASH, "3p4kj92yjdq9ym57q1x8");
  assert.equal(SOURCE_URL.includes("fbclid"), false);
  assert.equal(SOURCE_URL.includes("1q3vdn2pdpnk82xy49pr"), false);
  assert.equal(SOURCE_URL.includes("3p4kj92yjdq9ym57q1x8"), false);
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
    isDuplicateRow(
      { title: "ChatGPT 이미지 프롬프트 99개", content: "없음" },
      PAGE_TITLE,
      markers
    ),
    false
  );
  assert.equal(
    isDuplicateRow(
      { title: "ChatGPT 프롬프트 해킹 99개", content: "1q3vdn2pdpnk82xy49pr" },
      PAGE_TITLE,
      markers
    ),
    false
  );
  assert.equal(
    isDuplicateRow({ title: "다른 글", content: "없음" }, PAGE_TITLE, markers),
    false
  );
});

test("tokensToMarkdown은 clickAction 링크를 굵은 글 다음에 감싼다", () => {
  assert.equal(
    tokensToMarkdown([
      {
        text: "구매 인증하고 단톡방 들어가기",
        styles: { b: true },
        extended: {
          type: "clickAction",
          value: JSON.stringify({
            action: "url",
            url: "https://forms.gle/gqpvf9dotkWDfL5s9?fbclid=IwAR123&utm_source=share",
          }),
        },
      },
    ]),
    "[**구매 인증하고 단톡방 들어가기**](https://forms.gle/gqpvf9dotkWDfL5s9)"
  );
  assert.equal(
    tokensToMarkdown([
      {
        text: "《크래프터》 교보문고에서 보기",
        styles: { b: true },
        link: "",
        extended: {
          type: "clickAction",
          value: {
            url: "https://product.kyobobook.co.kr/detail/S000221330983",
          },
        },
      },
    ]),
    "[**《크래프터》 교보문고에서 보기**](https://product.kyobobook.co.kr/detail/S000221330983)"
  );
  assert.equal(
    tokensToMarkdown([
      {
        text: "링크 아님",
        extended: { type: "clickAction", value: "{not json" },
      },
    ]),
    "링크 아님"
  );
});

test("기대 개수는 이미지 2, 첨부 0, 표 0, 코드 10이다", () => {
  assert.equal(EXPECTED_IMAGES, 2);
  assert.equal(EXPECTED_ATTACHMENTS, 0);
  assert.equal(EXPECTED_TABLES, 0);
  assert.equal(EXPECTED_CODES, 10);
});

test("Prompts 테이블을 쓰지 않는다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes("117783"), false);
});
