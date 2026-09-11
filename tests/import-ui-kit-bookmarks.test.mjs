// UI 키트 북마크 임포트 규칙을 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  CATEGORY,
  ITEMS,
  filterNewItems,
  isSameBookmarkUrl,
  toHttpsUrl,
} from "../scripts/import-ui-kit-bookmarks.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-ui-kit-bookmarks.mjs"
);

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// UI 키트 7개 공식 사이트를 bookmarks 디자인 카테고리에 저장한다"
  );
});

test("7개 사이트는 디자인 카테고리와 https 주소다", () => {
  assert.equal(CATEGORY, "디자인");
  assert.equal(ITEMS.length, 7);
  const titles = ITEMS.map((item) => item.title);
  assert.deepEqual(titles, [
    "Untitled UI",
    "Flowbite",
    "shadcn/ui",
    "HyperUI",
    "Preline UI",
    "daisyUI",
    "Radix UI",
  ]);
  for (const item of ITEMS) {
    assert.equal(item.url.startsWith("https://"), true);
    assert.equal(item.tags.includes("디자인"), false);
    assert.equal(item.description.length > 10, true);
  }
});

test("http 주소는 https로 올린다", () => {
  assert.equal(toHttpsUrl("http://flowbite.com"), "https://flowbite.com/");
});

test("쿼리와 슬래시만 다른 주소는 중복이다", () => {
  assert.equal(
    isSameBookmarkUrl("https://ui.shadcn.com", "https://ui.shadcn.com/"),
    true
  );
  const { pending, skippedDup } = filterNewItems(ITEMS, [
    "http://flowbite.com/?ref=x",
    "https://example.com/",
  ]);
  assert.equal(skippedDup.map((item) => item.title).join(","), "Flowbite");
  assert.equal(pending.length, 6);
});
