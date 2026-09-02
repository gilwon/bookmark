// 한국 시간 이번 주 Notion 신규 2건 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  COVER_JPEG_BYTES,
  TARGETS,
  hasNoExpiredUrl,
  isDuplicateRow,
  stripTracking,
} from "../scripts/import-notion-kst-20260831.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_PATH = resolve(root, "scripts/import-notion-kst-20260831.mjs");

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 한국 시간 이번 주 Notion 신규 페이지 2건을 Pages에만 저장한다"
  );
});

test("대상은 2건이고 이미지 수는 1·0이다", () => {
  assert.equal(TARGETS.length, 2);
  assert.deepEqual(
    TARGETS.map((item) => item.key),
    ["miro", "adhd"]
  );
  assert.deepEqual(
    TARGETS.map((item) => item.images),
    [1, 0]
  );
});

test("stripTracking은 pvs·utm·fbclid·igsh를 뺀다", () => {
  const cases = [
    [
      "https://app.notion.com/p/67ab256827ac83e4b31b017c7d19d2c3?pvs=204",
      "https://app.notion.com/p/67ab256827ac83e4b31b017c7d19d2c3",
    ],
    [
      "https://www.instagram.com/frommir0?utm_source=ig&utm_medium=social&fbclid=IwAR123&igsh=abc",
      "https://www.instagram.com/frommir0",
    ],
    [
      "https://example.com/path?utm_campaign=share&fbclid=IwAR123&pvs=204",
      "https://example.com/path",
    ],
  ];
  for (const [dirty, clean] of cases) {
    const cleaned = stripTracking(dirty);
    assert.equal(cleaned.includes("pvs="), false, dirty);
    assert.equal(cleaned.includes("utm_source"), false, dirty);
    assert.equal(cleaned.includes("utm_medium"), false, dirty);
    assert.equal(cleaned.includes("fbclid"), false, dirty);
    assert.equal(cleaned.includes("igsh"), false, dirty);
    assert.equal(cleaned, clean);
  }
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

test("isDuplicateRow는 제목 또는 hex로 true다", () => {
  const miro = TARGETS.find((item) => item.key === "miro");
  const adhd = TARGETS.find((item) => item.key === "adhd");
  assert.equal(Boolean(miro?.hex), true);
  assert.equal(Boolean(adhd?.hex), true);
  assert.equal(
    isDuplicateRow({ title: miro.title, content: "x" }, miro.title, [miro.hex]),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: `원문 ${miro.hex}` },
      miro.title,
      [miro.hex]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: "없음" },
      miro.title,
      [miro.hex]
    ),
    false
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: `원문 ${adhd.hex}` },
      adhd.title,
      [adhd.hex]
    ),
    true
  );
});

test("커버 JPEG 매직과 크기는 57604바이트다", () => {
  const bytes = readFileSync(
    resolve(root, "tmp/notion-kst-20260831/miro-cover.jpg")
  );
  assert.equal(bytes.length, COVER_JPEG_BYTES);
  assert.equal(bytes.length, 57604);
  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1], 0xd8);
});
