// 한국 시간 이번 주 Notion 신규 페이지 이관 헬퍼를 네트워크 없이 검증한다
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
} from "../scripts/import-notion-kst-20260922.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-notion-kst-20260922.mjs"
);
const SKIPPED_HEXES = [
  "8feb256827ac8242950101032dc074a4",
  "981b256827ac8262931701ac22346c05",
  "3e2b256827ac820ab42d81df25240ee5",
  "3db1061c8a6380c699a1c2feb2c2e9c8",
  "38cb256827ac834c8a8b812bc5fbd149",
  "62eb256827ac83709f0481ce1ea38c7a",
  "56cb256827ac8249a099012cfd558165",
  "817b256827ac82e787b5819c108679f6",
];

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 한국 시간 이번 주 Notion 신규 페이지를 Pages에만 저장한다"
  );
});

test("대상 1건의 키·이미지·첨부 수가 맞다", () => {
  assert.equal(TARGETS.length, 1);
  const staff = TARGETS[0];
  assert.equal(staff.key, "staff-folder");
  assert.equal(
    staff.title,
    "AI 직원 7명으로 콘텐츠 팀 만들기 — 폴더 구조 · 직원 7명 프롬프트 · 30분 설치"
  );
  assert.equal(staff.hex, "285b256827ac829cb58381e6c9409da2");
  assert.equal(staff.pageId, "285b2568-27ac-829c-b583-81e6c9409da2");
  assert.equal(
    staff.sourceUrl,
    "https://app.notion.com/p/285b256827ac829cb58381e6c9409da2"
  );
  assert.equal(staff.images, 0);
  assert.equal(staff.attachments, 0);
  assert.equal(staff.root, 66);
  assert.equal(staff.tables, 12);
  assert.equal(staff.codes, 3);
  assert.deepEqual(staff.phrases, [
    "폴더 구조",
    "research.md",
    "30분 설치",
    "CLAUDE.md",
  ]);
  assert.deepEqual(staff.requiredHrefs, [
    "https://wandering-mile-86e.notion.site/AI-50-6-88-3db98dec8eed8107b5eac827fe906cce",
  ]);
  assert.deepEqual(EXPECTED_IMAGES, { "staff-folder": 0 });
  assert.equal(staff.sourceUrl.includes(staff.hex), true);
});

test("TARGETS에 이미 이관한 hex가 없다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  const match = source.match(/const SKIPPED_HEXES = \[([\s\S]*?)\];/);
  assert.ok(match);
  const declared = [...match[1].matchAll(/"([0-9a-f]{32})"/g)].map(
    (item) => item[1]
  );
  assert.deepEqual(declared, SKIPPED_HEXES);
  const hexes = TARGETS.map((item) => item.hex);
  for (const hex of SKIPPED_HEXES) {
    assert.equal(hexes.includes(hex), false, hex);
  }
  assert.equal(hexes.includes("3db98dec8eed8107b5eac827fe906cce"), false);
});

test("stripTracking은 source=copy_link를 빼고 http를 https로 바꾼다", () => {
  const staff = TARGETS.find((item) => item.key === "staff-folder");
  const dirty = `${staff.sourceUrl}?source=copy_link&utm_source=share&fbclid=IwAR123&pvs=21`;
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes("source=copy_link"), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("pvs"), false);
  assert.equal(cleaned, staff.sourceUrl);
  assert.equal(stripTracking("http://claude.ai"), "https://claude.ai");
  assert.equal(
    stripTracking(
      "https://wandering-mile-86e.notion.site/AI-50-6-88-3db98dec8eed8107b5eac827fe906cce?utm_source=share"
    ),
    staff.requiredHrefs[0]
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
  const staff = TARGETS.find((item) => item.key === "staff-folder");
  const markers = [staff.sourceUrl, staff.pageId, staff.hex];
  assert.equal(
    isDuplicateRow({ title: staff.title, content: "x" }, staff.title, markers),
    true
  );
  assert.equal(
    isDuplicateRow(
      { title: "다른 글", content: `원문 ${staff.hex}` },
      staff.title,
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
      staff.title,
      markers
    ),
    false
  );
  assert.equal(
    isDuplicateRow(
      {
        title:
          "클로드로 10분 만에 직원 7명 만드는 법 — 클로드 활용 가이드 (풀버전)",
        source_url: "https://app.notion.com/p/817b256827ac82e787b5819c108679f6",
        content: "원문 817b256827ac82e787b5819c108679f6",
      },
      staff.title,
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
