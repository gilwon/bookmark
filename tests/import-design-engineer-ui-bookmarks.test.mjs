// 디자인 엔지니어 UI 라이브러리 북마크 임포트 규칙을 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  CATEGORY,
  ITEMS,
  filterNewItems,
  findExistingUrl,
  isSameBookmarkUrl,
  toHttpsUrl,
} from "../scripts/import-design-engineer-ui-bookmarks.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-design-engineer-ui-bookmarks.mjs"
);

const SITE_TAGS = {
  termcn: "터미널",
  audiocn: "오디오",
  "Arc UI": "모션",
  "Beautiful UI": "프리미티브",
  "23rd": "셰이더",
  Bencho: "인터랙션",
  BoardUI: "에이전트",
};

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 디자인 엔지니어 UI 라이브러리 7곳을 bookmarks 디자인 카테고리에 저장한다"
  );
});

test("7개 사이트는 디자인 카테고리와 https 주소다", () => {
  assert.equal(CATEGORY, "디자인");
  assert.equal(ITEMS.length, 7);
  const titles = ITEMS.map((item) => item.title);
  assert.deepEqual(titles, [
    "termcn",
    "audiocn",
    "Arc UI",
    "Beautiful UI",
    "23rd",
    "Bencho",
    "BoardUI",
  ]);
  for (const item of ITEMS) {
    assert.equal(item.url.startsWith("https://"), true);
    assert.equal(item.tags.includes("디자인"), false);
    assert.equal(item.tags.includes("ui"), true);
    assert.equal(item.description.length > 10, true);
    assert.equal(item.tags.includes(SITE_TAGS[item.title]), true);
  }
});

test("http 주소는 https로 올린다", () => {
  assert.equal(toHttpsUrl("http://termcn.dev"), "https://termcn.dev/");
});

test("슬래시만 다른 주소는 중복이고 www는 다른 호스트다", () => {
  assert.equal(
    isSameBookmarkUrl("https://uiarc.dev", "https://uiarc.dev/"),
    true
  );
  assert.equal(
    isSameBookmarkUrl("https://bencho.dev/", "https://www.bencho.dev/"),
    false
  );
});

test("이미 있는 URL은 신규에서 뺀다", () => {
  const { pending, skippedDup } = filterNewItems(ITEMS, [
    "https://www.boardui.com/",
  ]);
  assert.deepEqual(
    pending.map((item) => item.title),
    ["termcn", "audiocn", "Arc UI", "Beautiful UI", "23rd", "Bencho"]
  );
  assert.deepEqual(
    skippedDup.map((item) => item.title),
    ["BoardUI"]
  );
});

test("기존 행의 저장된 URL을 찾는다", () => {
  const board = ITEMS.find((item) => item.title === "BoardUI");
  assert.equal(
    findExistingUrl([{ url: "https://www.boardui.com/" }], board),
    "https://www.boardui.com/"
  );
  assert.equal(
    findExistingUrl([{ url: "https://example.com/" }], board),
    null
  );
});
