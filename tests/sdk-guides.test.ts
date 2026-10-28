// 김스듴 가이드 전체 목록과 검색·분류·정렬의 동작을 검증한다.
import assert from "node:assert/strict";
import test from "node:test";
import { filterSdkGuides, getSdkGuide, listSdkGuides, SDK_GUIDES_SOURCE } from "../src/lib/sdk-guides";

test("원본 3페이지의 가이드 71건은 고유한 출처와 유효한 메타데이터를 가진다", () => {
  const guides = listSdkGuides();
  assert.equal(guides.length, 71);
  assert.equal(new Set(guides.map((guide) => guide.slug)).size, 71);
  assert.equal(new Set(guides.map((guide) => guide.sourceUrl)).size, 71);
  for (const guide of guides) {
    assert.ok(guide.title && guide.category);
    assert.equal(typeof guide.tool, "string");
    assert.ok(guide.tags.length > 0);
    assert.ok(Number.isFinite(Date.parse(guide.publishedAt)));
    assert.equal(guide.sourceUrl, `${SDK_GUIDES_SOURCE}${guide.slug}/`);
    assert.deepEqual(Object.keys(guide).sort(), ["category", "publishedAt", "slug", "sourceUrl", "tags", "title", "tool"]);
    assert.equal(getSdkGuide(guide.slug)?.title, guide.title);
  }
  assert.equal(getSdkGuide("does-not-exist"), undefined);
});

test("제목과 태그는 대소문자·공백을 무시해 검색하고 빈 검색어는 전체를 반환한다", () => {
  const guides = listSdkGuides();
  const guide = guides[0];
  assert.ok(filterSdkGuides(guides, { query: guide.title.toUpperCase().replace(/\s/gu, "   ") }).some((item) => item.slug === guide.slug));
  assert.ok(filterSdkGuides(guides, { query: guide.tags[0].toUpperCase() }).some((item) => item.slug === guide.slug));
  assert.equal(filterSdkGuides(guides, { query: "   " }).length, 71);
  assert.equal(filterSdkGuides(guides, { query: "존재하지않는가이드제목123456789" }).length, 0);
});

test("카테고리와 도구와 검색어를 함께 적용하고 원본 목록을 바꾸지 않는다", () => {
  const guides = listSdkGuides();
  const before = structuredClone(guides);
  const guide = guides[0];
  const results = filterSdkGuides(guides, { category: guide.category, tool: guide.tool, query: guide.title });
  assert.deepEqual(results.map((item) => item.slug), [guide.slug]);
  assert.equal(filterSdkGuides(guides, { category: "없는 분류" }).length, 0);
  assert.equal(filterSdkGuides(guides, { tool: "없는 도구" }).length, 0);
  assert.deepEqual(guides, before);
});

test("최신순과 오래된순은 발행일을 기준으로 전체 목록을 정렬한다", () => {
  const guides = listSdkGuides();
  const before = structuredClone(guides);
  const newest = filterSdkGuides(guides);
  const oldest = filterSdkGuides(guides, { sort: "oldest" });
  for (let i = 1; i < guides.length; i++) {
    assert.ok(Date.parse(newest[i - 1].publishedAt) >= Date.parse(newest[i].publishedAt));
    assert.ok(Date.parse(oldest[i - 1].publishedAt) <= Date.parse(oldest[i].publishedAt));
  }
  assert.deepEqual(guides, before);
  assert.notEqual(listSdkGuides(), listSdkGuides());
});
