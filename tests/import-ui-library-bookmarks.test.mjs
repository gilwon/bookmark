// UI 컴포넌트 라이브러리 북마크 임포트 규칙을 검증한다
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
} from "../scripts/import-ui-library-bookmarks.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-ui-library-bookmarks.mjs"
);

const SITE_TAGS = {
  affectUI: ["컴포넌트", "ui"],
  Kobra: ["컴포넌트", "shadcn"],
  "Arc UI": ["모션", "ui"],
  "Evil Charts": ["차트", "ui"],
  Transitions: ["애니메이션"],
  beUI: ["애니메이션", "React"],
  BoardUI: ["대시보드"],
};

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// UI 컴포넌트 라이브러리 7곳을 bookmarks 디자인 카테고리에 저장한다"
  );
});

test("7개 사이트는 디자인 카테고리와 https 주소다", () => {
  assert.equal(CATEGORY, "디자인");
  assert.equal(ITEMS.length, 7);
  const titles = ITEMS.map((item) => item.title);
  assert.deepEqual(titles, [
    "affectUI",
    "Kobra",
    "Arc UI",
    "Evil Charts",
    "Transitions",
    "beUI",
    "BoardUI",
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
    toHttpsUrl("http://evilcharts.com"),
    "https://evilcharts.com/"
  );
});

test("슬래시만 다른 주소는 중복이고 경로와 www는 다르다", () => {
  assert.equal(
    isSameBookmarkUrl("https://uiarc.dev", "https://uiarc.dev/"),
    true
  );
  assert.equal(
    isSameBookmarkUrl("https://uiarc.dev/", "https://uiarc.dev/mcp"),
    false
  );
  assert.equal(
    isSameBookmarkUrl("https://affectui.com/", "https://www.affectui.com/"),
    false
  );
  assert.equal(
    isSameBookmarkUrl("https://boardui.com/", "https://www.boardui.com/"),
    false
  );
});

test("이미 있는 URL은 신규에서 뺀다", () => {
  const { pending, skippedDup } = filterNewItems(ITEMS, [
    "https://uiarc.dev/",
    "https://www.boardui.com/",
  ]);
  assert.deepEqual(
    pending.map((item) => item.title),
    ["affectUI", "Kobra", "Evil Charts", "Transitions", "beUI"]
  );
  assert.deepEqual(
    skippedDup.map((item) => item.title),
    ["Arc UI", "BoardUI"]
  );
});

test("기존 행의 저장된 URL을 찾는다", () => {
  const board = ITEMS.find((item) => item.title === "BoardUI");
  assert.equal(
    findExistingUrl([{ url: "https://www.boardui.com/" }], board),
    "https://www.boardui.com/"
  );
  assert.equal(
    findExistingUrl([{ url: "https://boardui.com/" }], board),
    null
  );
  const evil = ITEMS.find((item) => item.title === "Evil Charts");
  assert.equal(
    findExistingUrl([{ url: "https://evilcharts.com/docs" }], evil),
    null
  );
});
