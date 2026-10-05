// 설치 현황 정렬 함수(sortItems)와 정렬 쿼리 해석을 검증한다
import assert from "node:assert/strict";
import test from "node:test";
import { parseSortMode, sortItems } from "../src/lib/installed-tools";

const items = [
  { name: "다람쥐", uses: 1 },
  { name: "beta", uses: 5, repoUrl: "https://github.com/a/b" },
  { name: "가나", uses: 1 },
  { name: "alpha", uses: 5 },
  { name: "zeta", uses: 0, repoUrl: "https://github.com/c/d" },
];
const names = (xs: { name: string }[]) => xs.map((x) => x.name);

test("이름순은 localeCompare(ko) 순서이고 원본 배열을 바꾸지 않는다", () => {
  const before = names(items);
  const sorted = sortItems(items, "name");
  assert.deepEqual(names(sorted), ["가나", "다람쥐", "alpha", "beta", "zeta"]);
  assert.deepEqual(names(items), before);
  assert.notEqual(sorted, items);
});

test("많이 쓴 순은 사용 횟수 내림차순, 동률은 이름순", () => {
  assert.deepEqual(names(sortItems(items, "uses")), ["alpha", "beta", "가나", "다람쥐", "zeta"]);
});

test("출처 있는 순은 repoUrl 있는 항목을 앞에, 각 묶음 안은 이름순", () => {
  assert.deepEqual(names(sortItems(items, "source")), ["beta", "zeta", "가나", "다람쥐", "alpha"]);
});

test("알 수 없는 정렬 쿼리 값은 이름순으로 본다", () => {
  assert.equal(parseSortMode("uses"), "uses");
  assert.equal(parseSortMode("source"), "source");
  assert.equal(parseSortMode("bogus"), "name");
  assert.equal(parseSortMode(undefined), "name");
  assert.equal(parseSortMode(["uses"]), "name");
});
