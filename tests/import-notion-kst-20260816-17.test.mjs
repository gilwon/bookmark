// 한국 시간 어제·오늘 Notion 2건 이관의 날짜·중복·변환을 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import { pageData } from "../scripts/notion-kst-20260816-17-data.mjs";
import {
  buildPageContent,
  duplicatePage,
  filterRecentPages,
} from "../scripts/import-notion-kst-20260816-17.mjs";

const allowedIds = [
  "155b2568-27ac-82a5-b27e-81c05bb185ce",
  "78bb2568-27ac-820a-b06a-811e567fb95b",
];

test("날짜 범위 밖 페이지는 걸러진다", () => {
  const outside = { ...pageData[0], createdAt: "2026-08-15T14:59:59.999Z" };
  const later = { ...pageData[0], createdAt: "2026-08-17T15:00:00.000Z" };
  const otherId = { ...pageData[0], id: "c12b2568-27ac-8230-b48b-8162edeaa2c1", createdAt: "2026-08-16T12:00:00.000Z" };
  assert.equal(filterRecentPages([outside, later, otherId]).length, 0);
});

test("허용 2건은 통과한다", () => {
  const filtered = filterRecentPages(pageData);
  assert.equal(filtered.length, 2);
  assert.deepEqual(filtered.map((page) => page.id), allowedIds);
});

test("제목 또는 원문 ID가 있으면 중복", () => {
  const page = pageData[0];
  assert.equal(duplicatePage([{ title: page.title, content: "기존 본문" }], page), true);
  assert.equal(duplicatePage([{ title: "다른 제목", content: page.id }], page), true);
  assert.equal(duplicatePage([{ title: "다른 제목", content: page.id.replaceAll("-", "") }], page), true);
  assert.equal(duplicatePage([{ title: "다른 제목", content: page.url }], page), true);
  assert.equal(duplicatePage([{ title: "다른 제목", content: "기존 본문" }], page), false);
});

test("변환 결과에 가이드북·표·콜아웃·원문이 있다", () => {
  const contents = pageData.map((page) => buildPageContent(page)).join("\n");
  assert.match(contents, /https:\/\/docs\.google\.com\/document\/d\/1sUColJlbwCfJ7uXOrIK9T-ipsC_noPOSTL451dubgUo/);
  assert.match(contents, /OmniRoute/);
  assert.match(contents, /10배 더 빠르게 흡수하는 방법/);
  assert.match(contents, /155b256827ac82a5b27e81c05bb185ce/);
  assert.match(contents, /78bb256827ac820ab06a811e567fb95b/);
  assert.match(contents, /https:\/\/github\.com\/rebelytics\/one-skill-to-rule-them-all/);
});

test("네이버 카페 URL을 새로 만들지 않는다", () => {
  const contents = pageData.map((page) => buildPageContent(page)).join("\n");
  assert.equal(/cafe\.naver\.com/i.test(contents), false);
  assert.match(contents, /AINOW 네이버 카페/);
  assert.match(contents, /155b256827ac82a5b27e81c05bb185ce#04fb256827ac83d3ad1b813030a67353/);
});
