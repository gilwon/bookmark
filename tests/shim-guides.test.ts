// 심팀장 자료실 68건의 순서, 검색, 본문 주소를 검증한다.
import assert from "node:assert/strict";
import test from "node:test";
import { getShimGuideBody } from "../src/lib/shim-guide-body";
import { getShimGuide, listShimGuides } from "../src/lib/shim-guides-catalog";
import { filterShimGuides } from "../src/lib/shim-guides";

const ADDED_SLUGS = [
  "ruflo",
  "arena",
  "timemachine",
  "craftapps",
  "hiddenskills",
  "headroom",
  "bigtech3",
  "fivecodes",
  "opendesign",
  "stockai",
  "freetoken",
  "tvad",
  "appsecurity",
  "employees",
  "watermark",
  "playbook",
];

// 추가 16건 본문 첫 이미지에 실제로 있는 alt. 페이지 문구를 바꾸지 않는다.
const ADDED_HEADER_ALT: Record<string, string> = {
  ruflo: "심팀장님 캐릭터",
  arena: "심팀장님 캐릭터",
  timemachine: "심팀장님 캐릭터",
  craftapps: "심팀장님 캐릭터",
  hiddenskills: "심팀장님 캐릭터",
  headroom: "심팀장님 캐릭터",
  bigtech3: "심팀장님 캐릭터",
  fivecodes: "심팀장님 캐릭터",
  opendesign: "심팀장님 캐릭터",
  stockai: "심팀장님 캐릭터",
  freetoken: "심팀장님 캐릭터",
  tvad: "심팀장님 캐릭터",
  appsecurity: "심팀장님 캐릭터",
  employees: "심팀장님 캐릭터",
  watermark: "심팀장님 캐릭터",
  playbook: "심팀장님 캐릭터",
};

const FORBIDDEN_BODY_SNIPPETS = [
  "fbclid",
  "utm_source",
  "og-home.png",
  "og-clone.png",
  "og-reverse.png",
  "og-weekend.png",
];

test("자료 68건은 사이트 순서와 고유한 주소, 정해진 키만 가진다", () => {
  const guides = listShimGuides();
  assert.equal(guides.length, 68);
  assert.equal(new Set(guides.map((guide) => guide.slug)).size, 68);
  assert.equal(new Set(guides.map((guide) => guide.sourceUrl)).size, 68);
  guides.forEach((guide, index) => {
    assert.equal(guide.order, index);
    assert.equal(guide.sourceUrl, `https://shimteamjjang.vercel.app/${guide.slug}`);
    assert.deepEqual(Object.keys(guide), ["slug", "title", "episode", "summary", "order", "sourceUrl"]);
  });
  assert.deepEqual(
    guides.slice(0, 16).map((guide) => guide.slug),
    ADDED_SLUGS
  );
  assert.equal(guides[0].slug, "ruflo");
  assert.equal(guides[0].episode, "80편");
  assert.equal(guides[0].title, "클로드 코드에 AI 개발팀 붙이는 루플로");
  assert.equal(guides[16].slug, "rea");
  assert.equal(guides[16].episode, "64편");
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
  assert.equal(filterShimGuides(guides, { query: "   " }).length, 68);
  assert.deepEqual(
    filterShimGuides(guides, { query: "" }).map((guide) => guide.slug),
    guides.map((guide) => guide.slug)
  );
  assert.equal(filterShimGuides(guides, { query: "존재하지않는자료제목123456789" }).length, 0);
  assert.deepEqual(guides, before);
});

test("68개 본문은 비어 있지 않고 캐릭터 이미지만 남긴다", () => {
  const guides = listShimGuides();
  const origin = "https://shimteamjjang.vercel.app";
  for (const guide of guides) {
    const body = getShimGuideBody(guide.slug);
    assert.equal(typeof body, "string", guide.slug);
    assert.ok(body && body.trim() !== "", guide.slug);
    if (ADDED_SLUGS.includes(guide.slug)) {
      const alt = ADDED_HEADER_ALT[guide.slug];
      assert.equal(body?.includes(`![${alt}](${origin}/team.png)`), true, guide.slug);
      assert.equal(body?.includes("<button"), false, guide.slug);
      assert.equal(
        body?.split("\n").some((line) => line.trim() === "복사"),
        false,
        guide.slug
      );
      for (const match of body?.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g) ?? []) {
        const url = match[1];
        if (!url.startsWith(`${origin}/`)) continue;
        const path = url.slice(origin.length + 1);
        assert.equal(path === "team.png" || path.startsWith(`${guide.slug}/`), true, `${guide.slug} ${url}`);
      }
    } else {
      assert.equal(body?.includes(`${origin}/team.png`), true, guide.slug);
      const characterAlt = ["plugin", "token", "design", "convert"].includes(guide.slug)
        ? "심팀장님과 막내"
        : "심팀장님 캐릭터";
      assert.equal(body?.includes(characterAlt), true, guide.slug);
    }
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
