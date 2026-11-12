// eli5 설명서 서가의 데이터, 필터, 문서 응답, 메뉴 위치를 검증한다.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import bodies from "../src/data/eli5-shelf-bodies.json";
import { buildEli5ShelfDocResponse, getEli5ShelfBody } from "../src/lib/eli5-shelf-doc";
import { filterEli5Shelf, getEli5Shelf, listEli5Shelf } from "../src/lib/eli5-shelf";

const items = listEli5Shelf();

test("목록은 61건이고 id가 고유하며 date 내림차순 title 순이다", () => {
  assert.equal(items.length, 61);
  assert.equal(new Set(items.map((item) => item.id)).size, 61);
  for (const item of items) assert.match(item.id, /^[A-Za-z0-9-]+$/);
  for (let i = 1; i < items.length; i++) {
    const a = items[i - 1];
    const b = items[i];
    assert.ok(a.date > b.date || (a.date === b.date && a.title.localeCompare(b.title, "ko") <= 0));
  }
  assert.notEqual(listEli5Shelf(), items);
});

test("제외 제목 문서는 없고 모든 목록 id에 본문이 있다", () => {
  for (const item of items) {
    assert.equal(item.title.includes("한 폴더 두 시스템"), false);
    assert.equal(item.title.includes("Next.js vs TanStack"), false);
    assert.ok(getEli5ShelfBody(item.id), item.id);
  }
  assert.equal(Object.keys(bodies).length, items.length);
});

test("필터는 검색어, 종류, 태그를 조합한다", () => {
  const first = items[0];
  assert.equal(filterEli5Shelf(items, { query: "   " }).length, items.length);
  assert.equal(filterEli5Shelf(items, { query: first.title.toUpperCase() }).some((i) => i.id === first.id), true);
  assert.equal(filterEli5Shelf(items, { query: "zzzz-없는-검색어" }).length, 0);
  const kinds = items.filter((i) => i.kind === "비교");
  assert.equal(filterEli5Shelf(items, { kind: "비교" }).length, kinds.length);
  assert.equal(filterEli5Shelf(items, { kind: "설명" }).length, items.length - kinds.length);
  const tag = first.tags[0];
  const tagged = filterEli5Shelf(items, { tag });
  assert.ok(tagged.length >= 1 && tagged.every((i) => i.tags.includes(tag)));
  assert.equal(filterEli5Shelf(items, { tag, kind: first.kind, query: first.title }).some((i) => i.id === first.id), true);
  assert.equal(getEli5Shelf("없는-id"), undefined);
});

test("userId가 없으면 401, 없는 id면 404다", async () => {
  const noUser = buildEli5ShelfDocResponse({ id: items[0].id, userId: undefined });
  assert.equal(noUser.status, 401);
  assert.match(noUser.headers.get("content-type") ?? "", /^text\/plain/);
  const missing = buildEli5ShelfDocResponse({ id: "없는-id", userId: "u1" });
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get("content-type") ?? "", /^text\/plain/);
  assert.equal(buildEli5ShelfDocResponse({ id: "__proto__", userId: "u1" }).status, 404);
});

test("200 응답은 헤더를 모두 지킨다", async () => {
  const res = buildEli5ShelfDocResponse({ id: items[0].id, userId: "u1", theme: "light" });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(res.headers.get("cache-control"), "private, no-store");
  assert.equal(res.headers.get("x-frame-options"), "SAMEORIGIN");
  assert.equal(res.headers.get("referrer-policy"), "no-referrer");
  assert.equal(
    res.headers.get("content-security-policy"),
    "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'; img-src data: https:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox"
  );
});

test("테마는 dark만 dark이고 그 외는 light이며 html 태그 한 곳만 바뀐다", async () => {
  const id = items[0].id;
  const original = getEli5ShelfBody(id) ?? "";
  const htmlTag = (text: string) => text.match(/<html\b[^>]*>/i)?.[0] ?? "";
  const render = async (theme?: string | null) =>
    buildEli5ShelfDocResponse({ id, userId: "u1", theme }).text();
  const dark = await render("dark");
  assert.match(htmlTag(dark), /data-theme="dark"/);
  for (const theme of ["light", "evil\"><script>", "", null, undefined]) {
    const out = await render(theme);
    assert.match(htmlTag(out), /data-theme="light"/);
    assert.equal(out.includes("evil"), false);
  }
  // html 태그 밖 본문은 그대로다.
  assert.equal(dark.replace(htmlTag(dark), ""), original.replace(htmlTag(original), ""));
  assert.equal((dark.match(/data-theme=/g) ?? []).length - (original.match(/data-theme=/g) ?? []).length, 1 - (htmlTag(original).includes("data-theme") ? 1 : 0));
});

test("사이드바와 명령 팔레트에 eli5 설명서 경로가 있다", () => {
  const root = process.cwd();
  const sidebar = fs.readFileSync(path.join(root, "src/components/layout/sidebar.tsx"), "utf8");
  assert.equal(sidebar.includes('{ href: "/eli5-shelf", label: "eli5 설명서", icon: Lightbulb }'), true);
  assert.ok(sidebar.indexOf('href: "/skills"') < sidebar.indexOf('href: "/eli5-shelf"'));
  assert.ok(sidebar.indexOf('href: "/eli5-shelf"') < sidebar.indexOf('label: "프롬프트"'));
  const palette = fs.readFileSync(path.join(root, "src/components/command-palette.tsx"), "utf8");
  assert.equal(palette.includes('id: "nav-eli5-shelf"'), true);
  assert.equal(palette.includes('go("/eli5-shelf")'), true);
});
