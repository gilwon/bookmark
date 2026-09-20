// 한국 시간 어제·오늘 Notion 신규 1건 이관 헬퍼를 네트워크 없이 검증한다
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
} from "../scripts/import-notion-kst-20260920.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-notion-kst-20260920.mjs"
);
const SKIPPED_HEXES = [
  "8feb256827ac8242950101032dc074a4",
  "981b256827ac8262931701ac22346c05",
  "3e2b256827ac820ab42d81df25240ee5",
  "3db1061c8a6380c699a1c2feb2c2e9c8",
  "38cb256827ac834c8a8b812bc5fbd149",
  "62eb256827ac83709f0481ce1ea38c7a",
  "56cb256827ac8249a099012cfd558165",
];

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 한국 시간 어제·오늘 Notion 신규 1건을 Pages에만 저장한다"
  );
});

test("대상 1건의 키·이미지·첨부 수가 맞다", () => {
  assert.equal(TARGETS.length, 1);
  const staff7 = TARGETS[0];
  assert.equal(staff7.key, "staff7");
  assert.equal(
    staff7.title,
    "클로드로 10분 만에 직원 7명 만드는 법 — 클로드 활용 가이드 (풀버전)"
  );
  assert.equal(staff7.hex, "817b256827ac82e787b5819c108679f6");
  assert.equal(staff7.pageId, "817b2568-27ac-82e7-87b5-819c108679f6");
  assert.equal(
    staff7.sourceUrl,
    "https://app.notion.com/p/817b256827ac82e787b5819c108679f6"
  );
  assert.equal(staff7.images, 0);
  assert.equal(staff7.attachments, 0);
  assert.deepEqual(EXPECTED_IMAGES, { staff7: 0 });
  assert.equal(staff7.sourceUrl.includes(staff7.hex), true);
});

test("TARGETS에 이미 이관한 hex가 없다", () => {
  const hexes = TARGETS.map((item) => item.hex);
  for (const hex of SKIPPED_HEXES) {
    assert.equal(hexes.includes(hex), false, hex);
  }
});

test("stripTracking은 source=copy_link를 빼고 http를 https로 바꾼다", () => {
  const staff7 = TARGETS.find((item) => item.key === "staff7");
  const dirty = `${staff7.sourceUrl}?source=copy_link&utm_source=share&fbclid=IwAR123&pvs=21`;
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes("source=copy_link"), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("pvs"), false);
  assert.equal(cleaned, staff7.sourceUrl);
  assert.equal(stripTracking("http://claude.ai"), "https://claude.ai");
  assert.equal(
    stripTracking("https://open.kakao.com/o/gxbH0SHd?utm_source=share"),
    "https://open.kakao.com/o/gxbH0SHd"
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
  const staff7 = TARGETS.find((item) => item.key === "staff7");
  const markers = [staff7.sourceUrl, staff7.pageId, staff7.hex];
  assert.equal(
    isDuplicateRow({ title: staff7.title, content: "x" }, staff7.title, markers),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: `원문 ${staff7.hex}` },
      staff7.title,
      markers
    ),
    true
  );
  assert.equal(
    isDuplicateRow(
      {
        title: "AI 직원 7명으로 콘텐츠 팀 만들기",
        source_url: "https://app.notion.com/p/981b256827ac8262931701ac22346c05",
        content: "원문 981b256827ac8262931701ac22346c05",
      },
      staff7.title,
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
