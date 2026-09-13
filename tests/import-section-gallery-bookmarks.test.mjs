// 히어로·내비·푸터 레퍼런스 북마크 임포트 규칙을 검증한다
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
} from "../scripts/import-section-gallery-bookmarks.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-section-gallery-bookmarks.mjs"
);

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 히어로·내비·푸터 레퍼런스 3곳을 bookmarks 디자인 카테고리에 저장한다"
  );
});

test("3개 사이트는 디자인 카테고리와 https 주소다", () => {
  assert.equal(CATEGORY, "디자인");
  assert.equal(ITEMS.length, 3);
  const titles = ITEMS.map((item) => item.title);
  assert.deepEqual(titles, ["Supahero", "Navbar Gallery", "Footer Design"]);
  for (const item of ITEMS) {
    assert.equal(item.url.startsWith("https://"), true);
    assert.equal(item.tags.includes("디자인"), false);
    assert.equal(item.description.length > 10, true);
  }
});

test("http 주소는 https로 올린다", () => {
  assert.equal(toHttpsUrl("http://supahero.io"), "https://supahero.io/");
});

test("슬래시만 다른 주소는 중복이고 www는 다른 호스트다", () => {
  assert.equal(
    isSameBookmarkUrl("https://supahero.io", "https://supahero.io/"),
    true
  );
  assert.equal(
    isSameBookmarkUrl(
      "https://navbar.gallery/",
      "https://www.navbar.gallery/"
    ),
    false
  );
});

test("이미 있는 URL은 신규에서 뺀다", () => {
  const { pending, skippedDup } = filterNewItems(ITEMS, [
    "https://supahero.io/",
  ]);
  assert.deepEqual(
    pending.map((item) => item.title),
    ["Navbar Gallery", "Footer Design"]
  );
  assert.deepEqual(
    skippedDup.map((item) => item.title),
    ["Supahero"]
  );
});

test("기존 행의 저장된 URL을 찾는다", () => {
  assert.equal(
    findExistingUrl([{ url: "https://supahero.io/" }], ITEMS[0]),
    "https://supahero.io/"
  );
  assert.equal(
    findExistingUrl([{ url: "https://example.com/" }], ITEMS[0]),
    null
  );
});
