// 디자인 레퍼런스 북마크 임포트 규칙을 검증한다
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
} from "../scripts/import-design-reference-bookmarks.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-design-reference-bookmarks.mjs"
);

const SITE_TAGS = {
  AlignUI: ["컴포넌트", "ui"],
  BentoGrids: ["벤토"],
  Grainient: ["배경"],
  Mobbin: ["영감"],
  "Kargul Swipe File": ["스와이프파일", "제품"],
};

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 디자인 레퍼런스 5곳을 bookmarks 디자인 카테고리에 저장한다"
  );
});

test("5개 사이트는 디자인 카테고리와 https 주소다", () => {
  assert.equal(CATEGORY, "디자인");
  assert.equal(ITEMS.length, 5);
  const titles = ITEMS.map((item) => item.title);
  assert.deepEqual(titles, [
    "AlignUI",
    "BentoGrids",
    "Grainient",
    "Mobbin",
    "Kargul Swipe File",
  ]);
  for (const item of ITEMS) {
    assert.equal(item.url.startsWith("https://"), true);
    assert.equal(item.tags.includes("디자인"), false);
    assert.equal(item.tags.includes("UI"), false);
    assert.equal(item.description.length > 10, true);
    for (const tag of SITE_TAGS[item.title]) {
      assert.equal(item.tags.includes(tag), true);
    }
  }
});

test("http 주소는 https로 올린다", () => {
  assert.equal(
    toHttpsUrl("http://grainient.supply"),
    "https://grainient.supply/"
  );
});

test("슬래시만 다른 주소는 중복이고 경로와 www는 다르다", () => {
  assert.equal(
    isSameBookmarkUrl("https://mobbin.com", "https://mobbin.com/"),
    true
  );
  assert.equal(
    isSameBookmarkUrl("https://mobbin.com/", "https://mobbin.com/mcp"),
    false
  );
  assert.equal(
    isSameBookmarkUrl("https://bentogrids.com/", "https://www.bentogrids.com/"),
    false
  );
});

test("이미 있는 URL은 신규에서 뺀다", () => {
  const { pending, skippedDup } = filterNewItems(ITEMS, [
    "https://bentogrids.com/",
    "https://mobbin.com/",
  ]);
  assert.deepEqual(
    pending.map((item) => item.title),
    ["AlignUI", "Grainient", "Kargul Swipe File"]
  );
  assert.deepEqual(
    skippedDup.map((item) => item.title),
    ["BentoGrids", "Mobbin"]
  );
});

test("기존 행의 저장된 URL을 찾는다", () => {
  const mobbin = ITEMS.find((item) => item.title === "Mobbin");
  assert.equal(
    findExistingUrl([{ url: "https://mobbin.com/" }], mobbin),
    "https://mobbin.com/"
  );
  assert.equal(
    findExistingUrl([{ url: "https://mobbin.com/mcp" }], mobbin),
    null
  );
});
