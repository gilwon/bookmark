// 웹디자인 참고 사이트 북마크 임포트 규칙을 검증한다
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
} from "../scripts/import-design-web-reference-bookmarks.mjs";

const SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scripts/import-design-web-reference-bookmarks.mjs"
);

const SITE_TAGS = {
  "Minimal Gallery": ["갤러리", "미니멀"],
  Kage: ["프롬프트", "ui"],
  "Refero Styles": ["Refero", "DESIGN.md"],
  "Component Gallery": ["컴포넌트", "ui"],
  "AppShot Gallery": ["모바일", "앱"],
  "DESIGN.md": ["디자인시스템", "AI"],
  VibePrompts: ["프롬프트", "랜딩"],
  "21st.dev": ["21st", "컴포넌트"],
  Kinetics: ["모션", "CSS"],
  "Circle Loaders": ["로딩", "SVG"],
  "Gradient Buttons": ["버튼", "CSS"],
  "Anime.js": ["애니메이션", "SVG"],
  Kitbitz: ["일러스트", "CC0"],
  "3dicons": ["아이콘", "3D", "CC0"],
};

const REFERENCE_TITLES = [
  "Minimal Gallery",
  "Kage",
  "Refero Styles",
  "Component Gallery",
  "AppShot Gallery",
];

test("스크립트 첫 줄은 한글 역할 주석이다", () => {
  const source = readFileSync(SCRIPT_PATH, "utf8");
  assert.equal(
    source.split("\n")[0],
    "// 웹디자인 참고 사이트 14곳을 bookmarks 디자인 카테고리에 저장한다"
  );
});

test("14개 사이트는 디자인 카테고리와 https 주소다", () => {
  assert.equal(CATEGORY, "디자인");
  assert.equal(ITEMS.length, 14);
  assert.deepEqual(
    ITEMS.map((item) => item.title),
    [
      "Minimal Gallery",
      "Kage",
      "Refero Styles",
      "Component Gallery",
      "AppShot Gallery",
      "DESIGN.md",
      "VibePrompts",
      "21st.dev",
      "Kinetics",
      "Circle Loaders",
      "Gradient Buttons",
      "Anime.js",
      "Kitbitz",
      "3dicons",
    ]
  );
  for (const item of ITEMS) {
    assert.equal(item.url.startsWith("https://"), true);
    assert.equal(item.tags.includes("디자인"), false);
    assert.equal(item.tags.includes("UI"), false);
    assert.equal(item.description.length > 10, true);
    for (const tag of SITE_TAGS[item.title]) {
      assert.equal(item.tags.includes(tag), true, item.title);
    }
  }
  const appshot = ITEMS.find((item) => item.title === "AppShot Gallery");
  assert.equal(appshot.url, "https://www.appshot.gallery/");
  for (const item of ITEMS) {
    const isReference = REFERENCE_TITLES.includes(item.title);
    assert.equal(item.description.includes("사용 조건을 확인하세요."), isReference);
  }
  assert.equal(
    ITEMS.find((item) => item.title === "Kitbitz").description.includes("CC0"),
    true
  );
  assert.equal(
    ITEMS.find((item) => item.title === "3dicons").description.includes("CC0"),
    true
  );
  assert.equal(
    ITEMS.find((item) => item.title === "21st.dev").description.includes("하루 2개"),
    true
  );
});

test("http 주소는 https로 올린다", () => {
  assert.equal(toHttpsUrl("http://minimal.gallery"), "https://minimal.gallery/");
});

test("슬래시만 다른 주소는 중복이고 경로와 www는 다르다", () => {
  assert.equal(
    isSameBookmarkUrl("https://21st.dev", "https://21st.dev/"),
    true
  );
  assert.equal(
    isSameBookmarkUrl("https://21st.dev/", "https://21st.dev/community/components"),
    false
  );
  assert.equal(
    isSameBookmarkUrl("https://appshot.gallery/", "https://www.appshot.gallery/"),
    false
  );
});

test("이미 있는 URL은 신규에서 뺀다", () => {
  const { pending, skippedDup } = filterNewItems(ITEMS, [
    "https://minimal.gallery/",
    "https://styles.refero.design/",
    "https://21st.dev/",
  ]);
  assert.deepEqual(
    skippedDup.map((item) => item.title),
    ["Minimal Gallery", "Refero Styles", "21st.dev"]
  );
  assert.equal(pending.length, 11);
  assert.equal(
    pending.some((item) => item.title === "21st.dev"),
    false
  );
});

test("기존 행의 저장된 URL을 찾는다", () => {
  const site = ITEMS.find((item) => item.title === "21st.dev");
  assert.equal(
    findExistingUrl([{ url: "https://21st.dev/" }], site),
    "https://21st.dev/"
  );
  assert.equal(
    findExistingUrl([{ url: "https://21st.dev/community/components" }], site),
    null
  );
  const appshot = ITEMS.find((item) => item.title === "AppShot Gallery");
  assert.equal(
    findExistingUrl([{ url: "https://appshot.gallery/" }], appshot),
    null
  );
});
