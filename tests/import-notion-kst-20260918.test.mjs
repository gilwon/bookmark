// 한국 시간 이번 주 Notion 신규 3건 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  EXPECTED_IMAGES,
  TARGETS,
  hasNoExpiredUrl,
  isDuplicateRow,
  stripTracking,
} from "../scripts/import-notion-kst-20260918.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-notion-kst-20260918.mjs"
);
const SKIPPED_HEXES = [
  "8feb256827ac8242950101032dc074a4",
  "981b256827ac8262931701ac22346c05",
  "3e2b256827ac820ab42d81df25240ee5",
  "3db1061c8a6380c699a1c2feb2c2e9c8",
];

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 한국 시간 이번 주 Notion 신규 3건을 Pages에만 저장한다"
  );
});

test("대상 3건의 키·이미지 수가 맞고 트레이더 제목에 이모지가 없다", () => {
  assert.equal(TARGETS.length, 3);
  assert.deepEqual(
    TARGETS.map((item) => item.key),
    ["claude", "trader", "fable"]
  );
  assert.deepEqual(
    TARGETS.map((item) => item.images),
    [0, 5, 0]
  );
  assert.deepEqual(EXPECTED_IMAGES, { claude: 0, trader: 5, fable: 0 });
  const trader = TARGETS.find((item) => item.key === "trader");
  assert.equal(trader.title.includes("🌍"), false);
  assert.equal(
    trader.title,
    "전 세계 주식 트레이더가 쓰는 BEST 3 보조지표 활용법 — 매수·매도 타점 자동 알림 받기"
  );
  for (const item of TARGETS) {
    assert.equal(item.attachments, 0, item.key);
    assert.equal(Boolean(item.hex), true, item.key);
    assert.equal(item.sourceUrl.includes(item.hex), true, item.key);
  }
});

test("TARGETS에 이미 이관한 4건 hex가 없다", () => {
  const hexes = TARGETS.map((item) => item.hex);
  for (const hex of SKIPPED_HEXES) {
    assert.equal(hexes.includes(hex), false, hex);
  }
});

test("stripTracking은 source=copy_link를 빼고 http를 https로 바꾼다", () => {
  const claude = TARGETS.find((item) => item.key === "claude");
  const dirty = `${claude.sourceUrl}?source=copy_link&utm_source=share&fbclid=IwAR123&pvs=21`;
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes("source=copy_link"), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("pvs"), false);
  assert.equal(cleaned, claude.sourceUrl);
  assert.equal(stripTracking("http://investing.com"), "https://investing.com");
  assert.equal(
    stripTracking("https://www.instagram.com/trenddalkak.ai/?utm_source=ig"),
    "https://www.instagram.com/trenddalkak.ai"
  );
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
  const markers = [claude.sourceUrl, claude.pageId, claude.hex];
  assert.equal(
    isDuplicateRow({ title: claude.title, content: "x" }, claude.title, markers),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: `원문 ${claude.hex}` },
      claude.title,
      markers
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      {
        title: "클로드를 웹 외주팀으로 만드는 무료 스킬",
        source_url: "https://app.notion.com/p/8feb256827ac8242950101032dc074a4",
        content: "원문 8feb256827ac8242950101032dc074a4",
      },
      claude.title,
      markers
    ),
    false
  );
});

test("CATEGORY/Prompts 저장 코드가 없다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(/from\(["']prompts["']\)/.test(source), false);
});
