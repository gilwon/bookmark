// 한국 시간 9월 30일 Notion 신규 2건 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  EXPECTED_IMAGES,
  SKIPPED_HEXES,
  TARGETS,
  assertNoFileOrPdf,
  imageNameOf,
  stripTracking,
} from "../scripts/import-notion-kst-20260930.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-notion-kst-20260930.mjs"
);

const SKIPPED = [
  "285b256827ac829cb58381e6c9409da2",
  "3db98dec8eed8107b5eac827fe906cce",
  "417b256827ac83d09bb7013942b14bef",
  "f7bb256827ac8381be0e81a4cb198bbe",
];

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 한국 시간 9월 27일 Notion 신규 2건을 Pages에만 저장한다"
  );
});

test("대상 2건의 제목·hex·본문 수가 맞다", () => {
  assert.equal(TARGETS.length, 2);
  const trader = TARGETS.find((item) => item.key === "trader");
  const munder = TARGETS.find((item) => item.key === "munder");
  assert.ok(trader);
  assert.ok(munder);
  assert.equal(
    trader.title,
    "24시간 도는 AI 트레이더 만들기 — GPT-6 아스트라"
  );
  assert.equal(trader.hex, "f65b256827ac82bbaa25014f824bab76");
  assert.equal(trader.pageId, "f65b2568-27ac-82bb-aa25-014f824bab76");
  assert.equal(
    trader.sourceUrl,
    "https://app.notion.com/p/f65b256827ac82bbaa25014f824bab76"
  );
  assert.equal(trader.images, 0);
  assert.equal(trader.attachments, 0);
  assert.equal(trader.root, 107);
  assert.equal(trader.tables, 5);
  assert.equal(trader.codes, 11);
  assert.equal(trader.imageFiles, undefined);
  assert.equal(trader.imageMime, undefined);
  assert.deepEqual(trader.phrases, ["시작하기 전에 꼭 읽으세요", "검토 담당"]);
  assert.deepEqual(trader.requiredHrefs, [
    "https://wandering-mile-86e.notion.site/AI-50-6-88-3db98dec8eed8107b5eac827fe906cce",
  ]);
  assert.equal(
    munder.title,
    "머더디핀 설치 가이드: 클로드로 AI 직원 사무실 차리기"
  );
  assert.equal(munder.hex, "9beb256827ac823fb0120170ad07c5b9");
  assert.equal(munder.pageId, "9beb2568-27ac-823f-b012-0170ad07c5b9");
  assert.equal(
    munder.sourceUrl,
    "https://app.notion.com/p/9beb256827ac823fb0120170ad07c5b9"
  );
  assert.equal(munder.images, 5);
  assert.equal(munder.attachments, 0);
  assert.equal(munder.root, 66);
  assert.equal(munder.tables, 0);
  assert.equal(munder.codes, 3);
  assert.equal(munder.imageMime, undefined);
  assert.deepEqual(munder.imageFiles, [
    "munder_office.png",
    "munder_download.png",
    "munder_michael.png",
    "munder_tasks.png",
    "munder_settings.png",
  ]);
  assert.deepEqual(munder.phrases, ["STEP 1. 클로드 코드 설치", "머더디핀"]);
  assert.deepEqual(munder.requiredHrefs, [
    "https://github.com/chaitanyagiri/munder-difflin",
    "https://github.com/chaitanyagiri/munder-difflin/releases",
    "https://harnessmd.com/download",
    "https://www.instagram.com/moodmode.ai",
    "mailto:moodmode.kr@gmail.com",
  ]);
  assert.deepEqual(EXPECTED_IMAGES, { trader: 0, munder: 5 });
  for (const item of TARGETS) {
    assert.equal(item.sourceUrl.includes("source=copy_link"), false);
    assert.equal(item.sourceUrl.includes("fbclid"), false);
  }
});

test("이미 이관된 hex는 대상이 아니다", () => {
  assert.deepEqual([...SKIPPED_HEXES], SKIPPED);
  const hexes = TARGETS.map((item) => item.hex);
  for (const hex of SKIPPED_HEXES) {
    assert.equal(hexes.includes(hex), false, hex);
  }
});

test("stripTracking은 utm과 fbclid를 뺀다", () => {
  const trader = TARGETS.find((item) => item.key === "trader");
  const dirty = `${trader.sourceUrl}?utm_source=share&utm_medium=social&fbclid=IwAR123&source=copy_link`;
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes("utm_"), false);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("source=copy_link"), false);
  assert.equal(cleaned, trader.sourceUrl);
  assert.equal(
    stripTracking("http://github.com/chaitanyagiri/munder-difflin?fbclid=abc"),
    "https://github.com/chaitanyagiri/munder-difflin"
  );
});

test("attachment 파일명은 제목보다 우선한다", () => {
  assert.equal(
    imageNameOf({
      properties: {
        title: [["사무실 안내"]],
        source: [["attachment:block-id:munder_office.png"]],
      },
    }),
    "munder_office.png"
  );
  assert.equal(
    imageNameOf({
      properties: {
        title: [["다른 이름"]],
        source: [["attachment:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:munder_settings.png"]],
      },
    }),
    "munder_settings.png"
  );
});

test("file 또는 pdf 블록이 있으면 throw한다", () => {
  const blocks = new Map([
    ["file-1", { id: "file-1", type: "file" }],
  ]);
  assert.throws(() => assertNoFileOrPdf(blocks), /file 또는 pdf/);
  const pdfs = new Map([["pdf-1", { id: "pdf-1", type: "pdf" }]]);
  assert.throws(() => assertNoFileOrPdf(pdfs), /file 또는 pdf/);
  assert.doesNotThrow(() =>
    assertNoFileOrPdf(new Map([["img-1", { id: "img-1", type: "image" }]]))
  );
});

test("Prompts 테이블과 첨부 저장소를 쓰지 않는다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(/from\(["']prompts["']\)/.test(source), false);
  assert.equal(source.includes("page-attachment-storage"), false);
  assert.equal(source.includes("BERKSHIRE"), false);
  assert.equal(source.includes("requireStorageLibs"), false);
  assert.equal(source.includes("uploadZips"), false);
  assert.equal(source.includes("data:application/zip"), true);
  assert.equal(/UPDATE\s+custom_pages/i.test(source), false);
});
