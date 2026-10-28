// React UI·모션 사이트 북마크 임포트 규칙을 검증한다
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
} from "../scripts/import-react-ui-motion-bookmarks.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-react-ui-motion-bookmarks.mjs"
);

const NEW_UI_TITLES = ["ReUI", "Spectrum UI", "ReactDrops", "FeralUI", "8bitcn"];

const EXISTING_URLS = [
  "https://21st.dev/",
  "https://bencho.dev/",
  "https://transitions.dev/",
  "https://kinetics.colorion.co/",
  "https://evilcharts.com/",
  "https://www.affectui.com/",
];

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// React UI·모션 사이트 11곳을 bookmarks 디자인 카테고리에 저장한다"
  );
});

test("11개 사이트는 디자인 카테고리와 https 주소다", () => {
  assert.equal(CATEGORY, "디자인");
  assert.equal(ITEMS.length, 11);
  const titles = ITEMS.map((item) => item.title);
  assert.deepEqual(titles, [
    "ReUI",
    "21st.dev",
    "Spectrum UI",
    "ReactDrops",
    "Bencho",
    "Transitions",
    "FeralUI",
    "Kinetics",
    "8bitcn",
    "Evil Charts",
    "affectUI",
  ]);
  for (const item of ITEMS) {
    assert.equal(item.url.startsWith("https://"), true);
    assert.equal(item.tags.includes("디자인"), false);
    assert.equal(item.tags.includes("UI"), false);
    assert.equal(item.description.length > 10, true);
  }
  for (const title of NEW_UI_TITLES) {
    const item = ITEMS.find((row) => row.title === title);
    assert.equal(item.tags.includes("ui"), true);
  }
  assert.equal(
    ITEMS.find((item) => item.title === "8bitcn").url,
    "https://www.8bitcn.com/"
  );
  assert.equal(
    ITEMS.find((item) => item.title === "affectUI").url,
    "https://www.affectui.com/"
  );
});

test("http 주소는 https로 올린다", () => {
  assert.equal(toHttpsUrl("http://reui.io"), "https://reui.io/");
});

test("슬래시만 다른 주소는 중복이고 경로와 www는 다르다", () => {
  assert.equal(
    isSameBookmarkUrl("https://reui.io", "https://reui.io/"),
    true
  );
  assert.equal(
    isSameBookmarkUrl("https://affectui.com/", "https://www.affectui.com/"),
    false
  );
  assert.equal(
    isSameBookmarkUrl("https://8bitcn.com/", "https://www.8bitcn.com/"),
    false
  );
  assert.equal(
    isSameBookmarkUrl(
      "https://21st.dev/",
      "https://21st.dev/community/components"
    ),
    false
  );
  assert.equal(
    isSameBookmarkUrl("https://feralui.dev/", "https://www.feralui.dev/"),
    false
  );
});

test("이미 있는 URL은 신규에서 뺀다", () => {
  const { pending, skippedDup } = filterNewItems(ITEMS, EXISTING_URLS);
  assert.deepEqual(
    pending.map((item) => item.title),
    ["ReUI", "Spectrum UI", "ReactDrops", "FeralUI", "8bitcn"]
  );
  assert.deepEqual(
    skippedDup.map((item) => item.title),
    ["21st.dev", "Bencho", "Transitions", "Kinetics", "Evil Charts", "affectUI"]
  );
});

test("기존 행의 저장된 URL을 찾는다", () => {
  const affect = ITEMS.find((item) => item.title === "affectUI");
  assert.equal(
    findExistingUrl([{ url: "https://www.affectui.com/" }], affect),
    "https://www.affectui.com/"
  );
  assert.equal(
    findExistingUrl([{ url: "https://affectui.com/" }], affect),
    null
  );
  const eight = ITEMS.find((item) => item.title === "8bitcn");
  assert.equal(
    findExistingUrl([{ url: "https://www.8bitcn.com/" }], eight),
    "https://www.8bitcn.com/"
  );
  assert.equal(findExistingUrl([{ url: "https://8bitcn.com/" }], eight), null);
});

test("bookmarks update는 is_favorite만 바꾼다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  const sqlUpdates = [...source.matchAll(/UPDATE\s+bookmarks\s+SET\s+([^;]+)/gi)];
  const clientUpdates = [
    ...source.matchAll(/\.from\("bookmarks"\)[\s\S]{0,120}?\.update\(\{([^}]+)\}/g),
  ];
  const clauses = [...sqlUpdates, ...clientUpdates].map((match) => match[1]);
  assert.equal(clauses.length > 0, true);
  for (const clause of clauses) {
    assert.match(clause, /is_favorite/);
    assert.equal(/\btitle\b/.test(clause), false);
    assert.equal(/\bdescription\b/.test(clause), false);
    assert.equal(/\btags\b/.test(clause), false);
    assert.equal(/\bcategory\b/.test(clause), false);
  }
});
