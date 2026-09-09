// 한국 시간 이번 주 Notion 신규 치트키 2건 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  COVER_PNG_BYTES,
  TARGETS,
  hasNoExpiredUrl,
  isDuplicateRow,
  stripTracking,
} from "../scripts/import-notion-kst-20260909.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_PATH = resolve(root, "scripts/import-notion-kst-20260909.mjs");

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 한국 시간 이번 주 Notion 신규 치트키 2건을 Pages에만 저장한다"
  );
});

test("대상은 2건이고 커버 78037바이트·이미지는 1이다", () => {
  assert.equal(TARGETS.length, 2);
  assert.deepEqual(
    TARGETS.map((item) => item.key),
    ["claude", "chatgpt"]
  );
  assert.deepEqual(
    TARGETS.map((item) => item.images),
    [1, 1]
  );
  assert.equal(COVER_PNG_BYTES, 78037);
  for (const item of TARGETS) {
    const bytes = readFileSync(resolve(root, item.cover));
    assert.equal(bytes.length, COVER_PNG_BYTES, item.cover);
    assert.equal(bytes[0], 0x89);
    assert.equal(bytes[1], 0x50);
    assert.equal(bytes[2], 0x4e);
    assert.equal(bytes[3], 0x47);
  }
});

test("stripTracking은 pvs·utm·fbclid·igsh·mcp_token·copy_link를 뺀다", () => {
  const claude = TARGETS.find((item) => item.key === "claude");
  const cases = [
    [
      `${claude.sourceUrl}?pvs=204`,
      claude.sourceUrl,
    ],
    [
      "https://www.instagram.com/nookitokki?utm_source=ig&utm_medium=social&fbclid=IwAR123&igsh=abc",
      "https://www.instagram.com/nookitokki",
    ],
    [
      `${claude.sourceUrl}?source=copy_link&mcp_token=abc&utm_campaign=share`,
      claude.sourceUrl,
    ],
  ];
  for (const [dirty, clean] of cases) {
    const cleaned = stripTracking(dirty);
    assert.equal(cleaned.includes("pvs="), false, dirty);
    assert.equal(cleaned.includes("utm_source"), false, dirty);
    assert.equal(cleaned.includes("utm_medium"), false, dirty);
    assert.equal(cleaned.includes("utm_campaign"), false, dirty);
    assert.equal(cleaned.includes("fbclid"), false, dirty);
    assert.equal(cleaned.includes("igsh"), false, dirty);
    assert.equal(cleaned.includes("mcp_token"), false, dirty);
    assert.equal(cleaned.includes("source=copy_link"), false, dirty);
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
  const claude = TARGETS.find((item) => item.key === "claude");
  const chatgpt = TARGETS.find((item) => item.key === "chatgpt");
  assert.equal(Boolean(claude?.hex), true);
  assert.equal(Boolean(chatgpt?.hex), true);
  assert.equal(
    isDuplicateRow(
      { title: claude.title, content: "x" },
      claude.title,
      [claude.hex]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: `원문 ${claude.hex}` },
      claude.title,
      [claude.hex]
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: "없음" },
      claude.title,
      [claude.hex]
    ),
    false
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: `원문 ${chatgpt.hex}` },
      chatgpt.title,
      [chatgpt.hex]
    ),
    true
  );
});

test("스크립트는 Prompts 테이블을 쓰지 않는다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(/from\(["']prompts["']\)/.test(source), false);
});

test("본문 파일에 100번 항목이 있고 만료 URL이 없다", () => {
  for (const item of TARGETS) {
    const body = readFileSync(resolve(root, item.body), "utf8");
    assert.equal(body.includes("**100."), true, item.body);
    assert.equal(hasNoExpiredUrl(body), true, item.body);
    for (const phrase of item.phrases) {
      assert.equal(body.includes(phrase), true, `${item.key} ${phrase}`);
    }
  }
});
