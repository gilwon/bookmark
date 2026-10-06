// 한국 시간 10월 6일 Notion 신규 1건 이관 헬퍼를 네트워크 없이 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildMarkdown } from "../scripts/import-claude-eli5-page.mjs";
import {
  SKIPPED_HEXES,
  TARGETS,
  assertNoFileOrPdf,
  imageNameOf,
  preprocessBlocks,
  stripTracking,
} from "../scripts/import-notion-kst-20261007.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-notion-kst-20261007.mjs"
);

const SKIPPED = [
  "285b256827ac829cb58381e6c9409da2",
  "3db98dec8eed8107b5eac827fe906cce",
  "417b256827ac83d09bb7013942b14bef",
  "f7bb256827ac8381be0e81a4cb198bbe",
  "f65b256827ac82bbaa25014f824bab76",
  "9beb256827ac823fb0120170ad07c5b9",
  "ef4b256827ac8250ac8001830bc891b4",
];

const SHOT_EARLY = "스크린샷_2026-10-06_오후_5.05.01.png".normalize("NFC");
const SHOT_LATE = "스크린샷_2026-10-06_오후_4.59.59.png".normalize("NFC");
const JARROD =
  "https://x.com/jarrodwatts/status/2105858869482471602";

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 한국 시간 10월 6일 Notion 신규 1건을 Pages에만 저장한다"
  );
});

test("대상 1건의 제목·hex·본문 수가 맞다", () => {
  assert.equal(TARGETS.length, 1);
  const item = TARGETS.find((row) => row.key === "mods");
  assert.ok(item);
  assert.equal(
    item.title,
    "[trenddalkak] Claude Code Mods 입문 가이드+ 바로 따라할 프롬프트 + 추천 Mods"
  );
  assert.equal(item.hex, "7e6b256827ac8249ab380184459a6b47");
  assert.equal(item.pageId, "7e6b2568-27ac-8249-ab38-0184459a6b47");
  assert.equal(
    item.sourceUrl,
    "https://app.notion.com/p/7e6b256827ac8249ab380184459a6b47"
  );
  assert.equal(item.images, 2);
  assert.equal(item.attachments, 0);
  assert.equal(item.root, 131);
  assert.equal(item.tables, 0);
  assert.equal(item.codes, 18);
  assert.equal(item.imageMime, undefined);
  assert.deepEqual(item.imageFiles, [SHOT_EARLY, SHOT_LATE]);
  for (const name of item.imageFiles) {
    assert.equal(name, name.normalize("NFC"));
  }
  assert.deepEqual(item.phrases, ["PART 1. 입문 가이드", "게임에 Mod 깔듯"]);
  assert.deepEqual(item.requiredHrefs, [
    "https://claude.com/blog/claude-code-mods",
    "https://claude.dev/blog/getting-started-with-claude-code-mods/",
    "https://claude.dev/",
    "https://www.instagram.com/trenddalkak.ai",
    JARROD,
    "https://x.com/anshuc/status/2105773281936650247",
    "https://x.com/edwinarbus/status/2105869772219105325",
    "https://x.com/jarrodwatts/status/2106153410697564235",
    "https://x.com/oikon48/status/2106047469767569801",
  ]);
  assert.equal(item.sourceUrl.includes("source=copy_link"), false);
  assert.equal(item.sourceUrl.includes("fbclid"), false);
});

test("이미 이관된 hex는 대상이 아니다", () => {
  assert.deepEqual([...SKIPPED_HEXES], SKIPPED);
  const hexes = TARGETS.map((item) => item.hex);
  assert.equal(hexes.includes("7e6b256827ac8249ab380184459a6b47"), true);
  assert.equal(SKIPPED_HEXES.includes("ef4b256827ac8250ac8001830bc891b4"), true);
  for (const hex of SKIPPED_HEXES) {
    assert.equal(hexes.includes(hex), false, hex);
  }
});

test("stripTracking은 utm과 fbclid를 빼고 x.com의 s만 뺀다", () => {
  const item = TARGETS.find((row) => row.key === "mods");
  const dirty = `${item.sourceUrl}?utm_source=share&utm_medium=social&fbclid=IwAR123&source=copy_link`;
  const cleaned = stripTracking(dirty);
  assert.equal(cleaned.includes("utm_"), false);
  assert.equal(cleaned.includes("fbclid"), false);
  assert.equal(cleaned.includes("source=copy_link"), false);
  assert.equal(cleaned, item.sourceUrl);

  const tweet = stripTracking(`${JARROD}?s=20`);
  assert.equal(tweet, JARROD);
  assert.equal(tweet.includes("s=20"), false);

  const twitter = stripTracking(
    "https://twitter.com/foo/status/1?s=20&utm_source=x"
  );
  assert.equal(twitter, "https://twitter.com/foo/status/1");
  assert.equal(twitter.includes("s="), false);
  assert.equal(twitter.includes("utm_"), false);

  const threads = stripTracking(
    "https://l.threads.com/?u=http%3A%2F%2FClaude.dev%2F&e=secret"
  );
  assert.equal(threads, "https://claude.dev/");
  assert.equal(threads.includes("secret"), false);
  assert.equal(threads.includes("l.threads.com"), false);

  const other = stripTracking("https://example.com/path?s=keep&utm_source=x&fbclid=abc");
  assert.equal(other.includes("utm_"), false);
  assert.equal(other.includes("fbclid"), false);
  assert.equal(other.includes("s=keep"), true);
  assert.equal(other, "https://example.com/path?s=keep");
});

test("tweet 블록은 상태 URL 링크 문단으로 남고 s 쿼리는 빠진다", () => {
  const pageId = "7e6b2568-27ac-8249-ab38-0184459a6b47";
  const tweetId = "tweet-1";
  const blocks = new Map([
    [
      pageId,
      {
        id: pageId,
        type: "page",
        properties: { title: [["Mods"]] },
        content: [tweetId],
      },
    ],
    [
      tweetId,
      {
        id: tweetId,
        type: "tweet",
        properties: {
          source: [[`${JARROD}?s=20`]],
        },
      },
    ],
  ]);
  preprocessBlocks(blocks);
  const tweet = blocks.get(tweetId);
  assert.equal(tweet.type, "text");
  const { markdown } = buildMarkdown(blocks, pageId, TARGETS[0].sourceUrl);
  assert.equal(markdown.includes(JARROD), true);
  assert.equal(markdown.includes(`[${JARROD}](${JARROD})`), true);
  assert.equal(markdown.includes("s=20"), false);
  assert.equal(markdown.includes("?s="), false);
});

test("attachment 파일명은 제목보다 우선하고 한글 NFC를 유지한다", () => {
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
        title: [["다른 제목"]],
        source: [[`attachment:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:${SHOT_EARLY}`]],
      },
    }),
    SHOT_EARLY
  );
  assert.equal(SHOT_EARLY, SHOT_EARLY.normalize("NFC"));
  assert.equal(SHOT_LATE, SHOT_LATE.normalize("NFC"));
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
