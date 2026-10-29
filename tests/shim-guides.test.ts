// 심팀장 자료실 52건의 순서, 검색, 본문 주소를 검증한다.
import assert from "node:assert/strict";
import test from "node:test";
import { getShimGuideBody } from "../src/lib/shim-guide-body";
import { filterShimGuides, getShimGuide, listShimGuides } from "../src/lib/shim-guides";

const FORBIDDEN_BODY_SNIPPETS = [
  "fbclid",
  "utm_source",
  "og-home.png",
  "og-clone.png",
  "og-reverse.png",
  "og-weekend.png",
];

test("자료 52건은 사이트 순서와 고유한 주소, 정해진 키만 가진다", () => {
  const guides = listShimGuides();
  assert.equal(guides.length, 52);
  assert.equal(new Set(guides.map((guide) => guide.slug)).size, 52);
  assert.equal(new Set(guides.map((guide) => guide.sourceUrl)).size, 52);
  guides.forEach((guide, index) => {
    assert.equal(guide.order, index);
    assert.equal(guide.sourceUrl, `https://shimteamjjang.vercel.app/${guide.slug}`);
    assert.deepEqual(Object.keys(guide), ["slug", "title", "episode", "summary", "order", "sourceUrl"]);
  });
  assert.equal(guides[0].slug, "rea");
  assert.equal(guides[0].episode, "64편");
  assert.equal(guides[guides.length - 1].slug, "aicheatkey");
  assert.equal(guides[guides.length - 1].episode, "1편");
  assert.equal(guides.find((guide) => guide.slug === "erase")?.episode, "미게시");
  assert.equal(guides.find((guide) => guide.slug === "weekend")?.title, "주말에 클로드로 만들어 볼 프로젝트 5개");
  assert.equal(getShimGuide("does-not-exist"), undefined);
});

test("검색은 대소문자와 공백을 무시하고 빈 검색은 순서를 유지하며 원본을 바꾸지 않는다", () => {
  const guides = listShimGuides();
  const before = structuredClone(guides);
  const weekend = guides.find((guide) => guide.slug === "weekend");
  assert.ok(weekend);
  assert.ok(
    filterShimGuides(guides, { query: weekend.title.toUpperCase().replace(/\s/gu, "   ") }).some(
      (guide) => guide.slug === "weekend"
    )
  );
  assert.equal(filterShimGuides(guides, { query: "   " }).length, 52);
  assert.deepEqual(
    filterShimGuides(guides, { query: "" }).map((guide) => guide.slug),
    guides.map((guide) => guide.slug)
  );
  assert.equal(filterShimGuides(guides, { query: "존재하지않는자료제목123456789" }).length, 0);
  assert.deepEqual(guides, before);
});

test("52개 본문은 비어 있지 않고 캐릭터 이미지만 남긴다", () => {
  const guides = listShimGuides();
  for (const guide of guides) {
    const body = getShimGuideBody(guide.slug);
    assert.equal(typeof body, "string", guide.slug);
    assert.ok(body && body.trim() !== "", guide.slug);
    assert.equal(body?.includes("https://shimteamjjang.vercel.app/team.png"), true, guide.slug);
    const characterAlt = ["plugin", "token", "design", "convert"].includes(guide.slug)
      ? "심팀장님과 막내"
      : "심팀장님 캐릭터";
    assert.equal(body?.includes(characterAlt), true, guide.slug);
    for (const phrase of FORBIDDEN_BODY_SNIPPETS) {
      assert.equal(body?.includes(phrase), false, `${guide.slug} ${phrase}`);
    }
  }
  assert.equal(getShimGuideBody("does-not-exist"), undefined);
  const weekend = getShimGuideBody("weekend");
  assert.ok(weekend?.includes("나는 [내 분야] 콘텐츠를 만들어"));
  assert.ok(weekend?.includes("다섯 개"));
  assert.equal(
    getShimGuideBody("rug")?.includes("https://shimteamjjang.vercel.app/rug/gh-2-releases.png"),
    true
  );
  const move = getShimGuideBody("move");
  assert.equal(move?.includes("https://shimteamjjang.vercel.app/move/s1_설정메모리.png"), true);
  assert.equal(move?.includes("https://shimteamjjang.vercel.app/s1_설정메모리.png"), false);
  assert.equal(getShimGuideBody("rea")?.includes("node -v"), true);
});
