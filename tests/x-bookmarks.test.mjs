// X 북마크 순수 함수
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildStatusUrl,
  isMissingXBookmarksTable,
  mapBookmarkPage,
  nextBookmarkToken,
  parseXTokenPayload,
  serializeXTokenPayload,
  shouldRefreshAccessToken,
} from "../src/lib/x-bookmarks.ts";

describe("buildStatusUrl", () => {
  it("사용자 이름이 있으면 그 주소다", () => {
    assert.equal(
      buildStatusUrl("alice", "123"),
      "https://x.com/alice/status/123"
    );
  });

  it("이름이 없으면 i/status다", () => {
    assert.equal(buildStatusUrl("  ", "99"), "https://x.com/i/status/99");
  });
});

describe("mapBookmarkPage", () => {
  it("작성자를 붙이고 빈 본문과 빠진 id를 처리한다", () => {
    const rows = mapBookmarkPage({
      data: [
        {
          id: "1",
          text: "hello",
          author_id: "u1",
          created_at: "2026-10-01T00:00:00.000Z",
        },
        { id: "2", author_id: "missing" },
        { text: "no id" },
        { id: "1", text: "later", author_id: "u1" },
      ],
      includes: { users: [{ id: "u1", name: "앨리스", username: "alice" }] },
    });
    assert.equal(rows.length, 2);
    assert.equal(rows[0].text, "later");
    assert.equal(rows[0].authorName, "앨리스");
    assert.equal(rows[0].url, "https://x.com/alice/status/1");
    assert.equal(rows[1].text, "");
    assert.equal(rows[1].url, "https://x.com/i/status/2");
  });
});

describe("nextBookmarkToken", () => {
  it("다음 토큰이 있으면 문자열이다", () => {
    assert.equal(nextBookmarkToken({ meta: { next_token: "abc" } }), "abc");
    assert.equal(nextBookmarkToken({ meta: {} }), null);
    assert.equal(nextBookmarkToken({ meta: { next_token: "  " } }), null);
  });
});

describe("shouldRefreshAccessToken", () => {
  const now = Date.parse("2026-10-07T00:00:00.000Z");

  it("만료 60초 전이면 갱신한다", () => {
    assert.equal(
      shouldRefreshAccessToken("2026-10-07T00:00:30.000Z", now),
      true
    );
    assert.equal(
      shouldRefreshAccessToken("2026-10-07T00:02:00.000Z", now),
      false
    );
    assert.equal(shouldRefreshAccessToken("not-a-date", now), true);
  });
});

describe("parseXTokenPayload", () => {
  it("왕복되고 깨진 JSON은 null이다", () => {
    const payload = {
      accessToken: "a",
      refreshToken: "r",
      expiresAt: "2026-10-07T02:00:00.000Z",
      xUserId: "7",
    };
    assert.deepEqual(parseXTokenPayload(serializeXTokenPayload(payload)), payload);
    assert.equal(parseXTokenPayload("{"), null);
    assert.equal(parseXTokenPayload(JSON.stringify({ accessToken: "a" })), null);
  });
});

describe("isMissingXBookmarksTable", () => {
  it("테이블 부재 문구만 참이다", () => {
    assert.equal(
      isMissingXBookmarksTable(
        "Could not find the table 'public.x_bookmarks' in the schema cache"
      ),
      true
    );
    assert.equal(isMissingXBookmarksTable("bookmarks does not exist"), false);
  });
});
