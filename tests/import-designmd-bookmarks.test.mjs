// DESIGN.md·UI 사이트 북마크 임포트 규칙을 검증한다
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  CATEGORY,
  ITEMS,
  filterNewItems,
  isEmptyTags,
  isSameBookmarkUrl,
  itemsNeedingTags,
  toHttpsUrl,
} from "../scripts/import-designmd-bookmarks.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-designmd-bookmarks.mjs"
);

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// DESIGN.md·UI 사이트 7개를 bookmarks 디자인 카테고리에 저장한다"
  );
});

test("7개 사이트는 디자인 카테고리와 https 주소다", () => {
  assert.equal(CATEGORY, "디자인");
  assert.equal(ITEMS.length, 7);
  const titles = ITEMS.map((item) => item.title);
  assert.deepEqual(titles, [
    "GetLayers",
    "shadcn/ui",
    "designmd.supply",
    "21st.dev",
    "designmd.me",
    "designmd.co",
    "getdesign.md",
  ]);
  for (const item of ITEMS) {
    assert.equal(item.url.startsWith("https://"), true);
    assert.equal(item.tags.includes("디자인"), false);
    assert.equal(item.description.length > 10, true);
  }
});

test("http 주소는 https로 올린다", () => {
  assert.equal(toHttpsUrl("http://21st.dev"), "https://21st.dev/");
});

test("슬래시만 다른 주소는 중복이고 다른 경로는 별건이다", () => {
  assert.equal(
    isSameBookmarkUrl("https://21st.dev", "https://21st.dev/"),
    true
  );
  assert.equal(
    isSameBookmarkUrl(
      "https://21st.dev/",
      "https://21st.dev/community/components"
    ),
    false
  );
});

test("이미 있는 URL은 신규에서 뺀다", () => {
  const { pending, skippedDup } = filterNewItems(ITEMS, [
    "https://www.getlayers.ai/",
    "https://ui.shadcn.com/",
    "https://getdesign.md/",
  ]);
  assert.deepEqual(
    pending.map((item) => item.title),
    ["designmd.supply", "21st.dev", "designmd.me", "designmd.co"]
  );
  assert.deepEqual(
    skippedDup.map((item) => item.title),
    ["GetLayers", "shadcn/ui", "getdesign.md"]
  );
});

test("빈 태그만 채울 대상으로 본다", () => {
  assert.equal(isEmptyTags(null), true);
  assert.equal(isEmptyTags([]), true);
  assert.equal(isEmptyTags("[]"), true);
  assert.equal(isEmptyTags(""), true);
  assert.equal(isEmptyTags(["shadcn"]), false);
  const tagged = itemsNeedingTags(ITEMS, [
    { url: "https://www.getlayers.ai/", tags: "[]" },
    { url: "https://ui.shadcn.com/", tags: '["shadcn"]' },
  ]);
  assert.deepEqual(
    tagged.map((item) => item.title),
    ["GetLayers"]
  );
});
