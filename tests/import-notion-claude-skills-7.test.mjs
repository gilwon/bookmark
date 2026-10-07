// 코딩 몰라도 쓰는 클로드 실전 스킬 7개 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  SKIPPED_HEXES,
  TARGETS,
  assertNoFileOrPdf,
  isDuplicateRow,
  stripTracking,
} from "../scripts/import-notion-claude-skills-7.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-notion-claude-skills-7.mjs"
);

const OTHER_TITLE = "한국인 전용 AI 스킬 125개 설치 가이드";
const OTHER_URL =
  "https://app.notion.com/p/ef4b256827ac8250ac8001830bc891b4";

const SKIPPED = [
  "285b256827ac829cb58381e6c9409da2",
  "3db98dec8eed8107b5eac827fe906cce",
  "417b256827ac83d09bb7013942b14bef",
  "f7bb256827ac8381be0e81a4cb198bbe",
  "f65b256827ac82bbaa25014f824bab76",
  "9beb256827ac823fb0120170ad07c5b9",
  "ef4b256827ac8250ac8001830bc891b4",
];

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 코딩 몰라도 쓰는 클로드 실전 스킬 7개를 Pages에만 저장한다"
  );
});

test("대상 1건의 제목·hex·본문 수가 맞다", () => {
  assert.equal(TARGETS.length, 1);
  const item = TARGETS.find((row) => row.key === "skills7");
  assert.ok(item);
  assert.equal(item.title, "코딩 몰라도 쓰는 클로드 실전 스킬 7개");
  assert.equal(item.hex, "3f17d0f198f6801b90ecf6d47cd10def");
  assert.equal(item.pageId, "3f17d0f1-98f6-801b-90ec-f6d47cd10def");
  assert.equal(
    item.sourceUrl,
    "https://app.notion.com/p/3f17d0f198f6801b90ecf6d47cd10def"
  );
  assert.equal(item.images, 0);
  assert.equal(item.attachments, 0);
  assert.equal(item.root, 338);
  assert.equal(item.tables, 5);
  assert.equal(item.codes, 47);
  assert.equal(item.imageFiles, undefined);
  assert.equal(item.imageMime, undefined);
  assert.deepEqual(item.phrases, [
    "이 가이드에서 다루는 스킬 7개",
    "01. agent-browser",
    "07. skill-creator",
    "참고한 공식 자료",
  ]);
  assert.deepEqual(item.requiredHrefs, [
    "https://github.com/anthropics/skills",
    "https://github.com/epoko77-ai/im-not-ai",
    "https://github.com/coreyhaines31/marketingskills",
    "https://github.com/vercel-labs/skills",
    "https://github.com/vercel-labs/agent-browser",
    "https://code.claude.com/docs/en/discover-plugins",
    "https://code.claude.com/docs/en/skills",
    "https://code.claude.com/docs/en/setup",
    "https://skills.sh/",
    "https://git-scm.com/downloads/win",
    "https://nodejs.org/",
  ]);
  assert.equal(item.sourceUrl.includes("?"), false);
  assert.equal(item.sourceUrl.includes("source=copy_link"), false);
  assert.equal(item.sourceUrl.includes("fbclid"), false);
  assert.equal(item.sourceUrl.includes("utm_source"), false);
});

test("이미 이관된 hex는 대상이 아니다", () => {
  assert.deepEqual([...SKIPPED_HEXES], SKIPPED);
  const hexes = TARGETS.map((item) => item.hex);
  assert.equal(hexes.includes("3f17d0f198f6801b90ecf6d47cd10def"), true);
  assert.equal(SKIPPED_HEXES.includes("3f17d0f198f6801b90ecf6d47cd10def"), false);
  assert.equal(SKIPPED_HEXES.includes("ef4b256827ac8250ac8001830bc891b4"), true);
  for (const hex of SKIPPED_HEXES) {
    assert.equal(hexes.includes(hex), false, hex);
  }
});

test("stripTracking은 source=copy_link와 fbclid와 utm_source를 뺀다", () => {
  const item = TARGETS.find((row) => row.key === "skills7");
  const dirty = `${item.sourceUrl}?utm_source=share&utm_medium=social&fbclid=IwAR123&source=copy_link`;
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes("utm_"), false);
  assert.equal(cleaned.includes("utm_source"), false);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("source=copy_link"), false);
  assert.equal(cleaned.includes("?"), false);
  assert.equal(cleaned, item.sourceUrl);
});

test("다른 글 제목과 URL은 중복이 아니다", () => {
  const item = TARGETS[0];
  assert.notEqual(item.title, OTHER_TITLE);
  assert.notEqual(item.sourceUrl, OTHER_URL);
  assert.equal(
    isDuplicateRow(
      {
        title: OTHER_TITLE,
        source_url: OTHER_URL,
        content: `${OTHER_TITLE}\n${OTHER_URL}`,
      },
      item.title,
      [item.sourceUrl, item.pageId, item.hex]
    ),
    false
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

test("Prompts 테이블과 기존 행 update를 쓰지 않는다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(source.includes('from("prompts")'), false);
  assert.equal(source.includes("from('prompts')"), false);
  assert.equal(source.includes(".update("), false);
  assert.equal(source.includes("UPDATE custom_pages"), false);
  assert.equal(source.includes("page-attachment-storage"), false);
  assert.equal(/import\s+.*page-attachment-storage/.test(source), false);
  assert.match(source, /const sourceUrl = stripTracking\(spec\.sourceUrl\)/);
  assert.equal(
    source.includes('SPACE_ID = "01a7d0f1-98f6-8159-8e42-0003a2205d3c"'),
    true
  );
  assert.equal(source.includes("tmp/notion-kst-20260920/cookies.txt"), true);
  assert.equal(source.includes("스크린샷_2026-10-06"), false);
  assert.equal(source.includes("/status/"), false);
});
