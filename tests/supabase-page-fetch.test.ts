import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SUPABASE_MAX_ROWS,
  fetchAllPaged,
} from "../src/lib/store/supabase-page";

describe("fetchAllPaged", () => {
  it("한 페이지가 짧으면 한 번에 끝낸다", async () => {
    const calls: [number, number][] = [];
    const rows = await fetchAllPaged(async (from, to) => {
      calls.push([from, to]);
      return ["a", "b"];
    });
    assert.deepEqual(rows, ["a", "b"]);
    assert.deepEqual(calls, [[0, SUPABASE_MAX_ROWS - 1]]);
  });

  it("1000행이 가득 차면 다음 range를 이어 붙인다", async () => {
    const page1 = Array.from({ length: SUPABASE_MAX_ROWS }, (_, i) => i);
    const page2 = [1000, 1001];
    let n = 0;
    const rows = await fetchAllPaged(async () => {
      n += 1;
      return n === 1 ? page1 : page2;
    });
    assert.equal(rows.length, SUPABASE_MAX_ROWS + 2);
    assert.equal(n, 2);
    assert.equal(rows[1000], 1000);
  });

  it("maxRows가 있으면 그 개수에서 멈춘다", async () => {
    const page = Array.from({ length: SUPABASE_MAX_ROWS }, (_, i) => i);
    let n = 0;
    const rows = await fetchAllPaged(async (from, to) => {
      n += 1;
      assert.equal(from, 0);
      assert.equal(to, 49);
      return page.slice(0, 50);
    }, 50);
    assert.equal(rows.length, 50);
    assert.equal(n, 1);
  });
});
