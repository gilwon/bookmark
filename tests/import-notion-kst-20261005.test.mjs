// 한국 시간 10월 4일 Notion 신규 1건 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  SKIPPED_HEXES,
  TARGETS,
  assertNoFileOrPdf,
  imageNameOf,
  stripTracking,
} from "../scripts/import-notion-kst-20261005.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-notion-kst-20261005.mjs"
);

const SKIPPED = [
  "285b256827ac829cb58381e6c9409da2",
  "3db98dec8eed8107b5eac827fe906cce",
  "417b256827ac83d09bb7013942b14bef",
  "f7bb256827ac8381be0e81a4cb198bbe",
  "f65b256827ac82bbaa25014f824bab76",
  "9beb256827ac823fb0120170ad07c5b9",
];

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 한국 시간 10월 4일 Notion 신규 1건을 Pages에만 저장한다"
  );
});

test("대상 1건의 제목·hex·본문 수가 맞다", () => {
  assert.equal(TARGETS.length, 1);
  const item = TARGETS.find((row) => row.key === "kskill");
  assert.ok(item);
  assert.equal(item.title, "한국인 전용 AI 스킬 125개 설치 가이드");
  assert.equal(item.hex, "ef4b256827ac8250ac8001830bc891b4");
  assert.equal(item.pageId, "ef4b2568-27ac-8250-ac80-01830bc891b4");
  assert.equal(
    item.sourceUrl,
    "https://app.notion.com/p/ef4b256827ac8250ac8001830bc891b4"
  );
  assert.equal(item.images, 4);
  assert.equal(item.attachments, 0);
  assert.equal(item.root, 65);
  assert.equal(item.tables, 0);
  assert.equal(item.codes, 10);
  assert.equal(item.imageMime, undefined);
  assert.deepEqual(item.imageFiles, [
    "image.png",
    "kskill_card3_부동산_v3.png".normalize("NFC"),
    "kskill_card4_법률_v2.png".normalize("NFC"),
    "kskill_card6_쇼핑_v2.png".normalize("NFC"),
  ]);
  for (const name of item.imageFiles) {
    assert.equal(name, name.normalize("NFC"));
  }
  assert.deepEqual(item.phrases, [
    "k-skill이 뭔가요?",
    "제일 쉬운 방법: 깃허브 주소만 붙여넣기",
  ]);
  assert.deepEqual(item.requiredHrefs, [
    "https://github.com/NomaDamas/k-skill",
    "https://k-skill-proxy.nomadamas.org/privacy",
    "https://www.instagram.com/moodmode.ai",
  ]);
  assert.equal(item.sourceUrl.includes("source=copy_link"), false);
  assert.equal(item.sourceUrl.includes("fbclid"), false);
});

test("이미 이관된 hex는 대상이 아니다", () => {
  assert.deepEqual([...SKIPPED_HEXES], SKIPPED);
  const hexes = TARGETS.map((item) => item.hex);
  assert.equal(hexes.includes("ef4b256827ac8250ac8001830bc891b4"), true);
  for (const hex of SKIPPED_HEXES) {
    assert.equal(hexes.includes(hex), false, hex);
  }
});

test("stripTracking은 utm과 fbclid를 뺀다", () => {
  const item = TARGETS.find((row) => row.key === "kskill");
  const dirty = `${item.sourceUrl}?utm_source=share&utm_medium=social&fbclid=IwAR123&source=copy_link`;
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes("utm_"), false);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("source=copy_link"), false);
  assert.equal(cleaned, item.sourceUrl);
});

test("attachment 파일명은 제목보다 우선한다", () => {
  assert.equal(
    imageNameOf({
      properties: {
        title: [["안내 이미지"]],
        source: [["attachment:block-id:image.png"]],
      },
    }),
    "image.png"
  );
  assert.equal(
    imageNameOf({
      properties: {
        title: [["부동산 카드"]],
        source: [["attachment:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:kskill_card3_부동산_v3.png"]],
      },
    }),
    "kskill_card3_부동산_v3.png".normalize("NFC")
  );
});

test("file 또는 pdf 블록이 있으면 throw한다", () => {
  const blocks = new Map([["file-1", { id: "file-1", type: "file" }]]);
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
  assert.equal(/import\s+.*page-attachment-storage/.test(source), false);
});
