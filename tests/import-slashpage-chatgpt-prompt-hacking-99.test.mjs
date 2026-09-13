// Slashpage ChatGPT 프롬프트 해킹 99개 변환 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  PAGE_HASH,
  PAGE_TITLE,
  SOURCE_URL,
  hasNoExpiredUrl,
  isDuplicateRow,
  stripTracking,
} from "../scripts/import-slashpage-chatgpt-prompt-hacking-99.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-slashpage-chatgpt-prompt-hacking-99.mjs"
);

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// Slashpage ChatGPT 프롬프트 해킹 99개를 Pages에만 저장한다"
  );
});

test("stripTracking은 더러운 사용자 URL에서 fbclid를 뺀다", () => {
  const dirty =
    "https://slashpage.com/biggie-ai/3p4kj92yjdq9ym57q1x8?fbclid=IwAR123&utm_source=share";
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned, SOURCE_URL);
});

test("이 글은 ChatGPT 이미지 프롬프트 99개와 다른 글이다", () => {
  assert.equal(PAGE_TITLE, "ChatGPT 프롬프트 해킹 99개");
  assert.notEqual(PAGE_TITLE, "ChatGPT 이미지 프롬프트 99개");
  assert.equal(PAGE_HASH, "3p4kj92yjdq9ym57q1x8");
  assert.notEqual(PAGE_HASH, "1q3vdn2pdpnk82xy49pr");
  assert.equal(
    SOURCE_URL,
    "https://slashpage.com/biggie-ai/3p4kj92yjdq9ym57q1x8"
  );
  assert.equal(SOURCE_URL.includes("1q3vdn2pdpnk82xy49pr"), false);
  assert.equal(SOURCE_URL.includes("?post="), false);
  assert.equal(SOURCE_URL.endsWith("/"), false);
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
    isDuplicateRow({ title: "다른 글", content: "없음" }, PAGE_TITLE, markers),
    false
  );
});
