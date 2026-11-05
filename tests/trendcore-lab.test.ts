// 트렌드코어 스킬공유자료실 74건의 정렬, 본문, 메뉴 위치를 검증한다.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { getTrendcoreLabBody } from "../src/lib/trendcore-lab-body";
import { filterTrendcoreLab, getTrendcoreLab, listTrendcoreLab } from "../src/lib/trendcore-lab";

test("자료 74건은 고유한 슬러그와 출처를 가지고 첫 카드가 first-steps다", () => {
  const items = listTrendcoreLab();
  assert.equal(items.length, 74);
  assert.equal(new Set(items.map((item) => item.slug)).size, 74);
  assert.equal(new Set(items.map((item) => item.sourceUrl)).size, 74);
  assert.equal(items[0]?.slug, "first-steps");
  const copy = listTrendcoreLab();
  assert.notEqual(copy, items);
});

test("074, i005, first-steps, kaltoe, 058의 분류와 날짜와 태그를 지킨다", () => {
  const sns = getTrendcoreLab("074");
  assert.equal(sns?.title, "클로드에 SNS 채널 통째로 맡기기");
  assert.equal(sns?.category, "꿀팁");
  assert.equal(sns?.tags.includes("NEW"), true);
  assert.equal(sns?.publishedAt.startsWith("2026-11-04"), true);

  const astra = getTrendcoreLab("i005");
  assert.equal(astra?.category, "정보");
  assert.equal(astra?.publishedAt.startsWith("2026-09-05"), true);
  assert.match(astra?.title ?? "", /아스트라/);

  const first = getTrendcoreLab("first-steps");
  assert.equal(first?.category, "기초첫걸음");
  assert.equal(first?.publishedAt.startsWith("2026-10-13"), true);

  assert.equal(getTrendcoreLab("kaltoe")?.number, "#041");
  assert.equal(getTrendcoreLab("058")?.tags.includes("지금 인기"), true);
});

test("최신순은 날짜를 내림차순으로 두고 같은 날에는 074가 073보다 앞이다", () => {
  const items = listTrendcoreLab();
  const newest = filterTrendcoreLab(items, { sort: "newest" });
  const firstDate = Date.parse(newest[0]?.publishedAt ?? "");
  const lastDate = Date.parse(newest.at(-1)?.publishedAt ?? "");
  assert.ok(firstDate >= lastDate);
  assert.ok(newest.findIndex((item) => item.slug === "074") < newest.findIndex((item) => item.slug === "073"));
  assert.equal(filterTrendcoreLab(items, { query: "아스트라" }).some((item) => item.slug === "i005"), true);
  assert.equal(filterTrendcoreLab(items, { query: "   " }).length, 74);
});

test("074, first-steps, i005 본문은 절대 주소와 기본 프롬프트를 남기고 오픈카카오는 빼다", () => {
  const sns = getTrendcoreLabBody("074") ?? "";
  assert.match(sns, /api\.uplika\.com\/mcp/);
  assert.match(sns, /https:\/\/www\.trendcore\.co\.kr\/guide\/074-assets\//);
  assert.match(sns, /\.pdf/);
  assert.equal(sns.includes("open.kakao.com"), false);

  const first = getTrendcoreLabBody("first-steps") ?? "";
  assert.match(first, /https:\/\/www\.trendcore\.co\.kr\/guide\/first-steps-assets\//);
  assert.match(first, /맛집/);

  const info = getTrendcoreLabBody("i005") ?? "";
  assert.match(info, /https:\/\/openai\.com\/index\/gpt-6-astra\//);
});

test("사이드바와 명령 팔레트에 스킬공유자료실이 신영선 다음이고 하단 탭 아이콘은 5개다", () => {
  const root = process.cwd();
  const sidebar = fs.readFileSync(path.join(root, "src/components/layout/sidebar.tsx"), "utf8");
  assert.equal(
    sidebar.includes('{ href: "/trendcore-lab", label: "스킬공유자료실", icon: NotebookText }'),
    true
  );
  assert.ok(sidebar.indexOf('href: "/yeongseon-archive"') < sidebar.indexOf('href: "/trendcore-lab"'));

  const palette = fs.readFileSync(path.join(root, "src/components/command-palette.tsx"), "utf8");
  assert.equal(palette.includes('id: "nav-trendcore-lab"'), true);
  assert.ok(palette.indexOf("nav-yeongseon-archive") < palette.indexOf("nav-trendcore-lab"));

  const bottom = fs.readFileSync(path.join(root, "src/components/layout/bottom-nav.tsx"), "utf8");
  const icons = bottom.match(/const ICONS = \[([^\]]*)\]/);
  assert.ok(icons);
  const iconCount = icons[1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean).length;
  assert.equal(iconCount, 5);
});
