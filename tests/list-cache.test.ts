// 사용자별 목록 캐시 태그
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { userListTag } from "../src/lib/list-cache";

describe("userListTag", () => {
  it("bookmarks 태그는 ulist:bookmarks:userId", () => {
    assert.equal(userListTag("u1", "bookmarks"), "ulist:bookmarks:u1");
  });

  it("사용자나 종류가 다르면 태그도 다르다", () => {
    assert.notEqual(
      userListTag("u1", "bookmarks"),
      userListTag("u2", "bookmarks")
    );
    assert.notEqual(userListTag("u1", "bookmarks"), userListTag("u1", "prompts"));
    assert.notEqual(userListTag("u1", "copies"), userListTag("u1", "pages"));
  });
});
