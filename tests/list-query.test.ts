// parseListQuery 페이지·검색어 파싱
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseListQuery } from "../src/lib/list-query";
import { DEFAULT_PAGE_SIZE } from "../src/lib/list-utils";

describe("parseListQuery", () => {
  it("page가 없으면 1페이지·offset 0·기본 limit", () => {
    const parsed = parseListQuery({});
    assert.equal(parsed.page, 1);
    assert.equal(parsed.offset, 0);
    assert.equal(parsed.limit, DEFAULT_PAGE_SIZE);
  });

  it("page=3이면 offset은 (3-1)*DEFAULT_PAGE_SIZE", () => {
    const parsed = parseListQuery({ page: "3" });
    assert.equal(parsed.page, 3);
    assert.equal(parsed.offset, (3 - 1) * DEFAULT_PAGE_SIZE);
    assert.equal(parsed.limit, DEFAULT_PAGE_SIZE);
  });

  it("page가 0·음수·숫자가 아니면 1페이지", () => {
    assert.equal(parseListQuery({ page: "0" }).page, 1);
    assert.equal(parseListQuery({ page: "-2" }).page, 1);
    assert.equal(parseListQuery({ page: "abc" }).page, 1);
  });

  it("q가 없거나 공백뿐이면 빈 문자열", () => {
    assert.equal(parseListQuery({}).q, "");
    assert.equal(parseListQuery({ q: "" }).q, "");
    assert.equal(parseListQuery({ q: "   " }).q, "");
  });

  it("q 앞뒤 공백을 자른다", () => {
    assert.equal(parseListQuery({ q: "  hello world  " }).q, "hello world");
  });
});
