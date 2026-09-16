// Notion DESIGN.md 리소스 8곳 Pages 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  EXPECTED_ATTACHMENTS,
  EXPECTED_IMAGES,
  PAGE_HEX,
  PAGE_TITLE,
  SOURCE_URL,
  autolinkBareUrls,
  hasNoExpiredUrl,
  isDuplicateRow,
  stripTracking,
} from "../scripts/import-notion-ai-design-md-8.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-notion-ai-design-md-8.mjs"
);

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// Notion DESIGN.md 리소스 8곳을 Pages에만 저장한다"
  );
});

test("PAGE_TITLE과 SOURCE_URL 상수다", () => {
  assert.equal(
    PAGE_TITLE,
    "AI한테 \"예쁘게 만들어줘\" 그만하세요 — DESIGN.md 리소스 8곳"
  );
  assert.equal(
    SOURCE_URL,
    "https://app.notion.com/p/AI-DESIGN-md-8-3db1061c8a6380c699a1c2feb2c2e9c8"
  );
  assert.equal(PAGE_HEX, "3db1061c8a6380c699a1c2feb2c2e9c8");
  assert.equal(SOURCE_URL.includes(PAGE_HEX), true);
  assert.equal(EXPECTED_IMAGES, 8);
  assert.equal(EXPECTED_ATTACHMENTS, 0);
});

test("stripTracking은 source=copy_link를 뺀다", () => {
  const dirty = `${SOURCE_URL}?source=copy_link&utm_source=share&fbclid=IwAR123&pvs=21`;
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes("source=copy_link"), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("pvs"), false);
  assert.equal(cleaned, SOURCE_URL);
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
  const markers = [SOURCE_URL, PAGE_HEX];
  assert.equal(
    isDuplicateRow({ title: PAGE_TITLE, content: "x" }, PAGE_TITLE, markers),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: `원문 ${PAGE_HEX}` },
      PAGE_TITLE,
      markers
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      {
        title: "[피그마스터] Design.md 뽀개기",
        source_url: "https://app.notion.com/p/0f8b256827ac83a78fe301bbdc3e0025",
        content: "원문 0f8b256827ac83a78fe301bbdc3e0025",
      },
      PAGE_TITLE,
      markers
    ),
    false
  );
});

test("CATEGORY/Prompts 저장 코드가 없다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
});

test("autolinkBareUrls는 맨 URL만 감싸고 data URL은 건드리지 않는다", () => {
  const md =
    "DesignMD — https://designmd.me\n\n![x](data:image/png;base64,abc)";
  const out = autolinkBareUrls(md);
  assert.equal(out.includes("[https://designmd.me](https://designmd.me)"), true);
  assert.equal(out.includes("](data:image/png;base64,abc)"), true);
  assert.equal(out.includes("[data:image"), false);
});
