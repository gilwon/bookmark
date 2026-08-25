// 최근 본 페이지 id 배열 규칙을 검증한다
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeRecentIds } from "../src/lib/recent-pages.ts";

describe("mergeRecentIds", () => {
  it("새 id를 맨 앞에 넣고 중복은 제거한다", () => {
    assert.deepEqual(mergeRecentIds(["a", "b", "c"], "b"), ["b", "a", "c"]);
    assert.deepEqual(mergeRecentIds(["a"], "z"), ["z", "a"]);
  });

  it("최대 개수를 넘기면 오래된 항목을 버린다", () => {
    const prev = Array.from({ length: 20 }, (_, i) => String(i));
    const next = mergeRecentIds(prev, "x", 20);
    assert.equal(next.length, 20);
    assert.equal(next[0], "x");
    assert.equal(next.includes("19"), false);
    assert.equal(next.includes("0"), true);
  });

  it("빈 id는 기존 배열만 자른다", () => {
    assert.deepEqual(mergeRecentIds(["a", "b"], "  ", 2), ["a", "b"]);
  });
});
