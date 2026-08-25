// 브랜드 로고 사이트 북마크 임포트 규칙을 검증한다
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
} from "../scripts/import-logo-maker-bookmarks.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-logo-maker-bookmarks.mjs"
);

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 브랜드 로고 생성 사이트 5개를 bookmarks 디자인 카테고리에 저장한다"
  );
});

test("5개 사이트는 디자인 카테고리와 https 주소다", () => {
  assert.equal(CATEGORY, "디자인");
  assert.equal(ITEMS.length, 5);
  const titles = ITEMS.map((item) => item.title);
  assert.deepEqual(titles, [
    "Looka",
    "Logomark",
    "Brandmark",
    "Hatchful",
    "Namelix",
  ]);
  for (const item of ITEMS) {
    assert.equal(item.url.startsWith("https://"), true);
    assert.equal(item.tags.includes("디자인"), false);
    assert.equal(item.tags.includes("로고") || item.title === "Namelix", true);
    assert.equal(item.description.length > 10, true);
  }
});

test("http 주소는 https로 올린다", () => {
  assert.equal(toHttpsUrl("http://looka.com"), "https://looka.com/");
  assert.equal(toHttpsUrl("http://namelix.com/"), "https://namelix.com/");
});

test("쿼리와 슬래시만 다른 주소는 중복이다", () => {
  assert.equal(
    isSameBookmarkUrl("https://looka.com", "https://looka.com/"),
    true
  );
  const { pending, skippedDup } = filterNewItems(ITEMS, [
    "http://looka.com/?ref=x",
    "https://example.com/",
  ]);
  assert.equal(skippedDup.map((item) => item.title).join(","), "Looka");
  assert.equal(pending.length, 4);
});
