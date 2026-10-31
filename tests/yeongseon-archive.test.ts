// 신영선 자료 아카이브 412건의 개수, 검색, 24편 단위를 검증한다.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  YEONGSEON_PAGE_SIZE,
  articleUrl,
  filterYeongseonArchive,
  listYeongseonArchive,
  sourceOptions,
  topicOptions,
  visibleCount,
} from "../src/lib/yeongseon-archive";

test("자료 412건은 고유한 id와 첫·끝 항목, 출처·과정 수를 가진다", () => {
  const items = listYeongseonArchive();
  assert.equal(items.length, 412);
  assert.equal(new Set(items.map((item) => item.id)).size, 412);
  assert.equal(items[0]?.id, "405d86104de280f59105df276560229a");
  assert.equal(items[0]?.title, "클로드코드 유명 명령 8개 끝 vs 미래 판정표");
  assert.equal(items[411]?.id, "1a9d86104de281ae8525c34501d2d500");
  assert.equal(items[411]?.title, "멍청한 GPT, 5초만에 천재로 만드는 방법");
  assert.equal(items[411]?.publishedAt, "2025-03-01");
  assert.equal(items.filter((item) => item.source === "신영선").length, 311);
  assert.equal(items.filter((item) => item.source === "에이나우").length, 101);
  assert.equal(items.filter((item) => item.level === "기본 과정").length, 370);
  assert.equal(items.filter((item) => item.level === "심화 과정").length, 42);
  assert.equal(articleUrl(items[0].id), `https://yeongseon.kr/archive/${items[0].id}.html`);
  const copy = listYeongseonArchive();
  assert.notEqual(copy, items);
});

test("출처·주제·검색어로 거르고 보이는 편수는 24 단위로 자른다", () => {
  const items = listYeongseonArchive();
  const aina = filterYeongseonArchive(items, { source: "에이나우" });
  assert.equal(aina.length, 101);
  assert.equal(aina.every((item) => item.source === "에이나우"), true);

  const higgs = filterYeongseonArchive(items, { topic: "힉스필드" });
  assert.ok(higgs.length > 0);
  assert.equal(higgs.every((item) => item.tags.includes("힉스필드")), true);
  assert.equal(
    higgs.length,
    items.filter((item) => item.tags.includes("힉스필드")).length
  );

  const usage = filterYeongseonArchive(items, { query: "클로드코드 사용량" });
  assert.ok(usage.some((item) => item.title === "클로드코드 사용량 줄이는 세팅법"));
  assert.equal(
    usage.some((item) => item.title === "클로드코드 유명 명령 8개 끝 vs 미래 판정표"),
    false
  );
  assert.equal(
    usage.every((item) => {
      const haystack = [item.title, item.description, item.level, ...item.tags].join(" ").toLocaleLowerCase();
      return haystack.includes("클로드코드") && haystack.includes("사용량");
    }),
    true
  );
  assert.ok(filterYeongseonArchive(items, { query: "gpt" }).some((item) => item.title.includes("GPT")));

  assert.equal(YEONGSEON_PAGE_SIZE, 24);
  assert.equal(visibleCount(100, 10), 24);
  assert.equal(visibleCount(100, 30), 30);
  assert.equal(visibleCount(20, 30), 20);

  const sources = sourceOptions(items);
  assert.deepEqual(
    sources.map((option) => [option.name, option.count]),
    [
      ["", 412],
      ["신영선", 311],
      ["에이나우", 101],
    ]
  );

  const topics = topicOptions(items, "", "");
  assert.equal(topics[0]?.name, "");
  assert.equal(topics[0]?.count, items.length);
  assert.equal(topics.slice(1).length, 10);
  const topNames = new Set(topics.slice(1).map((option) => option.name));
  let outside = "";
  for (const item of items) {
    for (const tag of item.tags) {
      if (!topNames.has(tag)) outside = tag;
    }
  }
  assert.ok(outside);
  const withSelected = topicOptions(items, "", outside);
  assert.equal(withSelected[0]?.name, "");
  assert.equal(withSelected.at(-1)?.name, outside);
  assert.equal(withSelected.filter((option) => option.name === outside).length, 1);
  assert.equal(withSelected.length, 12);

  const narrowed = topicOptions(items, "에이나우", "");
  assert.equal(narrowed[0]?.count, 101);
  assert.ok(narrowed.length <= 11);
});

test("사이드바에는 신영선 자료실이 있고 하단 탭 섹션은 5개다", () => {
  const root = process.cwd();
  const sidebar = fs.readFileSync(path.join(root, "src/components/layout/sidebar.tsx"), "utf8");
  assert.equal(
    sidebar.includes('{ href: "/yeongseon-archive", label: "신영선 자료실", icon: Archive }'),
    true
  );
  assert.ok(sidebar.indexOf('href: "/shim-guides"') < sidebar.indexOf('href: "/yeongseon-archive"'));

  const start = sidebar.indexOf("export const navSections");
  const end = sidebar.indexOf("] as const;", start);
  const labels = [...sidebar.slice(start, end).matchAll(/^    label: (null|"[^"]+"),$/gm)].map(
    (match) => match[1]
  );
  assert.deepEqual(labels, ["null", '"라이브러리"', '"X"', '"GitHub"', '"프롬프트"']);

  const bottom = fs.readFileSync(path.join(root, "src/components/layout/bottom-nav.tsx"), "utf8");
  const icons = bottom.match(/const ICONS = \[([^\]]*)\]/);
  assert.ok(icons);
  const iconCount = icons[1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean).length;
  assert.equal(iconCount, 5);
});
