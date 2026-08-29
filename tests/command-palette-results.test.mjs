// ⌘K 팔레트 목록 병합 순서를 검증한다
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergePaletteItems,
  SEARCH_TYPE_LABEL,
} from "../src/lib/command-palette-results.ts";

const navItems = [
  { id: "nav-home", label: "홈", keywords: "dashboard 대시보드" },
  { id: "nav-bookmarks", label: "북마크", keywords: "bookmarks" },
  { id: "nav-pages", label: "페이지", keywords: "pages" },
];

function pageItem(id = "p1") {
  return {
    type: "page",
    id,
    title: "회의 노트",
    subtitle: "페이지",
    href: `/pages/${id}`,
  };
}

describe("mergePaletteItems", () => {
  it("빈 쿼리면 내비만 그대로 둔다", () => {
    const rows = mergePaletteItems({
      navItems,
      searchItems: [pageItem()],
      q: "   ",
      loading: true,
    });
    assert.deepEqual(
      rows.map((r) => r.kind),
      ["nav", "nav", "nav"]
    );
    assert.deepEqual(
      rows.map((r) => r.id),
      ["nav-home", "nav-bookmarks", "nav-pages"]
    );
  });

  it("쿼리가 있으면 맨 위가 통합 검색 액션이다", () => {
    const rows = mergePaletteItems({
      navItems,
      searchItems: [],
      q: " 노트 ",
      loading: false,
    });
    assert.equal(rows[0].kind, "search-action");
    assert.equal(rows[0].id, "action-search");
    assert.equal(rows[0].label, "「노트」통합 검색");
  });

  it("순서는 통합검색 → 검색결과 → 로딩행 → 필터된 내기다", () => {
    const searchItems = [
      pageItem("p1"),
      {
        type: "bookmark",
        id: "b1",
        title: "MDN",
        subtitle: "docs",
        href: "https://developer.mozilla.org",
        external: true,
      },
    ];
    const rows = mergePaletteItems({
      navItems,
      searchItems,
      q: "북",
      loading: true,
    });
    assert.deepEqual(
      rows.map((r) => [r.kind, r.id]),
      [
        ["search-action", "action-search"],
        ["search", "search-page-p1"],
        ["search", "search-bookmark-b1"],
        ["loading", "search-loading"],
        ["nav", "nav-bookmarks"],
      ]
    );
    assert.equal(rows[3].label, "검색 중…");
    assert.equal(rows[3].disabled, true);
  });

  it("로딩만 있으면 검색 액션 다음·내비 앞에 둔다", () => {
    const rows = mergePaletteItems({
      navItems,
      searchItems: [],
      q: "aa",
      loading: true,
    });
    assert.deepEqual(
      rows.map((r) => r.kind),
      ["search-action", "loading"]
    );
  });

  it("내비는 라벨과 키워드로 필터한다", () => {
    const byLabel = mergePaletteItems({
      navItems,
      searchItems: [],
      q: "홈",
      loading: false,
    });
    assert.deepEqual(
      byLabel.filter((r) => r.kind === "nav").map((r) => r.id),
      ["nav-home"]
    );

    const byKeyword = mergePaletteItems({
      navItems,
      searchItems: [],
      q: "dashboard",
      loading: false,
    });
    assert.deepEqual(
      byKeyword.filter((r) => r.kind === "nav").map((r) => r.id),
      ["nav-home"]
    );
  });

  it("검색 결과 타입 라벨을 붙인다", () => {
    const items = [
      pageItem(),
      {
        type: "prompt",
        id: "pr1",
        title: "요약",
        subtitle: "프롬프트",
        href: "/prompts/pr1",
      },
      {
        type: "bookmark",
        id: "b1",
        title: "MDN",
        subtitle: "링크",
        href: "https://example.com",
        external: true,
      },
      {
        type: "star",
        id: "s1",
        title: "vercel/next.js",
        subtitle: "TypeScript",
        href: "https://github.com/vercel/next.js",
        external: true,
      },
      {
        type: "agent-doc",
        id: "a1",
        title: "규칙",
        subtitle: "문서",
        href: "/agent-docs/a1",
      },
    ];
    const rows = mergePaletteItems({
      navItems,
      searchItems: items,
      q: "aa",
      loading: false,
    });
    const searchRows = rows.filter((r) => r.kind === "search");
    assert.deepEqual(
      searchRows.map((r) => r.typeLabel),
      ["페이지", "프롬프트", "북마크", "Star", "문서"]
    );
    assert.deepEqual(SEARCH_TYPE_LABEL, {
      page: "페이지",
      copy: "카피",
      prompt: "프롬프트",
      bookmark: "북마크",
      star: "Star",
      "agent-doc": "문서",
    });
    assert.equal(searchRows[0].label, "회의 노트");
    assert.equal(searchRows[0].subtitle, "페이지");
  });
});
